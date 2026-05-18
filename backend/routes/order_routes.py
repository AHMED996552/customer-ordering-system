"""
backend/routes/order_routes.py
--------------------------------
UC-10: Cancel a Placed Order

Exposes:
    POST /api/v1/orders/<order_id>/cancel

Authentication:
    Resolved EXCLUSIVELY from the HTTP-only ``auth_token`` JWT cookie set by
    the login endpoint.  No request body is read or accepted.

Error format:
    All errors use the "Standard Error Envelope" defined in UC-10:

        {
          "error": {
            "code":    "<ERROR_CODE>",
            "message": "<human-readable>",
            "details": { ... }          # only when the spec includes details
          }
        }

HTTP Status codes used:
    200  — happy path (order cancelled, refund initiated)
    401  — missing or invalid session cookie
    403  — Gate 1: ownership / IDOR guard (ORDER_ACCESS_DENIED)
    409  — Gate 2/3: status or time-window guard
    502  — Gate 4: payment gateway failure (REFUND_FAILED)
"""

import logging

import jwt
from flask import Blueprint, request, jsonify, current_app

from backend.exceptions import OrderServiceError
from backend.services.order_service import cancel_order

logger = logging.getLogger(__name__)

# ── Blueprint ──────────────────────────────────────────────────────────────────
order_bp = Blueprint("orders", __name__, url_prefix="/api/v1/orders")

_JWT_ALGORITHM = "HS256"


# ── Private helpers ────────────────────────────────────────────────────────────

def _resolve_user_id() -> str | None:
    """
    Extract the authenticated user's ``user_id`` from the HTTP-only JWT cookie.

    Returns
    -------
    str
        The ``uid`` claim (TEXT UUID, e.g. ``"USR-00001"``) on success.
    None
        When the cookie is absent, malformed, expired, or tampered with.
        The caller returns HTTP 401.
    """
    token: str | None = request.cookies.get("auth_token")
    if not token:
        return None
    try:
        secret: str = current_app.config.get("JWT_SECRET_KEY", "")
        payload: dict = jwt.decode(token, secret, algorithms=[_JWT_ALGORITHM])
        return payload.get("uid")  # TEXT UUID set at login (auth_routes.py)
    except jwt.PyJWTError as exc:
        logger.debug("order_routes: JWT decode failed — %s", exc)
        return None


def _build_error_envelope(exc: OrderServiceError) -> dict:
    """
    Serialise a domain exception into the Standard Error Envelope.

    ``details`` is only included when the exception carries extra context
    (e.g. CancellationWindowExpiredError, OrderNotCancellableError).
    """
    body: dict = {
        "error": {
            "code":    exc.code,
            "message": exc.message,
        }
    }
    if exc.details:
        body["error"]["details"] = exc.details
    return body


# ── Route ──────────────────────────────────────────────────────────────────────

@order_bp.route("/<order_id>/cancel", methods=["POST"])
def cancel_order_route(order_id: str):
    """
    POST /api/v1/orders/<order_id>/cancel

    No request body is read.  The server derives all required context
    (ownership, status, creation timestamp, payment reference) from its own
    records, as specified in UC-10.
    """

    # ── Authentication guard (pre-gate) ───────────────────────────────────────
    user_id: str | None = _resolve_user_id()
    if not user_id:
        return jsonify({
            "error": {
                "code":    "UNAUTHORIZED",
                "message": "Authentication is required. Please log in.",
            }
        }), 401

    # ── Delegate to service layer ─────────────────────────────────────────────
    db_path: str = current_app.config.get(
        "DATABASE_PATH", "customer_ordering_system.db"
    )

    try:
        result: dict = cancel_order(
            db_path=db_path,
            order_id=order_id,
            user_id=user_id,
        )
        return jsonify(result), 200

    except OrderServiceError as exc:
        # Service layer raised a typed domain exception — convert to envelope.
        return jsonify(_build_error_envelope(exc)), exc.http_status
