"""
auth_service.py — UC-7: Authenticate User Identity
Implements the 4-Padlock Security Chain (REQ6):
  PADLOCK 1 — Rate Limiting / Account Lockout  (HTTP 429)
  PADLOCK 2 — User Enumeration Guard           (HTTP 401)
  PADLOCK 3 — Unverified Email Guard           (HTTP 403)
  PADLOCK 4 — Happy Path                       (HTTP 200)
"""

import sqlite3
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional

# ── Constants ──────────────────────────────────────────────────────────────────
MAX_FAILED_ATTEMPTS: int = 5          # REQ6: lock after N failures
LOCKOUT_DURATION_MINUTES: int = 15    # REQ6: lock window
_GENERIC_AUTH_ERROR: str = "Invalid email or password."   # enumeration guard


# ── Public API ─────────────────────────────────────────────────────────────────

def authenticate_user(
    db_path: str,
    email: str,
    password: str,
) -> dict:
    """
    Validates credentials against the Users table.

    Returns a dict:
        { "user_id": int, "email": str, "full_name": str }

    Raises:
        PermissionError(429_code)  — account temporarily locked (rate limit)
        PermissionError(401_code)  — bad credentials (enumeration-safe)
        PermissionError(403_code)  — account not active / email unverified
    """
    conn = _get_conn(db_path)
    try:
        cursor = conn.cursor()

        # ── Fetch user row ────────────────────────────────────────────────────
        cursor.execute(
            """
            SELECT user_id, email, password_hash, full_name,
                   status, failed_attempts, lockout_expires_at
            FROM Users
            WHERE email = ?
            """,
            (email.strip().lower(),),
        )
        row = cursor.fetchone()

        # ── PADLOCK 1: Rate Limit (must run BEFORE password check) ────────────
        # We check lockout on the found row; if no row exists we still must
        # return a generic 401 (not 429) to avoid enumeration via status codes.
        if row:
            (user_id, db_email, password_hash, full_name,
             status, failed_attempts, lockout_expires_at) = row

            if lockout_expires_at:
                lockout_dt = _parse_dt(lockout_expires_at)
                if lockout_dt and datetime.now(timezone.utc) < lockout_dt:
                    remaining = int(
                        (lockout_dt - datetime.now(timezone.utc)).total_seconds() / 60
                    ) + 1
                    raise _rate_limit_error(
                        f"Too many failed attempts. "
                        f"Account locked for ~{remaining} more minute(s)."
                    )

        # ── PADLOCK 2: User Enumeration Guard ─────────────────────────────────
        if not row:
            raise _auth_error()

        (user_id, db_email, password_hash, full_name,
         status, failed_attempts, lockout_expires_at) = row

        # Constant-time password check
        password_valid = bcrypt.checkpw(
            password.encode("utf-8"),
            password_hash.encode("utf-8"),
        )

        if not password_valid:
            # Increment failed_attempts and maybe lock
            _record_failed_attempt(conn, user_id, failed_attempts)
            conn.commit()
            raise _auth_error()

        # ── PADLOCK 3: Unverified / Inactive Account ──────────────────────────
        if status != "ACTIVE":
            raise _forbidden_error(
                "Your account is not active. "
                "Please verify your email or contact support."
            )

        # ── PADLOCK 4: Happy Path — reset counters and return payload ─────────
        cursor.execute(
            """
            UPDATE Users
            SET failed_attempts = 0, lockout_expires_at = NULL
            WHERE user_id = ?
            """,
            (user_id,),
        )
        conn.commit()

        return {
            "user_id": user_id,
            "email": db_email,
            "full_name": full_name,
        }

    finally:
        conn.close()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_conn(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    return conn


def _record_failed_attempt(
    conn: sqlite3.Connection,
    user_id: int,
    current_attempts: int,
) -> None:
    """Increments the counter; sets lockout if threshold crossed."""
    new_attempts = current_attempts + 1
    lockout_expires_at: Optional[str] = None

    if new_attempts >= MAX_FAILED_ATTEMPTS:
        lockout_dt = datetime.now(timezone.utc) + timedelta(
            minutes=LOCKOUT_DURATION_MINUTES
        )
        lockout_expires_at = lockout_dt.strftime("%Y-%m-%d %H:%M:%S")

    conn.execute(
        """
        UPDATE Users
        SET failed_attempts = ?, lockout_expires_at = ?
        WHERE user_id = ?
        """,
        (new_attempts, lockout_expires_at, user_id),
    )


def _parse_dt(value: str) -> Optional[datetime]:
    """Parses a naive UTC datetime string and returns an aware datetime."""
    if not value:
        return None
    try:
        dt = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
        return dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


# Exception factories keep HTTP semantics out of this layer while still
# letting the route layer distinguish the four cases by a status_code attr.

class _AuthServiceError(Exception):
    def __init__(self, message: str, status_code: int):
        super().__init__(message)
        self.status_code = status_code


def _rate_limit_error(msg: str) -> _AuthServiceError:
    return _AuthServiceError(msg, 429)


def _auth_error() -> _AuthServiceError:
    return _AuthServiceError(_GENERIC_AUTH_ERROR, 401)


def _forbidden_error(msg: str) -> _AuthServiceError:
    return _AuthServiceError(msg, 403)


# ── Utility for tests / UC-6 (Register) to create users ──────────────────────

def hash_password(plain: str) -> str:
    """Returns a bcrypt hash string ready to store in password_hash column."""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
