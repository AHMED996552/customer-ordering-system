"""
backend/exceptions.py
---------------------
Domain exception hierarchy for the Customer Ordering System.

All service-layer functions raise subclasses of `OrderServiceError` instead
of importing Flask's `abort()` or `jsonify()`.  The route layer catches these
and converts them into the Standard Error Envelope defined in the UC specs.

Raising typed exceptions keeps the service layer framework-agnostic and makes
unit testing trivial — no Flask application context required.
"""


class OrderServiceError(Exception):
    """Base class for all domain exceptions raised by order_service."""

    def __init__(self, code: str, message: str, http_status: int, details: dict | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = http_status
        self.details = details or {}


# ── UC-10: Gate 1 — Ownership / IDOR Guard ────────────────────────────────────

class OrderAccessDeniedError(OrderServiceError):
    """
    Raised when the session user does not own the requested order, or
    when the order does not exist.  The two cases produce an identical
    HTTP 403 response to prevent order-ID enumeration (IDOR).
    """

    def __init__(self):
        super().__init__(
            code="ORDER_ACCESS_DENIED",
            message="You do not have permission to cancel this order.",
            http_status=403,
        )


# ── UC-10: Gate 2 — Status Guard ──────────────────────────────────────────────

class OrderAlreadyAcceptedError(OrderServiceError):
    def __init__(self):
        super().__init__(
            code="ORDER_ALREADY_ACCEPTED",
            message="This order has already been accepted by the restaurant and cannot be cancelled.",
            http_status=409,
        )


class OrderNotCancellableError(OrderServiceError):
    def __init__(self, current_status: str):
        super().__init__(
            code="ORDER_NOT_CANCELLABLE",
            message="This order is no longer eligible for cancellation.",
            http_status=409,
            details={"current_status": current_status},
        )


class OrderAlreadyCancelledError(OrderServiceError):
    def __init__(self):
        super().__init__(
            code="ORDER_ALREADY_CANCELLED",
            message="This order has already been cancelled.",
            http_status=409,
        )


# ── UC-10: Gate 3 — Time-Window Guard ─────────────────────────────────────────

class CancellationWindowExpiredError(OrderServiceError):
    def __init__(self, created_at_utc, window_closed_at, server_utc_time_at_request):
        super().__init__(
            code="CANCELLATION_WINDOW_EXPIRED",
            message="The 3-minute cancellation window for this order has closed.",
            http_status=409,
            details={
                "created_at": created_at_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "window_closed_at": window_closed_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "server_utc_time_at_request": server_utc_time_at_request.strftime("%Y-%m-%dT%H:%M:%SZ"),
            },
        )


# ── UC-10: Gate 4 — Atomicity Guard ───────────────────────────────────────────

class RefundFailedError(OrderServiceError):
    def __init__(self, order_id: str):
        super().__init__(
            code="REFUND_FAILED",
            message="We could not process your cancellation at this time. Please try again.",
            http_status=502,
            details={
                "order_id": order_id,
                "current_status": "PENDING",
            },
        )
