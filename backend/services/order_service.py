"""
backend/services/order_service.py
-----------------------------------
UC-10: Cancel a Placed Order — Core Business Logic & Gate Orchestration.

Gate evaluation order (strict sequential — a failing gate short-circuits):
  Gate 1 — Ownership / IDOR Guard   →  403  ORDER_ACCESS_DENIED
  Gate 2 — Status Guard             →  409  ORDER_ALREADY_ACCEPTED
                                             ORDER_NOT_CANCELLABLE
                                             ORDER_ALREADY_CANCELLED
  Gate 3 — Time-Window Guard        →  409  CANCELLATION_WINDOW_EXPIRED
  Gate 4 — Atomicity Guard          →  502  REFUND_FAILED  (+ DB rollback)

Contract:
  - NO Flask imports (``request``, ``jsonify``, ``abort``) in this module.
  - Returns a plain Python ``dict`` on success.
  - Raises ``OrderServiceError`` subclasses on any gate failure.
  - The server UTC clock (``app.utils.time.server_utc_now``) is the SOLE
    temporal authority; no client-supplied timestamps are ever read.
"""

import logging
from datetime import timedelta

# Server-side UTC clock authority — patchable in tests via:
#   @patch('app.utils.time.server_utc_now')
from app.utils.time import server_utc_now

from backend.exceptions import (
    OrderAccessDeniedError,
    OrderAlreadyAcceptedError,
    OrderNotCancellableError,
    OrderAlreadyCancelledError,
    CancellationWindowExpiredError,
    RefundFailedError,
)
from backend.models.order_model import get_order_by_id, cancel_order_atomically
from backend.services.payment_gateway import initiate_refund

logger = logging.getLogger(__name__)

# REQ10: cancellation window in seconds (inclusive boundary at exactly 180s)
_CANCELLATION_WINDOW_SECONDS: int = 180


def cancel_order(db_path: str, order_id: str, user_id: str) -> dict:
    """
    Execute the 4-gate cancellation pipeline for *order_id* owned by *user_id*.

    Parameters
    ----------
    db_path : str
        Filesystem path to the SQLite database (from ``app.config``).
    order_id : str
        The order identifier supplied in the URL path.
    user_id : str
        The authenticated user's ID resolved from the server-side session
        cookie by the route layer.  Never derived from the request body.

    Returns
    -------
    dict
        Success payload matching the UC-10 API contract::

            {
              "order": {
                "order_id": str,
                "status": "CANCELLED",
                "cancelled_at": "<ISO-8601 UTC>",
                "refund": {
                  "refund_reference": str,
                  "amount_egp": float,
                  "status": "INITIATED"
                }
              },
              "message": str
            }

    Raises
    ------
    OrderAccessDeniedError      (HTTP 403) — Gate 1 failure
    OrderAlreadyAcceptedError   (HTTP 409) — Gate 2 failure
    OrderNotCancellableError    (HTTP 409) — Gate 2 failure
    OrderAlreadyCancelledError  (HTTP 409) — Gate 2 failure
    CancellationWindowExpiredError (HTTP 409) — Gate 3 failure
    RefundFailedError           (HTTP 502) — Gate 4 failure + implicit rollback
    """

    # ── Gate 1: Ownership / IDOR Guard ────────────────────────────────────────
    # The SQL query in get_order_by_id enforces "WHERE order_id=? AND user_id=?"
    # so a None return covers both "order not found" and "wrong owner" — both
    # produce an identical HTTP 403 to block enumeration.
    order = get_order_by_id(db_path, order_id, user_id)
    if order is None:
        logger.warning(
            "order_service Gate1 DENIED: order=%s user=%s", order_id, user_id
        )
        raise OrderAccessDeniedError()

    # ── Gate 2: Status Guard ──────────────────────────────────────────────────
    # Evaluated BEFORE the time-window so a non-PENDING order always gets a
    # status-specific 409 regardless of elapsed time.
    status: str = order["status"]
    if status != "PENDING":
        logger.info(
            "order_service Gate2 BLOCKED: order=%s status=%s", order_id, status
        )
        if status == "ACCEPTED":
            raise OrderAlreadyAcceptedError()
        if status == "CANCELLED":
            raise OrderAlreadyCancelledError()
        # IN_PREPARATION, OUT_FOR_DELIVERY, DELIVERED
        raise OrderNotCancellableError(current_status=status)

    # ── Gate 3: Time-Window Guard ─────────────────────────────────────────────
    # server_utc_now() is the SOLE clock authority; no client input accepted.
    # The boundary is INCLUSIVE: elapsed == 180 s → still allowed (REQ10).
    created_at = order["created_at"]   # timezone-aware datetime from model
    now = server_utc_now()
    elapsed_seconds: float = (now - created_at).total_seconds()

    if elapsed_seconds > _CANCELLATION_WINDOW_SECONDS:
        window_closed_at = created_at + timedelta(seconds=_CANCELLATION_WINDOW_SECONDS)
        logger.info(
            "order_service Gate3 EXPIRED: order=%s elapsed=%.1fs", order_id, elapsed_seconds
        )
        raise CancellationWindowExpiredError(
            created_at_utc=created_at,
            window_closed_at=window_closed_at,
            server_utc_time_at_request=now,
        )

    # ── Gate 4: Atomicity Guard ───────────────────────────────────────────────
    # The Payment Gateway call and the DB UPDATE are treated as one atomic unit:
    #   1. Call gateway FIRST — if it fails, DB is never touched → rollback implicit.
    #   2. Call DB UPDATE only after a successful gateway response.
    #   3. If the DB UPDATE itself fails, cancel_order_atomically rolls back and
    #      re-raises so RefundFailedError is returned to the client.
    # In either failure sub-case, order.status stays 'PENDING'.

    amount_egp: float = order["total_egp"]
    success, refund_reference = initiate_refund(
        order_id=order_id,
        amount_egp=amount_egp,
    )

    if not success:
        logger.error(
            "order_service Gate4 REFUND_FAILED: order=%s gateway declined", order_id
        )
        raise RefundFailedError(order_id=order_id)

    # Gateway accepted — now commit the DB status transition.
    # cancelled_at is server-generated UTC; the client never supplies it.
    cancelled_at = server_utc_now()
    try:
        cancel_order_atomically(
            db_path=db_path,
            order_id=order_id,
            user_id=user_id,
            refund_reference=refund_reference,
            cancelled_at=cancelled_at,
        )
    except Exception:
        # DB write failed after a successful gateway call.
        # order.status is still PENDING (rollback done inside model).
        # Surface as REFUND_FAILED so the client retries.
        logger.error(
            "order_service Gate4 DB_ROLLBACK: order=%s db update failed after "
            "successful gateway response (refund=%s)",
            order_id,
            refund_reference,
            exc_info=True,
        )
        raise RefundFailedError(order_id=order_id)

    logger.info(
        "order_service SUCCESS: order=%s cancelled, refund=%s initiated",
        order_id,
        refund_reference,
    )

    # ── Happy Path — build success payload ────────────────────────────────────
    return {
        "order": {
            "order_id": order_id,
            "status": "CANCELLED",
            "cancelled_at": cancelled_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "refund": {
                "refund_reference": refund_reference,
                "amount_egp": amount_egp,
                "status": "INITIATED",
            },
        },
        "message": (
            f"Your order has been cancelled. "
            f"A refund of {amount_egp:.2f} EGP has been initiated."
        ),
    }
