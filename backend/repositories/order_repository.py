"""
backend/repositories/order_repository.py
UC-9 — Track Live Order Status

Order repository: data access layer for order retrieval.

The function `get_order_for_user(order_id, user_id)` is the single query path
that resolves both ORDER EXISTENCE and OWNERSHIP atomically.

SECURITY CONTRACT:
  - Returns the order dict if order_id exists AND belongs to user_id.
  - Returns None in ALL other cases (not found OR wrong owner).
  - Callers MUST NOT distinguish between these cases — both result in
    the same ORDER_ACCESS_DENIED 403 response.
"""

from __future__ import annotations

from typing import Any

# ── In-memory order store (placeholder for real DB layer) ────────────────────
# In production this would query the database. For the implementation this
# serves as a realistic stub that the real DB layer will replace.
# Tests bypass this via monkeypatching `order_repository.get_order_for_user`.

_ORDERS: dict[str, dict[str, Any]] = {}


def get_order_for_user(order_id: str, user_id: str) -> dict[str, Any] | None:
    """
    Retrieve an order only if it belongs to the given user.

    This is a single-query path — existence and ownership are resolved together.
    Returns None for both nonexistent orders and orders owned by a different user.

    Args:
        order_id: The order identifier from the URL path.
        user_id: The authenticated user's ID from the server-side session.

    Returns:
        The order dict if found and owned by user_id, otherwise None.
    """
    order = _ORDERS.get(order_id)
    if order is None:
        return None
    if order.get("user_id") != user_id:
        return None
    return order
