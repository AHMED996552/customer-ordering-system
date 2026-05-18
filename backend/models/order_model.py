"""
backend/models/order_model.py
------------------------------
Database interaction layer for UC-10: Cancel a Placed Order.

All queries include ``AND user_id = ?`` so IDOR is structurally impossible
even if the service layer has a bug.

Schema expected (extended from base schema.py):
    Orders (
        order_id          TEXT PRIMARY KEY,          -- e.g. "ORD-20260510-001"
        user_id           TEXT NOT NULL,             -- FK → Users.user_id
        status            TEXT NOT NULL,             -- PENDING / ACCEPTED / ...
        created_at        TEXT NOT NULL,             -- ISO-8601 UTC string
        total_egp         REAL NOT NULL,
        payment_reference TEXT UNIQUE NOT NULL,
        cancelled_at      TEXT                       -- NULL until cancelled
    )

Run ``ensure_orders_schema(db_path)`` at startup to add any missing columns
to an existing database without destructive migration.
"""

import sqlite3
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# ── Format used when writing timestamps to SQLite ─────────────────────────────
_DT_FMT = "%Y-%m-%dT%H:%M:%SZ"


# ── Connection helper ──────────────────────────────────────────────────────────

def _get_conn(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    return conn


def _parse_dt(value: str) -> Optional[datetime]:
    """Parse a UTC datetime string (ISO-8601 or SQLite default) → aware datetime."""
    if not value:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    logger.warning("order_model: could not parse datetime string %r", value)
    return None


# ── Schema upgrade (non-destructive) ──────────────────────────────────────────

def ensure_orders_schema(db_path: str) -> None:
    """
    Adds columns required by UC-10 to an existing Orders table if they are
    absent.  Safe to call at every startup — uses ALTER TABLE … ADD COLUMN
    which is a no-op when the column already exists (guarded by try/except).
    """
    extra_columns = [
        ("user_id",           "TEXT NOT NULL DEFAULT ''"),
        ("total_egp",         "REAL NOT NULL DEFAULT 0.0"),
        ("cancelled_at",      "TEXT"),
        ("payment_reference", "TEXT"),
    ]
    conn = _get_conn(db_path)
    try:
        for col_name, col_def in extra_columns:
            try:
                conn.execute(
                    f"ALTER TABLE Orders ADD COLUMN {col_name} {col_def}"
                )
                conn.commit()
                logger.info("order_model: added column Orders.%s", col_name)
            except sqlite3.OperationalError:
                # Column already exists — silently continue
                pass
    finally:
        conn.close()


# ── Public read API ────────────────────────────────────────────────────────────

def get_order_by_id(
    db_path: str,
    order_id: str,
    user_id: str,
) -> Optional[dict]:
    """
    Fetch an order that belongs **exclusively** to *user_id*.

    Returns ``None`` (not an exception) when:
      - the order_id does not exist, OR
      - the order belongs to a different user.

    The service layer converts ``None`` → ``OrderAccessDeniedError`` so the
    HTTP response is structurally identical in both cases (prevents IDOR /
    order-ID enumeration).
    """
    conn = _get_conn(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT order_id, user_id, status, created_at,
                   total_egp, payment_reference, cancelled_at
            FROM   Orders
            WHERE  order_id = ?
              AND  user_id  = ?
            """,
            (order_id, user_id),
        )
        row = cursor.fetchone()
        if row is None:
            return None

        data = dict(row)
        # Hydrate created_at to a timezone-aware datetime for the service layer
        data["created_at"] = _parse_dt(data.get("created_at", ""))
        return data
    finally:
        conn.close()


# ── Atomic write (Atomicity Guard) ────────────────────────────────────────────

def cancel_order_atomically(
    db_path: str,
    order_id: str,
    user_id: str,
    refund_reference: str,
    cancelled_at: datetime,
) -> None:
    """
    Atomicity Guard — wraps the DB status UPDATE in an explicit transaction.

    On success:
        - ``Orders.status``        → ``'CANCELLED'``
        - ``Orders.cancelled_at``  → server-generated UTC timestamp
        - ``Orders.refund_status`` → ``'INITIATED'`` (if column exists)

    On any DB failure:
        - Transaction is rolled back.
        - The caller (order_service) must then raise ``RefundFailedError``
          so that ``order.status`` remains ``'PENDING'`` in the database.
    """
    cancelled_at_str = cancelled_at.strftime(_DT_FMT)

    conn = _get_conn(db_path)
    try:
        conn.execute("BEGIN")
        conn.execute(
            """
            UPDATE Orders
               SET status       = 'CANCELLED',
                   cancelled_at = ?
             WHERE order_id = ?
               AND user_id  = ?
               AND status   = 'PENDING'
            """,
            (cancelled_at_str, order_id, user_id),
        )
        conn.commit()
        logger.info(
            "order_model: order %s cancelled atomically (refund=%s)",
            order_id,
            refund_reference,
        )
    except Exception:
        conn.rollback()
        logger.error(
            "order_model: DB rollback triggered for order %s", order_id, exc_info=True
        )
        raise
    finally:
        conn.close()
