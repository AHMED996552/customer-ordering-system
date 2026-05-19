"""
auth_service.py — UC-7: Authenticate User Identity  (REQ6)

Implements the 4-Padlock Security Chain:
  PADLOCK 1 — Rate Limiting / Account Lockout  → HTTP 429
  PADLOCK 2 — User Enumeration Guard           → HTTP 401
  PADLOCK 3 — Unverified / Inactive Account    → HTTP 403
  PADLOCK 4 — Happy Path                       → HTTP 200

Database schema (Users table):
  id                 INTEGER PRIMARY KEY AUTOINCREMENT
  user_id            TEXT UNIQUE NOT NULL          ← external UUID
  email              TEXT UNIQUE NOT NULL
  password_hash      TEXT NOT NULL
  full_name          TEXT NOT NULL
  phone_number       TEXT
  status             TEXT DEFAULT 'PENDING_VERIFICATION'
  failed_attempts    INTEGER DEFAULT 0
  lockout_expires_at DATETIME                      ← UTC, '%Y-%m-%d %H:%M:%S'
  created_at         TEXT NOT NULL
  otp_code           TEXT
  otp_expires_at     TEXT

All public functions are pure; they accept explicit parameters so that
unit tests can exercise them WITHOUT touching a real database.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt as pyjwt

# ── Constants ──────────────────────────────────────────────────────────────────
MAX_FAILED_ATTEMPTS: int = 5           # lock after this many consecutive failures
LOCKOUT_DURATION_MINUTES: int = 10     # REQ6: 10-minute window
JWT_ALGORITHM: str = "HS256"
JWT_TTL_HOURS: int = 8

# Single generic message — never reveal WHICH credential is wrong (Padlock 2)
_GENERIC_AUTH_ERROR: str = "Invalid email or password."


# ══════════════════════════════════════════════════════════════════════════════
# Section 1 ─ Password utilities (pure, no DB, no Flask)
# ══════════════════════════════════════════════════════════════════════════════

def hash_password(plain: str) -> str:
    """
    Hash a plaintext password with bcrypt (work factor 12).

    Returns the UTF-8 decoded hash string ready to be stored in the DB.
    Raises ValueError for empty input.
    """
    if not plain:
        raise ValueError("Password must not be empty.")
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(plain.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """
    Constant-time comparison of *plain* against the stored bcrypt *hashed* string.

    Returns True if they match, False otherwise.
    Never raises on mismatched hash — only raises if arguments are blank.
    """
    if not plain or not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ══════════════════════════════════════════════════════════════════════════════
# Section 2 ─ JWT utilities (pure, no DB, no Flask)
# ══════════════════════════════════════════════════════════════════════════════

def generate_jwt(payload: dict, secret: str) -> str:
    """
    Sign *payload* with HMAC-SHA256 and return the encoded JWT string.

    The caller is responsible for adding 'exp'/'iat' claims.
    Raises ValueError when *secret* is falsy.
    """
    if not secret:
        raise ValueError("JWT secret must not be empty.")
    return pyjwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


def decode_jwt(token: str, secret: str) -> dict:
    """
    Validate and decode a JWT string.

    Returns the decoded payload dict on success.
    Raises:
        jwt.ExpiredSignatureError  — token has expired
        jwt.InvalidTokenError      — any other validation failure
        ValueError                 — blank token or secret
    """
    if not token or not secret:
        raise ValueError("Token and secret must not be empty.")
    return pyjwt.decode(token, secret, algorithms=[JWT_ALGORITHM])


def build_token_payload(user: dict) -> dict:
    """
    Construct the standard JWT claims dict for a successfully authenticated user.

    Embeds:
      sub  — internal integer PK (never returned to the client in JSON)
      uid  — external TEXT UUID (safe to embed in token claims)
      email
      iat / exp
    """
    now = datetime.now(timezone.utc)
    return {
        "sub": str(user["id"]),    # RFC 7519 §4.1.2: sub MUST be a string
        "uid": user["user_id"],
        "email": user["email"],
        "iat": now,
        "exp": now + timedelta(hours=JWT_TTL_HOURS),
    }


# ══════════════════════════════════════════════════════════════════════════════
# Section 3 ─ Core authentication flow (requires DB)
# ══════════════════════════════════════════════════════════════════════════════

def authenticate_user(
    db_path: str,
    email: str,
    password: str,
) -> dict:
    """
    Validate credentials against the Users table and enforce all 4 Padlocks.

    Returns:
        { "id": int, "user_id": str, "email": str, "full_name": str }

    Raises:
        _AuthServiceError(429) — account temporarily locked  (Padlock 1)
        _AuthServiceError(401) — bad credentials             (Padlock 2)
        _AuthServiceError(403) — account not ACTIVE          (Padlock 3)
    """
    conn = _get_conn(db_path)
    try:
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT id, user_id, email, password_hash, full_name,
                   status, failed_attempts, lockout_expires_at
            FROM Users
            WHERE email = ?
            """,
            (email.strip().lower(),),
        )
        row = cursor.fetchone()

        # ── PADLOCK 1: Rate Limit ─────────────────────────────────────────────
        # Must run BEFORE the password check so a locked account stays locked
        # even when the correct password is eventually supplied.
        # We only check if the row exists; a missing email always yields 401.
        if row:
            (row_id, user_id, db_email, password_hash, full_name,
             status, failed_attempts, lockout_expires_at) = row

            if lockout_expires_at:
                lockout_dt = _parse_dt(lockout_expires_at)
                if lockout_dt and datetime.now(timezone.utc) < lockout_dt:
                    remaining = (
                        int((lockout_dt - datetime.now(timezone.utc)).total_seconds() / 60) + 1
                    )
                    raise _rate_limit_error(
                        f"Too many failed attempts. "
                        f"Account locked for ~{remaining} more minute(s)."
                    )

        # ── PADLOCK 2: User Enumeration Guard ─────────────────────────────────
        # Unknown e-mail → same generic 401 as wrong password
        if not row:
            raise _auth_error()

        (row_id, user_id, db_email, password_hash, full_name,
         status, failed_attempts, lockout_expires_at) = row

        password_valid = verify_password(password, password_hash)

        if not password_valid:
            _record_failed_attempt(conn, row_id, failed_attempts)
            conn.commit()
            raise _auth_error()

        # ── PADLOCK 3: Unverified / Inactive Account ──────────────────────────
        if status != "ACTIVE":
            raise _forbidden_error(
                "Your account is not active. "
                "Please verify your email or contact support."
            )

        # ── PADLOCK 4: Happy Path ─────────────────────────────────────────────
        cursor.execute(
            """
            UPDATE Users
            SET failed_attempts = 0, lockout_expires_at = NULL
            WHERE id = ?
            """,
            (row_id,),
        )
        conn.commit()

        return {
            "id": row_id,
            "user_id": user_id,
            "email": db_email,
            "full_name": full_name,
        }

    finally:
        conn.close()


# ══════════════════════════════════════════════════════════════════════════════
# Section 4 ─ Internal helpers
# ══════════════════════════════════════════════════════════════════════════════

def _get_conn(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    return conn


def _record_failed_attempt(
    conn: sqlite3.Connection,
    row_id: int,
    current_attempts: int,
) -> None:
    """Increment failed_attempts and set lockout_expires_at when threshold is hit."""
    new_attempts = current_attempts + 1
    lockout_expires_at: Optional[str] = None

    if new_attempts >= MAX_FAILED_ATTEMPTS:
        lockout_dt = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        lockout_expires_at = lockout_dt.strftime("%Y-%m-%d %H:%M:%S")

    conn.execute(
        """
        UPDATE Users
        SET failed_attempts = ?, lockout_expires_at = ?
        WHERE id = ?
        """,
        (new_attempts, lockout_expires_at, row_id),
    )


def _parse_dt(value: str) -> Optional[datetime]:
    """Parse a '%Y-%m-%d %H:%M:%S' UTC string → timezone-aware datetime."""
    if not value:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


# ── Exception hierarchy ────────────────────────────────────────────────────────

class _AuthServiceError(Exception):
    """Carries an HTTP status code so the route layer can map it directly."""

    def __init__(self, message: str, status_code: int) -> None:
        super().__init__(message)
        self.status_code = status_code


def _rate_limit_error(msg: str) -> _AuthServiceError:
    return _AuthServiceError(msg, 429)


def _auth_error() -> _AuthServiceError:
    return _AuthServiceError(_GENERIC_AUTH_ERROR, 401)


def _forbidden_error(msg: str) -> _AuthServiceError:
    return _AuthServiceError(msg, 403)
