"""
tests/test_auth_integration.py — UC-7: Integration Tests (REQ6)

Uses the Flask test client against an isolated, in-memory SQLite database.
No ORM. No persistent state between tests.

Security Padlocks verified
───────────────────────────────────────────────────────────────────────────────
  Padlock 1 — Rate Limiting     : HTTP 429 after 5 failed attempts (10-min window)
  Padlock 2 — Enumeration Guard : identical HTTP 401 body for unknown email vs wrong pw
  Padlock 3 — Unverified Email  : HTTP 403 for non-ACTIVE status
  Padlock 4 — Happy Path        : HTTP 200 + HttpOnly cookie + token NOT in JSON body
───────────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import sqlite3
import tempfile
import os
from datetime import datetime, timedelta, timezone
from typing import Generator

import pytest
from flask import Flask
from flask.testing import FlaskClient

from backend.services.auth_service import (
    hash_password,
    MAX_FAILED_ATTEMPTS,
    LOCKOUT_DURATION_MINUTES,
)
from backend.routes.auth_routes import auth_login_bp


# ══════════════════════════════════════════════════════════════════════════════
# App factory — minimal Flask app, NO SQLAlchemy, isolated DB per test
# ══════════════════════════════════════════════════════════════════════════════

def _create_test_app(db_path: str) -> Flask:
    """
    Build a minimal Flask application that registers ONLY the login blueprint.

    Deliberately avoids importing the full `backend/__init__.py` factory so
    that SQLAlchemy, Flask-Mail, and other production extensions are not
    initialised during integration tests.
    """
    app = Flask(__name__)
    app.config.update(
        TESTING=True,
        DATABASE_PATH=db_path,
        JWT_SECRET_KEY="integration-test-jwt-secret",
        SECRET_KEY="integration-test-secret",
        ENV="testing",
    )
    app.register_blueprint(auth_login_bp)
    return app


def _bootstrap_db(db_path: str) -> None:
    """
    Create the Users table in the isolated test database using raw SQL.
    Schema mirrors the production Users table defined in auth_service.py.
    """
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS Users (
            id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id            TEXT UNIQUE NOT NULL,
            email              TEXT UNIQUE NOT NULL,
            password_hash      TEXT NOT NULL,
            full_name          TEXT NOT NULL,
            phone_number       TEXT,
            status             TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
            failed_attempts    INTEGER NOT NULL DEFAULT 0,
            lockout_expires_at TEXT,
            created_at         TEXT NOT NULL,
            otp_code           TEXT,
            otp_expires_at     TEXT
        )
        """
    )
    conn.commit()
    conn.close()


def _insert_user(
    db_path: str,
    *,
    user_id: str = "uuid-test-001",
    email: str = "alice@example.com",
    plain_password: str = "SecureP@ss1",
    full_name: str = "Alice Test",
    status: str = "ACTIVE",
    failed_attempts: int = 0,
    lockout_expires_at: str | None = None,
) -> None:
    """Insert a single user row using raw SQL (no ORM)."""
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        INSERT INTO Users
            (user_id, email, password_hash, full_name, status,
             failed_attempts, lockout_expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            email.lower().strip(),
            hash_password(plain_password),
            full_name,
            status,
            failed_attempts,
            lockout_expires_at,
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    conn.commit()
    conn.close()


# ══════════════════════════════════════════════════════════════════════════════
# Fixtures
# ══════════════════════════════════════════════════════════════════════════════

@pytest.fixture()
def db_path() -> Generator[str, None, None]:
    """Provide a fresh, temporary SQLite database file per test."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    _bootstrap_db(path)
    yield path
    os.unlink(path)


@pytest.fixture()
def app(db_path: str) -> Flask:
    return _create_test_app(db_path)


@pytest.fixture()
def client(app: Flask) -> FlaskClient:
    return app.test_client()


# ── Convenience payload builders ──────────────────────────────────────────────

def _login_payload(
    email: str = "alice@example.com",
    password: str = "SecureP@ss1",
) -> dict:
    return {"email": email, "password": password}


# ══════════════════════════════════════════════════════════════════════════════
# Helper: drain failed attempts up to (n-1) to prime the rate-limit state
# ══════════════════════════════════════════════════════════════════════════════

def _exhaust_attempts(client: FlaskClient, email: str, n: int = MAX_FAILED_ATTEMPTS) -> None:
    """Send *n* failed login requests to build up the failed_attempts counter."""
    for _ in range(n):
        client.post(
            "/api/v1/auth/login",
            json=_login_payload(email=email, password="__wrong__"),
            content_type="application/json",
        )


# ══════════════════════════════════════════════════════════════════════════════
# Section A — Input validation (400)
# ══════════════════════════════════════════════════════════════════════════════

class TestInputValidation:

    def test_missing_email_returns_400(self, client, db_path):
        _insert_user(db_path)
        rv = client.post(
            "/api/v1/auth/login",
            json={"password": "SecureP@ss1"},
            content_type="application/json",
        )
        assert rv.status_code == 400

    def test_missing_password_returns_400(self, client, db_path):
        _insert_user(db_path)
        rv = client.post(
            "/api/v1/auth/login",
            json={"email": "alice@example.com"},
            content_type="application/json",
        )
        assert rv.status_code == 400

    def test_empty_body_returns_400(self, client, db_path):
        _insert_user(db_path)
        rv = client.post(
            "/api/v1/auth/login",
            json={},
            content_type="application/json",
        )
        assert rv.status_code == 400


# ══════════════════════════════════════════════════════════════════════════════
# Section B — 🔒 PADLOCK 2: Enumeration Guard (HTTP 401)
# ══════════════════════════════════════════════════════════════════════════════

class TestPadlock2EnumerationGuard:
    """
    REQ6 — Padlock 2:
    Whether the email is unknown or the password is wrong, the system MUST
    return HTTP 401 with an IDENTICAL error message so an attacker cannot
    distinguish a valid account from an invalid one.
    """

    def test_unknown_email_returns_401(self, client, db_path):
        rv = client.post(
            "/api/v1/auth/login",
            json=_login_payload(email="ghost@nowhere.com"),
            content_type="application/json",
        )
        assert rv.status_code == 401

    def test_wrong_password_returns_401(self, client, db_path):
        _insert_user(db_path)
        rv = client.post(
            "/api/v1/auth/login",
            json=_login_payload(password="TotallyWrong99!"),
            content_type="application/json",
        )
        assert rv.status_code == 401

    def test_enumeration_guard_identical_error_body(self, client, db_path):
        """
        The JSON error body for 'unknown email' and 'wrong password' must be
        character-for-character identical so no field leaks account existence.
        """
        _insert_user(db_path)

        rv_unknown = client.post(
            "/api/v1/auth/login",
            json=_login_payload(email="ghost@nowhere.com"),
            content_type="application/json",
        )
        rv_wrong_pw = client.post(
            "/api/v1/auth/login",
            json=_login_payload(password="TotallyWrong99!"),
            content_type="application/json",
        )

        assert rv_unknown.status_code == rv_wrong_pw.status_code == 401
        assert rv_unknown.get_json() == rv_wrong_pw.get_json(), (
            "Error bodies differ! User enumeration is possible."
        )

    def test_unknown_email_has_no_token_cookie(self, client, db_path):
        rv = client.post(
            "/api/v1/auth/login",
            json=_login_payload(email="ghost@nowhere.com"),
            content_type="application/json",
        )
        assert "auth_token" not in rv.headers.get("Set-Cookie", "")


# ══════════════════════════════════════════════════════════════════════════════
# Section C — 🔒 PADLOCK 3: Unverified / Inactive Account (HTTP 403)
# ══════════════════════════════════════════════════════════════════════════════

class TestPadlock3UnverifiedEmail:
    """
    REQ6 — Padlock 3:
    Any user whose status is NOT 'ACTIVE' must receive HTTP 403 even when
    the correct password is supplied.
    """

    @pytest.mark.parametrize("status", ["PENDING_VERIFICATION", "LOCKED", "SUSPENDED"])
    def test_non_active_status_returns_403(self, client, db_path, status):
        _insert_user(db_path, status=status)
        rv = client.post(
            "/api/v1/auth/login",
            json=_login_payload(),
            content_type="application/json",
        )
        assert rv.status_code == 403, (
            f"Expected 403 for status='{status}', got {rv.status_code}"
        )

    def test_403_has_no_token_cookie(self, client, db_path):
        _insert_user(db_path, status="PENDING_VERIFICATION")
        rv = client.post(
            "/api/v1/auth/login",
            json=_login_payload(),
            content_type="application/json",
        )
        assert rv.status_code == 403
        assert "auth_token" not in rv.headers.get("Set-Cookie", "")

    def test_403_has_no_token_in_body(self, client, db_path):
        _insert_user(db_path, status="PENDING_VERIFICATION")
        rv = client.post(
            "/api/v1/auth/login",
            json=_login_payload(),
            content_type="application/json",
        )
        body = rv.get_json() or {}
        assert "token" not in body
        assert "access_token" not in body
        assert "auth_token" not in body


# ══════════════════════════════════════════════════════════════════════════════
# Section D — 🔒 PADLOCK 1: Rate Limiting (HTTP 429)
# ══════════════════════════════════════════════════════════════════════════════

class TestPadlock1RateLimiting:
    """
    REQ6 — Padlock 1:
    After MAX_FAILED_ATTEMPTS (5) consecutive failed logins within the
    LOCKOUT_DURATION_MINUTES (10-minute) window, the account is locked and
    subsequent requests — even with the correct password — must return 429.
    """

    def test_five_failures_trigger_lockout(self, client, db_path):
        _insert_user(db_path)
        _exhaust_attempts(client, "alice@example.com", n=MAX_FAILED_ATTEMPTS)

        # Next attempt (could be correct or wrong) must return 429
        rv = client.post(
            "/api/v1/auth/login",
            json=_login_payload(),          # correct credentials!
            content_type="application/json",
        )
        assert rv.status_code == 429

    def test_429_body_contains_error_message(self, client, db_path):
        _insert_user(db_path)
        _exhaust_attempts(client, "alice@example.com", n=MAX_FAILED_ATTEMPTS)

        rv = client.post(
            "/api/v1/auth/login",
            json=_login_payload(),
            content_type="application/json",
        )
        body = rv.get_json()
        assert body is not None
        assert "error" in body
        assert body["error"]  # non-empty message

    def test_four_failures_do_not_lock_account(self, client, db_path):
        """One fewer than the threshold must NOT trigger a lockout."""
        _insert_user(db_path)
        _exhaust_attempts(client, "alice@example.com", n=MAX_FAILED_ATTEMPTS - 1)

        rv = client.post(
            "/api/v1/auth/login",
            json=_login_payload(),   # correct credentials on 5th attempt
            content_type="application/json",
        )
        # Should succeed (200), not be rate-limited (429)
        assert rv.status_code == 200

    def test_already_locked_in_db_returns_429(self, client, db_path):
        """
        If the DB already has lockout_expires_at set (e.g. from a previous
        session), the very first request must immediately return 429.
        """
        future = (
            datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        ).strftime("%Y-%m-%d %H:%M:%S")
        _insert_user(
            db_path,
            failed_attempts=MAX_FAILED_ATTEMPTS,
            lockout_expires_at=future,
        )
        rv = client.post(
            "/api/v1/auth/login",
            json=_login_payload(),
            content_type="application/json",
        )
        assert rv.status_code == 429

    def test_429_has_no_token_in_response(self, client, db_path):
        _insert_user(db_path)
        _exhaust_attempts(client, "alice@example.com", n=MAX_FAILED_ATTEMPTS)

        rv = client.post(
            "/api/v1/auth/login",
            json=_login_payload(),
            content_type="application/json",
        )
        assert rv.status_code == 429
        body = rv.get_json() or {}
        assert "token" not in body
        assert "auth_token" not in body
        assert "auth_token" not in rv.headers.get("Set-Cookie", "")

    def test_counter_increments_on_each_failure(self, client, db_path):
        """
        Verify that the failed_attempts column in the DB is actually
        incremented by each bad login (state is persistent within the test).
        """
        _insert_user(db_path)
        for i in range(1, MAX_FAILED_ATTEMPTS):
            client.post(
                "/api/v1/auth/login",
                json=_login_payload(password="wrong"),
                content_type="application/json",
            )
            conn = sqlite3.connect(db_path)
            row = conn.execute(
                "SELECT failed_attempts FROM Users WHERE email = ?",
                ("alice@example.com",),
            ).fetchone()
            conn.close()
            assert row[0] == i, f"After {i} failures, expected failed_attempts={i}"


# ══════════════════════════════════════════════════════════════════════════════
# Section E — 🔒 PADLOCK 4: Happy Path (HTTP 200)
# ══════════════════════════════════════════════════════════════════════════════

class TestPadlock4HappyPath:
    """
    REQ6 — Padlock 4:
    On successful authentication the system MUST:
      ✓ Return HTTP 200
      ✓ Set an HttpOnly cookie named 'auth_token' containing the JWT
      ✓ Return user metadata in the JSON body (user_id, email, full_name)
      ✓ NOT expose the raw JWT string anywhere in the JSON response body
    """

    def test_returns_200(self, client, db_path):
        _insert_user(db_path)
        rv = client.post(
            "/api/v1/auth/login",
            json=_login_payload(),
            content_type="application/json",
        )
        assert rv.status_code == 200

    def test_response_content_type_is_json(self, client, db_path):
        _insert_user(db_path)
        rv = client.post(
            "/api/v1/auth/login",
            json=_login_payload(),
            content_type="application/json",
        )
        assert "application/json" in rv.content_type

    def test_httponly_cookie_is_set(self, client, db_path):
        """The 'auth_token' cookie MUST have the HttpOnly flag."""
        _insert_user(db_path)
        rv = client.post(
            "/api/v1/auth/login",
            json=_login_payload(),
            content_type="application/json",
        )
        assert rv.status_code == 200

        set_cookie_header = rv.headers.get("Set-Cookie", "")
        assert "auth_token=" in set_cookie_header, "auth_token cookie not found"
        assert "HttpOnly" in set_cookie_header, (
            "auth_token cookie is missing the HttpOnly flag — XSS vulnerability!"
        )

    def test_cookie_value_is_non_empty_jwt(self, client, db_path):
        """The cookie value must look like a 3-part JWT (header.payload.sig)."""
        _insert_user(db_path)
        with client as c:
            rv = c.post(
                "/api/v1/auth/login",
                json=_login_payload(),
                content_type="application/json",
            )
        cookie = next(
            (h for h in rv.headers.getlist("Set-Cookie") if h.startswith("auth_token=")),
            None,
        )
        assert cookie is not None
        token_value = cookie.split(";")[0].split("=", 1)[1]
        assert len(token_value.split(".")) == 3, (
            "Cookie value does not appear to be a valid JWT"
        )

    def test_token_not_in_json_body(self, client, db_path):
        """
        CRITICAL: The raw JWT string must NEVER appear in the JSON response body.
        The body should only carry user metadata.
        """
        _insert_user(db_path)
        rv = client.post(
            "/api/v1/auth/login",
            json=_login_payload(),
            content_type="application/json",
        )
        assert rv.status_code == 200

        # Retrieve the JWT value from the cookie
        cookie = next(
            (h for h in rv.headers.getlist("Set-Cookie") if h.startswith("auth_token=")),
            None,
        )
        assert cookie, "Expected auth_token cookie to be present"
        token_value = cookie.split(";")[0].split("=", 1)[1]

        # The token must not appear anywhere in the JSON body as a field value
        body_str = rv.get_data(as_text=True)
        assert token_value not in body_str, (
            "JWT token was found in the JSON response body — security violation!"
        )

    def test_json_body_does_not_contain_token_key(self, client, db_path):
        """None of the common token key names must be present in the body."""
        _insert_user(db_path)
        rv = client.post(
            "/api/v1/auth/login",
            json=_login_payload(),
            content_type="application/json",
        )
        body = rv.get_json() or {}
        forbidden_keys = {"token", "access_token", "auth_token", "jwt", "bearer"}
        found = forbidden_keys & set(body.keys())
        assert not found, f"Token key(s) found in response body: {found}"

    def test_json_body_contains_user_metadata(self, client, db_path):
        _insert_user(
            db_path,
            email="alice@example.com",
            full_name="Alice Test",
            plain_password="SecureP@ss1",
        )
        rv = client.post(
            "/api/v1/auth/login",
            json=_login_payload(),
            content_type="application/json",
        )
        body = rv.get_json()
        assert body is not None
        user = body.get("user", {})
        assert user.get("email") == "alice@example.com"
        assert user.get("full_name") == "Alice Test"
        assert "user_id" in user

    def test_internal_id_not_in_json_body(self, client, db_path):
        """The internal integer PK must never be exposed in the JSON response."""
        _insert_user(db_path)
        rv = client.post(
            "/api/v1/auth/login",
            json=_login_payload(),
            content_type="application/json",
        )
        body = rv.get_json() or {}
        user = body.get("user", {})
        assert "id" not in user, "Internal integer PK leaked to client!"

    def test_success_resets_failed_attempts_in_db(self, client, db_path):
        """
        After a successful login, failed_attempts must be 0 and
        lockout_expires_at must be NULL in the database.
        """
        # Pre-load 3 failures then succeed
        _insert_user(db_path, failed_attempts=3)
        rv = client.post(
            "/api/v1/auth/login",
            json=_login_payload(),
            content_type="application/json",
        )
        assert rv.status_code == 200

        conn = sqlite3.connect(db_path)
        row = conn.execute(
            "SELECT failed_attempts, lockout_expires_at FROM Users WHERE email = ?",
            ("alice@example.com",),
        ).fetchone()
        conn.close()

        assert row[0] == 0, "failed_attempts was not reset after successful login"
        assert row[1] is None, "lockout_expires_at was not cleared after successful login"

    def test_email_login_is_case_insensitive(self, client, db_path):
        """Login with UPPERCASE email must work for a lowercase-stored address."""
        _insert_user(db_path, email="alice@example.com")
        rv = client.post(
            "/api/v1/auth/login",
            json=_login_payload(email="ALICE@EXAMPLE.COM"),
            content_type="application/json",
        )
        assert rv.status_code == 200

    def test_multiple_independent_users(self, client, db_path):
        """Separate users must authenticate independently without interference."""
        _insert_user(db_path, user_id="u-001", email="alice@example.com", plain_password="AliceP@ss1")
        _insert_user(db_path, user_id="u-002", email="bob@example.com",   plain_password="BobP@ss1!")

        rv_alice = client.post(
            "/api/v1/auth/login",
            json=_login_payload(email="alice@example.com", password="AliceP@ss1"),
            content_type="application/json",
        )
        rv_bob = client.post(
            "/api/v1/auth/login",
            json=_login_payload(email="bob@example.com", password="BobP@ss1!"),
            content_type="application/json",
        )
        assert rv_alice.status_code == 200
        assert rv_bob.status_code == 200

        # Each user gets their own distinct cookie / JWT
        cookie_alice = next(
            (h for h in rv_alice.headers.getlist("Set-Cookie") if "auth_token=" in h), ""
        )
        cookie_bob = next(
            (h for h in rv_bob.headers.getlist("Set-Cookie") if "auth_token=" in h), ""
        )
        assert cookie_alice != cookie_bob
