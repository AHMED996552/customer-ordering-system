"""
backend/services/payment_gateway.py
-------------------------------------
Production payment-gateway façade for UC-10 (Cancel a Placed Order).

Responsibilities
----------------
- Provide a named, patchable entry-point for the order service to call.
- Delegate to ``app.services.payment.process_refund`` which is already wired
  and stubbed for testing (tests patch that module directly).
- Never raise exceptions — return ``(False, None)`` on any failure so the
  caller (order_service) controls atomicity via a single code path.

Test-patching surface
---------------------
The integration test suite patches::

    @patch('app.services.payment.process_refund')

which affects the underlying function this module delegates to.
"""

import logging
from typing import Tuple, Optional

# Re-use the already-tested gateway stub in app/services/payment.py.
# Tests mock `app.services.payment.process_refund` — importing the module
# object (not the function) ensures the mock is picked up at call time.
import app.services.payment as _payment_module

logger = logging.getLogger(__name__)


def initiate_refund(
    order_id: str,
    amount_egp: float,
) -> Tuple[bool, Optional[str]]:
    """
    Request a refund from the external Payment Gateway.

    Parameters
    ----------
    order_id : str
        The order identifier whose charge should be refunded.
    amount_egp : float
        The amount in Egyptian Pounds to refund.

    Returns
    -------
    (True, refund_reference: str)
        Gateway accepted the refund — reference token for the audit trail.
        The caller records ``refund.status = "INITIATED"``; final settlement
        arrives asynchronously via a Gateway webhook.
    (False, None)
        Gateway declined or was unreachable — caller must NOT commit the DB
        status update and must raise ``RefundFailedError`` (HTTP 502).

    Notes
    -----
    - All gateway exceptions are swallowed here and collapsed to (False, None)
      so that the atomicity / rollback logic stays in one place (order_service).
    - ``refund.status`` is always recorded as ``"INITIATED"`` by the caller on
      success; final settlement is async and never blocks the client.
    """
    try:
        # Delegate to the patchable module-level function so that
        # @patch('app.services.payment.process_refund') works in tests.
        success, refund_ref = _payment_module.process_refund(order_id, amount_egp)
        return success, refund_ref
    except Exception as exc:
        logger.error(
            "payment_gateway: unexpected error for order %s: %s",
            order_id,
            exc,
            exc_info=True,
        )
        return False, None
