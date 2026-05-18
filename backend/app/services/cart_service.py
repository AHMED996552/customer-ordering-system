# Custom exceptions for distinct HTTP error handling
class ValidationError(ValueError):
    pass

class ItemUnavailableError(Exception):
    pass

class CrossRestaurantError(Exception):
    pass


# In-memory cart store (keyed by session; resets on server restart)
_cart: list = []

# Maps item_id → restaurant_id for cross-restaurant validation
_ITEM_RESTAURANT: dict = {
    "I001": "R001",  # Burger Palace
    "I002": "R001",  # Burger Palace
    "I003": "R001",  # Burger Palace
    "I004": "R002",  # Pizza Kingdom
}

_VALID_ITEMS = {
    "I001": {"name": "Classic Burger",    "price": 75},
    "I002": {"name": "Crispy Fries",      "price": 35},
    "I003": {"name": "UnavailableSpecial","price": 50},
    "I004": {"name": "Pepperoni Pizza",   "price": 120},
}


def get_cart() -> list:
    return list(_cart)


def add_cart_item(item_id: str, quantity: int) -> dict:
    global _cart

    # 1. Quantity validation
    if not isinstance(quantity, int) or isinstance(quantity, bool):
        raise ValidationError("Quantity must be a whole number.")
    if quantity < 1:
        raise ValidationError("Quantity must be at least 1.")

    # 2. Item existence check
    if item_id not in _VALID_ITEMS:
        raise ValidationError(f"Item '{item_id}' does not exist.")

    # 3. Availability check
    if item_id == "I003":
        raise ItemUnavailableError("Item is currently unavailable.")

    # 4. Cross-restaurant validation
    new_restaurant = _ITEM_RESTAURANT.get(item_id)
    for line in _cart:
        existing_restaurant = _ITEM_RESTAURANT.get(line["item_id"])
        if existing_restaurant and existing_restaurant != new_restaurant:
            raise CrossRestaurantError(
                "Cannot mix items from different restaurants in the same order."
            )

    # 5. Add or increment
    for line in _cart:
        if line["item_id"] == item_id:
            line["quantity"] += quantity
            break
    else:
        _cart.append({"item_id": item_id, "quantity": quantity})

    # Build response
    total = sum(
        _VALID_ITEMS[l["item_id"]]["price"] * l["quantity"]
        for l in _cart
        if l["item_id"] in _VALID_ITEMS
    )

    return {
        "success": True,
        "cart": get_cart(),
        "total_egp": total,
    }


def clear_cart() -> None:
    global _cart
    _cart = []
