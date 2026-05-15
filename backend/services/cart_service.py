"""
backend/services/cart_service.py
─────────────────────────────────
Pure business-logic layer for the Cart feature (UC-3).

Rules:
  • NEVER import Flask's `request` or `jsonify` here.
  • Raise typed Python exceptions so the route layer can map them to HTTP.
  • Return plain Python dicts; the route layer serialises to JSON.

Exception hierarchy (defined at bottom of this file):
  CartValidationError     → HTTP 422  VALIDATION_ERROR
  CartConflictError       → HTTP 409  CROSS_RESTAURANT_CONFLICT
  ItemUnavailableError    → HTTP 422  ITEM_UNAVAILABLE
  EmptyCartError          → HTTP 400  EMPTY_CART
"""

from __future__ import annotations

from backend.models.cart_model import (
    get_menu_item,
    get_or_create_cart,
    get_cart_restaurant_id,
    append_line_item,
    build_cart_response,
)


# ──────────────────────────────────────────────────────────────────────────────
# Custom Exception Types
# ──────────────────────────────────────────────────────────────────────────────

class CartValidationError(Exception):
    """
    Raised when request payload fails REQ12 or REQ13 guards.
    Attributes:
        message (str):  Human-readable description.
        fields  (dict): Optional per-field detail for the error envelope.
    """
    def __init__(self, message: str, fields: dict | None = None):
        super().__init__(message)
        self.message = message
        self.fields = fields or {}


class CartConflictError(Exception):
    """
    Raised when a cross-restaurant addition is attempted (REQ14).
    Attributes:
        message            (str): Human-readable description.
        current_restaurant (str): Name of the restaurant already in the cart.
        new_restaurant     (str): Name of the restaurant for the new item.
    """
    def __init__(
        self,
        message: str,
        current_restaurant: str = "",
        new_restaurant: str = "",
    ):
        super().__init__(message)
        self.message = message
        self.current_restaurant = current_restaurant
        self.new_restaurant = new_restaurant


class ItemUnavailableError(Exception):
    """
    Raised when the requested item has is_available == False (REQ20).
    Attributes:
        message (str): Human-readable description.
        item_id (str): The offending item identifier.
    """
    def __init__(self, message: str, item_id: str = ""):
        super().__init__(message)
        self.message = message
        self.item_id = item_id


class EmptyCartError(Exception):
    """
    Raised when checkout is attempted on an empty cart (REQ21).
    Attributes:
        message (str): Human-readable description.
    """
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


# ──────────────────────────────────────────────────────────────────────────────
# Service Functions
# ──────────────────────────────────────────────────────────────────────────────

def add_item_to_cart(
    session_id: str,
    item_id: str,
    quantity: int | float | str,
) -> dict:
    """
    Execute the UC-3 Guard Chain and, on success, return the updated cart dict.

    Guard order (mirrors database/schema.py commentary):
      1. REQ12 – Reject quantity ≤ 0 (zero / negative).
      2. REQ13 – Reject non-integer quantity (float, NaN, string).
      3. Item existence – 404-style; raised as CartValidationError.
      4. REQ20 – Reject unavailable items.
      5. REQ14 – Reject cross-restaurant additions.

    Args:
        session_id: HTTP-only session cookie value identifying the user.
        item_id:    Menu item identifier from the request payload.
        quantity:   Raw value from the request payload (not yet validated).

    Returns:
        dict: Cart response payload matching the UC-3 Success Response shape.

    Raises:
        CartValidationError:  quantity is invalid OR item not found.
        ItemUnavailableError: item exists but is_available == False.
        CartConflictError:    cart already belongs to a different restaurant.
    """

    # ── GUARD 1 & 2: Quantity validation (REQ12 + REQ13) ────────────────────
    # REQ13: Must be an integer type (not float, not string)
    if not isinstance(quantity, int) or isinstance(quantity, bool):
        raise CartValidationError(
            message="Quantity must be a whole number.",
            fields={"quantity": "Must be a positive integer (e.g. 1, 2, 3)."},
        )

    # REQ12: Must be strictly positive
    if quantity < 1:
        raise CartValidationError(
            message="Quantity must be greater than zero.",
            fields={"quantity": f"Received {quantity}, but minimum is 1."},
        )

    # ── GUARD 3: Item existence ──────────────────────────────────────────────
    menu_item = get_menu_item(str(item_id))
    if menu_item is None:
        raise CartValidationError(
            message=f"Item '{item_id}' does not exist.",
            fields={"item_id": "No menu item found with this identifier."},
        )

    # ── GUARD 4: REQ20 Availability ─────────────────────────────────────────
    if not menu_item["is_available"]:
        raise ItemUnavailableError(
            message=(
                f"'{menu_item['name']}' is currently unavailable "
                "and cannot be added to your cart."
            ),
            item_id=str(item_id),
        )

    # ── GUARD 5: REQ14 Cross-Restaurant Guard ───────────────────────────────
    existing_restaurant_id = get_cart_restaurant_id(session_id)
    if (
        existing_restaurant_id is not None
        and existing_restaurant_id != menu_item["restaurant_id"]
    ):
        # Resolve human-readable names for the conflict message
        cart = get_or_create_cart(session_id)
        current_restaurant_name = cart.get("restaurant_name", existing_restaurant_id)
        new_restaurant_name = menu_item["restaurant_id"]  # fallback to ID

        from backend.models.cart_model import get_restaurant  # local import to stay clean
        new_rest = get_restaurant(menu_item["restaurant_id"])
        if new_rest:
            new_restaurant_name = new_rest["name"]

        raise CartConflictError(
            message=(
                f"Your cart already contains items from '{current_restaurant_name}'. "
                f"Adding items from '{new_restaurant_name}' would create a "
                "cross-restaurant order, which is not allowed. "
                "Please clear your cart first."
            ),
            current_restaurant=current_restaurant_name,
            new_restaurant=new_restaurant_name,
        )

    # ── SUCCESS PATH ─────────────────────────────────────────────────────────
    updated_cart = append_line_item(session_id, menu_item, quantity)
    return build_cart_response(updated_cart)


def checkout(session_id: str) -> dict:
    """
    Validate that the cart is non-empty before processing checkout (REQ21).

    Args:
        session_id: HTTP-only session cookie value.

    Returns:
        dict: Placeholder order confirmation (full checkout is UC-4/5 scope).

    Raises:
        EmptyCartError: Cart has zero items.
    """
    cart = get_or_create_cart(session_id)
    if not cart["items"]:
        raise EmptyCartError(
            message="Cannot proceed to checkout with an empty cart."
        )

    # Placeholder: real order creation belongs to UC-4 / UC-5.
    return {"status": "CONFIRMED", "cart_id": cart["cart_id"]}
