"""
test_auth.py — TDD test suite for UC-7: Authenticate User Identity
Tests the 4 Padlock Rules:
  PADLOCK 1 — REQ6 Rate Limiting      → HTTP 429
  PADLOCK 2 — User Enumeration Guard  → HTTP 401
  PADLOCK 3 — Unverified Email        → HTTP 403
  PADLOCK 4 — Happy Path              → HTTP 200 + HTTP-only cookie
"""

import os
import sqlite3
import tempfile
import uuid
import pytest

from main import create_app
from backend.services.auth_service import hash_password, MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MINUTES
from datetime import datetime, timedelta, timezone


# ═══════════════════════════════════════════════════════════════════════════════
#  Fixtures
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture(scope="function")
def db_path(tmp_path):
    """Provides a fresh, isolated in-memory-style SQLite file per test."""
    return str(tmp_path / "test_auth.db")


@pytest.fixture(scope="function")
def app(db_path):
    """Creates a Flask test app wired to the isolated DB."""
    flask_app = create_app(
        {
            "TESTING": True,
            "DATABASE_PATH": db_path,
            "JWT_SECRET_KEY": "test-secret-key",
        }
    )
    yield flask_app


@pytest.fixture(scope="function")
def client(app):
    return app.test_client()


@pytest.fixture(scope="function")
def db_conn(db_path):
    """Direct connection for test-data seeding — bypasses service layer."""
    conn = sqlite3.connect(db_path)
    yield conn
    conn.close()


# ── Helper: seed a user into the DB ───────────────────────────────────────────

def _seed_user(
    conn: sqlite3.Connection,
    email: str = "alice@example.com",
    password: str = "Passw0rd!",
    status: str = "ACTIVE",          # explicitly override PENDING_VERIFICATION default
    failed_attempts: int = 0,
    lockout_expires_at: str | None = None,
) -> int:
    """Inserts a user and returns the new row id (integer PK)."""
    hashed = hash_password(password)
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO Users
            (user_id, email, password_hash, full_name, phone_number,
             status, failed_attempts, lockout_expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),          # user_id: TEXT UUID (new column)
            email.lower(),
            hashed,
            "Alice Smith",
            "01012345678",              # phone_number (renamed from mobile_number)
            status,
            failed_attempts,
            lockout_expires_at,
            datetime.now(timezone.utc).isoformat(),  # created_at NOT NULL
        ),
    )
    conn.commit()
    return cursor.lastrowid  # type: ignore[return-value]


# ═══════════════════════════════════════════════════════════════════════════════
#  PADLOCK 1 — REQ6: Rate Limiting (HTTP 429)
# ═══════════════════════════════════════════════════════════════════════════════

class TestRateLimiting:
    """REQ6: An already-locked account must return HTTP 429 immediately."""

    def test_locked_account_returns_429(self, client, db_conn):
        """A user whose lockout_expires_at is in the future gets HTTP 429."""
        future = (
            datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        ).strftime("%Y-%m-%d %H:%M:%S")
        _seed_user(
            db_conn,
            email="locked@example.com",
            failed_attempts=MAX_FAILED_ATTEMPTS,
            lockout_expires_at=future,
        )

        response = client.post(
            "/api/v1/auth/login",
            json={"email": "locked@example.com", "password": "Passw0rd!"},
        )

        assert response.status_code == 429
        data = response.get_json()
        assert "error" in data
        assert "locked" in data["error"].lower() or "attempts" in data["error"].lower()

    def test_lockout_triggers_after_max_failed_attempts(self, client, db_conn, db_path):
        """Exceeding MAX_FAILED_ATTEMPTS should set lockout_expires_at in DB."""
        _seed_user(db_conn, email="brute@example.com", password="RealPass1!")

        for _ in range(MAX_FAILED_ATTEMPTS):
            client.post(
                "/api/v1/auth/login",
                json={"email": "brute@example.com", "password": "WrongPass!"},
            )

        # Verify DB state
        conn = sqlite3.connect(db_path)
        row = conn.execute(
            "SELECT failed_attempts, lockout_expires_at FROM Users WHERE email = ?",
            ("brute@example.com",),
        ).fetchone()
        conn.close()

        assert row[0] >= MAX_FAILED_ATTEMPTS
        assert row[1] is not None  # lockout set

    def test_expired_lockout_allows_login(self, client, db_conn):
        """A lockout that has already expired must not block the user."""
        past = (
            datetime.now(timezone.utc) - timedelta(minutes=1)
        ).strftime("%Y-%m-%d %H:%M:%S")
        _seed_user(
            db_conn,
            email="expired_lock@example.com",
            failed_attempts=MAX_FAILED_ATTEMPTS,
            lockout_expires_at=past,
        )

        response = client.post(
            "/api/v1/auth/login",
            json={"email": "expired_lock@example.com", "password": "Passw0rd!"},
        )

        # Expired lockout → credentials should now be evaluated normally
        assert response.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════════
#  PADLOCK 2 — User Enumeration Guard (HTTP 401)
# ═══════════════════════════════════════════════════════════════════════════════

class TestUserEnumerationGuard:
    """
    REQ: Both 'email not found' and 'wrong password' must return identical
         HTTP 401 responses so attackers cannot enumerate valid emails.
    """

    def test_unknown_email_returns_401(self, client):
        """No user seeded — unknown email should yield 401."""
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "ghost@example.com", "password": "Whatever1!"},
        )
        assert response.status_code == 401
        data = response.get_json()
        assert "error" in data

    def test_wrong_password_returns_401(self, client, db_conn):
        """Valid email but wrong password → 401, same message."""
        _seed_user(db_conn, email="real@example.com", password="CorrectPass1!")

        response = client.post(
            "/api/v1/auth/login",
            json={"email": "real@example.com", "password": "WrongPassword!"},
        )
        assert response.status_code == 401

    def test_both_error_messages_are_identical(self, client, db_conn):
        """Wrong email and wrong password must return the same error string."""
        _seed_user(db_conn, email="sameresponse@example.com", password="GoodPass1!")

        resp_no_user = client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@example.com", "password": "Irrelevant1!"},
        )
        resp_wrong_pass = client.post(
            "/api/v1/auth/login",
            json={"email": "sameresponse@example.com", "password": "BadPass1!"},
        )

        assert resp_no_user.get_json()["error"] == resp_wrong_pass.get_json()["error"]

    def test_missing_fields_returns_400(self, client):
        """Missing email or password should return 400, not 401."""
        response = client.post("/api/v1/auth/login", json={"email": "a@b.com"})
        assert response.status_code == 400


# ═══════════════════════════════════════════════════════════════════════════════
#  PADLOCK 3 — Unverified / Inactive Email (HTTP 403)
# ═══════════════════════════════════════════════════════════════════════════════

class TestUnverifiedEmail:
    """REQ: An account with status != 'ACTIVE' must return HTTP 403."""

    def test_inactive_account_returns_403(self, client, db_conn):
        _seed_user(
            db_conn,
            email="inactive@example.com",
            password="Passw0rd!",
            status="INACTIVE",
        )

        response = client.post(
            "/api/v1/auth/login",
            json={"email": "inactive@example.com", "password": "Passw0rd!"},
        )

        assert response.status_code == 403
        data = response.get_json()
        assert "error" in data

    def test_locked_status_account_returns_403(self, client, db_conn):
        """status='LOCKED' (via admin action) also returns 403."""
        _seed_user(
            db_conn,
            email="admin_locked@example.com",
            password="Passw0rd!",
            status="LOCKED",
        )

        response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin_locked@example.com", "password": "Passw0rd!"},
        )

        assert response.status_code == 403


# ═══════════════════════════════════════════════════════════════════════════════
#  PADLOCK 4 — Happy Path (HTTP 200 + HTTP-only auth_token cookie)
# ═══════════════════════════════════════════════════════════════════════════════

class TestHappyPath:
    """Correct credentials on an ACTIVE account → 200 + cookie, no raw token in body."""

    def test_valid_login_returns_200(self, client, db_conn):
        _seed_user(db_conn, email="happy@example.com", password="Passw0rd!")

        response = client.post(
            "/api/v1/auth/login",
            json={"email": "happy@example.com", "password": "Passw0rd!"},
        )

        assert response.status_code == 200

    def test_response_body_contains_user_metadata(self, client, db_conn):
        _seed_user(db_conn, email="meta@example.com", password="Passw0rd!")

        response = client.post(
            "/api/v1/auth/login",
            json={"email": "meta@example.com", "password": "Passw0rd!"},
        )

        data = response.get_json()
        assert "user" in data
        assert data["user"]["email"] == "meta@example.com"
        assert "full_name" in data["user"]
        assert "user_id" in data["user"]          # TEXT UUID from new schema

    def test_jwt_not_in_response_body(self, client, db_conn):
        """Security: raw JWT must NOT appear anywhere in the JSON body."""
        _seed_user(db_conn, email="nosecret@example.com", password="Passw0rd!")

        response = client.post(
            "/api/v1/auth/login",
            json={"email": "nosecret@example.com", "password": "Passw0rd!"},
        )

        raw_body = response.get_data(as_text=True)
        # A JWT always starts with eyJ — check no such token in body
        assert "eyJ" not in raw_body, "JWT must NOT be in the response body!"

    def test_auth_token_cookie_is_set(self, client, db_conn):
        """HTTP-only auth_token cookie must be present in Set-Cookie header."""
        _seed_user(db_conn, email="cookie@example.com", password="Passw0rd!")

        response = client.post(
            "/api/v1/auth/login",
            json={"email": "cookie@example.com", "password": "Passw0rd!"},
        )

        assert "auth_token" in response.headers.get("Set-Cookie", "")

    def test_auth_token_cookie_is_httponly(self, client, db_conn):
        """Cookie must carry the HttpOnly flag."""
        _seed_user(db_conn, email="httponly@example.com", password="Passw0rd!")

        response = client.post(
            "/api/v1/auth/login",
            json={"email": "httponly@example.com", "password": "Passw0rd!"},
        )

        set_cookie = response.headers.get("Set-Cookie", "")
        assert "HttpOnly" in set_cookie

    def test_successful_login_resets_failed_attempts(self, client, db_conn, db_path):
        """After a successful login failed_attempts should reset to 0."""
        _seed_user(
            db_conn,
            email="reset@example.com",
            password="Passw0rd!",
            failed_attempts=3,
        )

        client.post(
            "/api/v1/auth/login",
            json={"email": "reset@example.com", "password": "Passw0rd!"},
        )

        conn = sqlite3.connect(db_path)
        row = conn.execute(
            "SELECT failed_attempts FROM Users WHERE email = ?",
            ("reset@example.com",),
        ).fetchone()
        conn.close()

        assert row[0] == 0

    def test_email_is_case_insensitive(self, client, db_conn):
        """Login should succeed regardless of email casing."""
        _seed_user(db_conn, email="case@example.com", password="Passw0rd!")

        response = client.post(
            "/api/v1/auth/login",
            json={"email": "CASE@EXAMPLE.COM", "password": "Passw0rd!"},
        )

        assert response.status_code == 200
