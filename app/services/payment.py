"""
app/services/payment.py
-----------------------
Payment Gateway integration layer for UC-10 (Cancel a Placed Order).

Responsibilities
----------------
- Dispatch a refund initiation request to the external Payment Gateway.
- Return a (success: bool, refund_reference: str | None) tuple.
- Never raise exceptions — caller (order_service) decides how to handle
  failures so that the atomicity guard / rollback logic stays in one place.

The function is isolated in this module so tests can stub it via:
    @patch('app.services.payment.process_refund')

In production this would use the real gateway SDK / HTTP client.
"""

import logging
from typing import Tuple, Optional

logger = logging.getLogger(__name__)

# ── Gateway configuration (override via environment in production) ─────────────
_GATEWAY_TIMEOUT_SECONDS: int = 10


def process_refund(
    order_id: str,
    amount_egp: float,
) -> Tuple[bool, Optional[str]]:
    """
    Initiates a refund with the external Payment Gateway.

    Parameters
    ----------
    order_id : str
        The order identifier whose charge should be refunded.
    amount_egp : float
        The amount in Egyptian Pounds to refund.

    Returns
    -------
    (True, refund_reference: str)
        Gateway accepted the refund — reference token for audit trail.
    (False, None)
        Gateway declined or was unreachable — caller must rollback.

    Notes
    -----
    - This function intentionally swallows all gateway exceptions and returns
      (False, None) so that the service layer controls atomicity via a single
      code path.
    - `refund.status` is always recorded as "INITIATED" by the caller on
      success; final settlement arrives asynchronously via webhook.
    """
    try:
        # ── Production implementation placeholder ─────────────────────────────
        # Replace the block below with your real gateway SDK call, e.g.:
        #
        #   import gateway_sdk
        #   response = gateway_sdk.refunds.create(
        #       order_reference=order_id,
        #       amount=amount_egp,
        #       currency="EGP",
        #       timeout=_GATEWAY_TIMEOUT_SECONDS,
        #   )
        #   if response.status == "ACCEPTED":
        #       return True, response.refund_reference
        #   return False, None
        #
        # For now the stub always fails so that the real integration is wired
        # in before going live.  The test suite provides its own mock.
        raise NotImplementedError(
            "process_refund: production gateway not yet wired. "
            "Tests must mock this function via @patch('app.services.payment.process_refund')."
        )

    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Payment gateway error for order %s: %s",
            order_id,
            exc,
            exc_info=True,
        )
        return False, None
