"""
tests/test_auth_unit.py — UC-7: Pure Unit Tests (REQ6)

Constraint: NO Flask test client. NO SQLite connection.
            All database I/O is mocked via unittest.mock.

Coverage matrix
───────────────────────────────────────────────────────────────────────────────
  hash_password       │ happy path · empty input raises ValueError
  verify_password     │ correct / wrong / empty args
  generate_jwt        │ happy path · empty secret raises ValueError
  decode_jwt          │ valid token · expired token · tampered token · blank args
  build_token_payload │ claim keys present · exp > iat
  _parse_dt           │ valid string · invalid string · blank string
  _record_failed_attempt │ below threshold · at threshold (lockout set)
  authenticate_user   │ unknown email (401) · wrong password (401) ·
                      │ account locked (429) · status != ACTIVE (403) ·
                      │ happy path (200-payload) · reset on success
───────────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch, call
import time

import pytest

from backend.services.auth_service import (
    # public utils
    hash_password,
    verify_password,
    generate_jwt,
    decode_jwt,
    build_token_payload,
    # core flow
    authenticate_user,
    # internal helpers exposed for targeted unit testing
    _parse_dt,
    _record_failed_attempt,
    _AuthServiceError,
    _GENERIC_AUTH_ERROR,
    MAX_FAILED_ATTEMPTS,
    LOCKOUT_DURATION_MINUTES,
    JWT_ALGORITHM,
)

import jwt as pyjwt


# ══════════════════════════════════════════════════════════════════════════════
# Fixtures / helpers
# ══════════════════════════════════════════════════════════════════════════════

_SECRET = "unit-test-secret-key"


def _make_user_row(
    *,
    row_id: int = 1,
    user_id: str = "uuid-abc",
    email: str = "user@example.com",
    password_hash: str | None = None,
    full_name: str = "Test User",
    status: str = "ACTIVE",
    failed_attempts: int = 0,
    lockout_expires_at: str | None = None,
) -> tuple:
    """Return a plain tuple that mirrors what sqlite3 returns for a Users row."""
    if password_hash is None:
        password_hash = hash_password("CorrectP@ss1")
    return (
        row_id, user_id, email, password_hash,
        full_name, status, failed_attempts, lockout_expires_at,
    )


# ══════════════════════════════════════════════════════════════════════════════
# 1. hash_password
# ══════════════════════════════════════════════════════════════════════════════

class TestHashPassword:

    def test_returns_bcrypt_string(self):
        result = hash_password("MyP@ssword1")
        assert result.startswith("$2b$") or result.startswith("$2a$")

    def test_different_hashes_for_same_plain(self):
        h1 = hash_password("SamePass1!")
        h2 = hash_password("SamePass1!")
        assert h1 != h2, "bcrypt must produce a unique salt each call"

    def test_empty_password_raises(self):
        with pytest.raises(ValueError, match="must not be empty"):
            hash_password("")

    def test_returns_string_not_bytes(self):
        assert isinstance(hash_password("AnyPass1!"), str)


# ══════════════════════════════════════════════════════════════════════════════
# 2. verify_password
# ══════════════════════════════════════════════════════════════════════════════

class TestVerifyPassword:

    def test_correct_password_returns_true(self):
        plain = "CorrectHorse99!"
        hashed = hash_password(plain)
        assert verify_password(plain, hashed) is True

    def test_wrong_password_returns_false(self):
        hashed = hash_password("CorrectHorse99!")
        assert verify_password("WrongPassword!", hashed) is False

    def test_empty_plain_returns_false(self):
        hashed = hash_password("SomePass1!")
        assert verify_password("", hashed) is False

    def test_empty_hash_returns_false(self):
        assert verify_password("SomePass1!", "") is False

    def test_both_empty_returns_false(self):
        assert verify_password("", "") is False

    def test_garbage_hash_returns_false(self):
        assert verify_password("pass", "not-a-valid-bcrypt-hash") is False


# ══════════════════════════════════════════════════════════════════════════════
# 3. generate_jwt
# ══════════════════════════════════════════════════════════════════════════════

class TestGenerateJwt:

    def test_returns_string(self):
        payload = {"sub": 1, "uid": "abc"}
        token = generate_jwt(payload, _SECRET)
        assert isinstance(token, str)
        assert len(token.split(".")) == 3  # header.payload.signature

    def test_token_is_decodable(self):
        # PyJWT ≥ 2.4 (RFC 7519 §4.1.2): sub must be a string
        payload = {"sub": "42", "uid": "xyz", "email": "a@b.com"}
        token = generate_jwt(payload, _SECRET)
        decoded = pyjwt.decode(token, _SECRET, algorithms=[JWT_ALGORITHM])
        assert decoded["sub"] == "42"
        assert decoded["uid"] == "xyz"

    def test_empty_secret_raises(self):
        with pytest.raises(ValueError, match="must not be empty"):
            generate_jwt({"sub": 1}, "")

    def test_none_secret_raises(self):
        with pytest.raises(ValueError, match="must not be empty"):
            generate_jwt({"sub": 1}, None)  # type: ignore[arg-type]


# ══════════════════════════════════════════════════════════════════════════════
# 4. decode_jwt
# ══════════════════════════════════════════════════════════════════════════════

class TestDecodeJwt:

    def test_valid_token_returns_payload(self):
        # sub must be a string (RFC 7519 §4.1.2, enforced by PyJWT ≥ 2.4)
        payload = {"sub": "7", "uid": "u-007"}
        token = generate_jwt(payload, _SECRET)
        result = decode_jwt(token, _SECRET)
        assert result["sub"] == "7"

    def test_wrong_secret_raises_invalid_token(self):
        token = generate_jwt({"sub": 1}, _SECRET)
        with pytest.raises(pyjwt.InvalidTokenError):
            decode_jwt(token, "wrong-secret")

    def test_expired_token_raises(self):
        now = datetime.now(timezone.utc)
        payload = {
            "sub": 1,
            "iat": now - timedelta(hours=9),
            "exp": now - timedelta(hours=1),   # already expired
        }
        token = generate_jwt(payload, _SECRET)
        with pytest.raises(pyjwt.ExpiredSignatureError):
            decode_jwt(token, _SECRET)

    def test_tampered_token_raises(self):
        token = generate_jwt({"sub": 1}, _SECRET)
        parts = token.split(".")
        tampered = parts[0] + "." + parts[1] + "TAMPER." + parts[2]
        with pytest.raises(pyjwt.InvalidTokenError):
            decode_jwt(tampered, _SECRET)

    def test_blank_token_raises(self):
        with pytest.raises(ValueError):
            decode_jwt("", _SECRET)

    def test_blank_secret_raises(self):
        token = generate_jwt({"sub": 1}, _SECRET)
        with pytest.raises(ValueError):
            decode_jwt(token, "")


# ══════════════════════════════════════════════════════════════════════════════
# 5. build_token_payload
# ══════════════════════════════════════════════════════════════════════════════

class TestBuildTokenPayload:

    def _sample_user(self) -> dict:
        return {"id": 3, "user_id": "u-003", "email": "x@y.com", "full_name": "X Y"}

    def test_required_claims_present(self):
        payload = build_token_payload(self._sample_user())
        for claim in ("sub", "uid", "email", "iat", "exp"):
            assert claim in payload, f"Missing claim: {claim}"

    def test_sub_is_internal_id(self):
        # RFC 7519 §4.1.2: sub must be a string; build_token_payload casts int → str
        payload = build_token_payload(self._sample_user())
        assert payload["sub"] == "3"

    def test_uid_is_external_uuid(self):
        payload = build_token_payload(self._sample_user())
        assert payload["uid"] == "u-003"

    def test_exp_after_iat(self):
        payload = build_token_payload(self._sample_user())
        assert payload["exp"] > payload["iat"]

    def test_full_name_not_in_payload(self):
        """full_name must NOT be embedded in the JWT claims."""
        payload = build_token_payload(self._sample_user())
        assert "full_name" not in payload


# ══════════════════════════════════════════════════════════════════════════════
# 6. _parse_dt (internal helper)
# ══════════════════════════════════════════════════════════════════════════════

class TestParseDt:

    def test_valid_datetime_string(self):
        result = _parse_dt("2025-06-15 10:30:00")
        assert result is not None
        assert result.tzinfo == timezone.utc
        assert result.year == 2025

    def test_blank_string_returns_none(self):
        assert _parse_dt("") is None

    def test_none_returns_none(self):
        assert _parse_dt(None) is None  # type: ignore[arg-type]

    def test_garbage_string_returns_none(self):
        assert _parse_dt("not-a-date") is None

    def test_iso_t_format_parsed(self):
        result = _parse_dt("2025-06-15T10:30:00")
        assert result is not None
        assert result.hour == 10


# ══════════════════════════════════════════════════════════════════════════════
# 7. _record_failed_attempt (internal helper, uses a mock DB connection)
# ══════════════════════════════════════════════════════════════════════════════

class TestRecordFailedAttempt:

    def _mock_conn(self) -> MagicMock:
        conn = MagicMock(spec=sqlite3.Connection)
        return conn

    def test_increments_attempts_no_lockout_below_threshold(self):
        conn = self._mock_conn()
        _record_failed_attempt(conn, row_id=1, current_attempts=2)
        # Should update to 3 with no lockout_expires_at
        conn.execute.assert_called_once()
        args = conn.execute.call_args[0]  # positional args tuple
        params = args[1]
        new_attempts, lockout_expires_at, row_id = params
        assert new_attempts == 3
        assert lockout_expires_at is None
        assert row_id == 1

    def test_sets_lockout_at_threshold(self):
        conn = self._mock_conn()
        # current_attempts = 4 → new = 5 → threshold reached
        _record_failed_attempt(conn, row_id=5, current_attempts=MAX_FAILED_ATTEMPTS - 1)
        args = conn.execute.call_args[0]
        params = args[1]
        new_attempts, lockout_expires_at, _ = params
        assert new_attempts == MAX_FAILED_ATTEMPTS
        assert lockout_expires_at is not None, "lockout must be set at threshold"

    def test_lockout_duration_is_correct(self):
        conn = self._mock_conn()
        # Floor to whole seconds to match strftime("%Y-%m-%d %H:%M:%S") resolution
        before = datetime.now(timezone.utc).replace(microsecond=0)
        _record_failed_attempt(conn, row_id=1, current_attempts=MAX_FAILED_ATTEMPTS - 1)
        after = datetime.now(timezone.utc).replace(microsecond=0)

        args = conn.execute.call_args[0]
        lockout_str = args[1][1]
        lockout_dt = datetime.strptime(lockout_str, "%Y-%m-%d %H:%M:%S").replace(
            tzinfo=timezone.utc
        )
        expected_min = before + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        expected_max = after + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        assert expected_min <= lockout_dt <= expected_max


# ══════════════════════════════════════════════════════════════════════════════
# 8. authenticate_user — all DB interactions mocked
# ══════════════════════════════════════════════════════════════════════════════

class TestAuthenticateUser:
    """
    All tests patch _get_conn so ZERO real SQLite connections are made.
    """

    _DB = ":memory:"   # placeholder — never actually opened

    # ── helper ────────────────────────────────────────────────────────────────

    def _patch_conn(self, row, commit=True):
        """
        Return a context manager that patches _get_conn.

        *row* is what cursor.fetchone() returns; pass None to simulate
        'user not found'.
        """
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.fetchone.return_value = row
        return patch(
            "backend.services.auth_service._get_conn",
            return_value=mock_conn,
        ), mock_conn, mock_cursor

    # ── Padlock 2 ─────────────────────────────────────────────────────────────

    def test_unknown_email_raises_401(self):
        ctx, mock_conn, _ = self._patch_conn(row=None)
        with ctx:
            with pytest.raises(_AuthServiceError) as exc_info:
                authenticate_user(self._DB, "ghost@noemail.com", "irrelevant")
        err = exc_info.value
        assert err.status_code == 401
        assert err.args[0] == _GENERIC_AUTH_ERROR

    def test_wrong_password_raises_401(self):
        hashed = hash_password("CorrectP@ss1")
        row = _make_user_row(password_hash=hashed)
        ctx, mock_conn, _ = self._patch_conn(row=row)
        with ctx:
            with pytest.raises(_AuthServiceError) as exc_info:
                authenticate_user(self._DB, "user@example.com", "WrongPassword!")
        err = exc_info.value
        assert err.status_code == 401
        assert err.args[0] == _GENERIC_AUTH_ERROR

    def test_wrong_password_and_unknown_email_return_identical_message(self):
        """REQ6 Padlock 2: enumeration guard — messages must be byte-identical."""
        hashed = hash_password("CorrectP@ss1")
        row = _make_user_row(password_hash=hashed)

        ctx_bad_pass, _, _ = self._patch_conn(row=row)
        with ctx_bad_pass:
            with pytest.raises(_AuthServiceError) as ei_bad_pass:
                authenticate_user(self._DB, "user@example.com", "WrongPassword!")

        ctx_no_user, _, _ = self._patch_conn(row=None)
        with ctx_no_user:
            with pytest.raises(_AuthServiceError) as ei_no_user:
                authenticate_user(self._DB, "ghost@noemail.com", "irrelevant")

        assert ei_bad_pass.value.args[0] == ei_no_user.value.args[0]

    # ── Padlock 1 ─────────────────────────────────────────────────────────────

    def test_locked_account_raises_429(self):
        future = (
            datetime.now(timezone.utc) + timedelta(minutes=5)
        ).strftime("%Y-%m-%d %H:%M:%S")
        row = _make_user_row(
            failed_attempts=MAX_FAILED_ATTEMPTS,
            lockout_expires_at=future,
        )
        ctx, _, _ = self._patch_conn(row=row)
        with ctx:
            with pytest.raises(_AuthServiceError) as exc_info:
                authenticate_user(self._DB, "user@example.com", "AnyPassword!")
        assert exc_info.value.status_code == 429

    def test_expired_lockout_is_ignored(self):
        """A lockout timestamp in the past must NOT block the login."""
        past = (
            datetime.now(timezone.utc) - timedelta(minutes=1)
        ).strftime("%Y-%m-%d %H:%M:%S")
        hashed = hash_password("CorrectP@ss1")
        row = _make_user_row(
            password_hash=hashed,
            status="ACTIVE",
            failed_attempts=MAX_FAILED_ATTEMPTS,
            lockout_expires_at=past,
        )
        ctx, mock_conn, _ = self._patch_conn(row=row)
        with ctx:
            result = authenticate_user(self._DB, "user@example.com", "CorrectP@ss1")
        assert result["email"] == "user@example.com"

    # ── Padlock 3 ─────────────────────────────────────────────────────────────

    def test_pending_verification_raises_403(self):
        hashed = hash_password("CorrectP@ss1")
        row = _make_user_row(password_hash=hashed, status="PENDING_VERIFICATION")
        ctx, _, _ = self._patch_conn(row=row)
        with ctx:
            with pytest.raises(_AuthServiceError) as exc_info:
                authenticate_user(self._DB, "user@example.com", "CorrectP@ss1")
        assert exc_info.value.status_code == 403

    def test_locked_status_raises_403(self):
        hashed = hash_password("CorrectP@ss1")
        row = _make_user_row(password_hash=hashed, status="LOCKED")
        ctx, _, _ = self._patch_conn(row=row)
        with ctx:
            with pytest.raises(_AuthServiceError) as exc_info:
                authenticate_user(self._DB, "user@example.com", "CorrectP@ss1")
        assert exc_info.value.status_code == 403

    # ── Padlock 4 ─────────────────────────────────────────────────────────────

    def test_happy_path_returns_user_dict(self):
        hashed = hash_password("CorrectP@ss1")
        row = _make_user_row(
            row_id=7, user_id="uuid-007",
            email="user@example.com",
            password_hash=hashed,
            full_name="John Doe",
            status="ACTIVE",
        )
        ctx, _, _ = self._patch_conn(row=row)
        with ctx:
            result = authenticate_user(self._DB, "user@example.com", "CorrectP@ss1")

        assert result["id"] == 7
        assert result["user_id"] == "uuid-007"
        assert result["email"] == "user@example.com"
        assert result["full_name"] == "John Doe"

    def test_happy_path_resets_failed_attempts(self):
        hashed = hash_password("CorrectP@ss1")
        row = _make_user_row(password_hash=hashed, status="ACTIVE", failed_attempts=3)
        ctx, mock_conn, mock_cursor = self._patch_conn(row=row)
        with ctx:
            authenticate_user(self._DB, "user@example.com", "CorrectP@ss1")

        # The UPDATE that resets counters must have been executed
        executed_sql_calls = [str(c) for c in mock_cursor.execute.call_args_list]
        reset_calls = [s for s in executed_sql_calls if "failed_attempts = 0" in s]
        assert reset_calls, "Counter reset UPDATE was not executed on happy path"

    def test_failed_attempt_incremented_on_wrong_password(self):
        hashed = hash_password("CorrectP@ss1")
        row = _make_user_row(password_hash=hashed, failed_attempts=1)
        ctx, mock_conn, _ = self._patch_conn(row=row)
        with ctx:
            with pytest.raises(_AuthServiceError):
                authenticate_user(self._DB, "user@example.com", "WrongPass!")
        # _record_failed_attempt calls conn.execute; commit must also be called
        mock_conn.commit.assert_called()

    def test_email_normalised_to_lowercase(self):
        """authenticate_user must strip + lowercase the email before querying."""
        hashed = hash_password("CorrectP@ss1")
        row = _make_user_row(password_hash=hashed, status="ACTIVE")
        ctx, _, mock_cursor = self._patch_conn(row=row)
        with ctx:
            authenticate_user(self._DB, "  USER@EXAMPLE.COM  ", "CorrectP@ss1")

        # First cursor.execute call is the SELECT; its parameter must be lowercased
        select_call = mock_cursor.execute.call_args_list[0]
        queried_email = select_call[0][1][0]   # positional arg tuple → first param
        assert queried_email == "user@example.com"
