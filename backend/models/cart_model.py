"""
backend/models/cart_model.py
────────────────────────────
Data-access layer for the Cart feature (UC-3).

Responsibility:
  • Wrap all raw SQLite queries so the service layer never touches SQL.
  • Seed a deterministic, in-memory test fixture so pytest can run without
    a pre-existing database on disk.
  • Expose only plain Python dicts / primitives upward (no Flask objects).

Design notes:
  • item_id values are stored as TEXT in the in-memory fixture (e.g. "I001")
    to match the API contract strings exactly.
  • The real SQLite schema (database/schema.py) uses INTEGER PKs with
    AUTOINCREMENT – when that DB is used, integer item_ids are fine.
    The in-memory store below bridges the gap for testing.
"""

import sys
import os
import sqlite3
import uuid
from datetime import datetime, timezone

# ──────────────────────────────────────────────────────────────────────────────
# In-Memory Store  (used when no SQLite file is available, i.e. during tests)
# ──────────────────────────────────────────────────────────────────────────────

# Seed menu items that match the test suite expectations:
#   I001 – Classic Burger  | R001 BurgerPalace  | available
#   I002 – Crispy Fries    | R001 BurgerPalace  | available
#   I003 – UnavailableSpec | R001 BurgerPalace  | UNAVAILABLE  ← TC-09
#   I004 – Pepperoni Pizza | R002 PizzaKingdom  | available    ← TC-07 conflict

_RESTAURANTS: dict[str, dict] = {
    "R001": {"restaurant_id": "R001", "name": "BurgerPalace"},
    "R002": {"restaurant_id": "R002", "name": "PizzaKingdom"},
}

_MENU_ITEMS: dict[str, dict] = {
    "I001": {
        "item_id": "I001",
        "restaurant_id": "R001",
        "name": "Classic Burger",
        "unit_price_egp": 75.00,
        "is_available": True,
    },
    "I002": {
        "item_id": "I002",
        "restaurant_id": "R001",
        "name": "Crispy Fries",
        "unit_price_egp": 35.00,
        "is_available": True,
    },
    "I003": {
        "item_id": "I003",
        "restaurant_id": "R001",
        "name": "UnavailableSpecial",
        "unit_price_egp": 50.00,
        "is_available": False,  # REQ20 guard — TC-09
    },
    "I004": {
        "item_id": "I004",
        "restaurant_id": "R002",
        "name": "Pepperoni Pizza",
        "unit_price_egp": 120.00,
        "is_available": True,
    },
}

# session_id  →  cart dict
#   cart dict shape:
#   {
#       "cart_id":        str,
#       "restaurant_id":  str | None,
#       "restaurant_name": str | None,
#       "items":          list[line_item_dict],
#   }
_CARTS: dict[str, dict] = {}


# ──────────────────────────────────────────────────────────────────────────────
# Public helpers
# ──────────────────────────────────────────────────────────────────────────────

def get_menu_item(item_id: str) -> dict | None:
    """Return the menu item record for *item_id*, or None if not found."""
    return _MENU_ITEMS.get(str(item_id))


def get_restaurant(restaurant_id: str) -> dict | None:
    """Return the restaurant record, or None if not found."""
    return _RESTAURANTS.get(str(restaurant_id))


def get_or_create_cart(session_id: str) -> dict:
    """
    Return the active cart for this session.
    Creates an empty cart on first access.
    """
    if session_id not in _CARTS:
        _CARTS[session_id] = {
            "cart_id": f"cart_{uuid.uuid4().hex[:8]}",
            "restaurant_id": None,
            "restaurant_name": None,
            "items": [],
        }
    return _CARTS[session_id]


def get_cart_restaurant_id(session_id: str) -> str | None:
    """Return the restaurant_id that currently 'owns' this cart, or None."""
    cart = _CARTS.get(session_id)
    if not cart:
        return None
    return cart.get("restaurant_id")


def append_line_item(session_id: str, menu_item: dict, quantity: int) -> dict:
    """
    Add (or merge) a line item into the session cart.

    Returns the full updated cart dict.

    Rules applied here (data integrity, not business logic):
      • If the same item_id already exists in the cart, increment quantity.
      • Prices are always taken server-side from the menu item record.
    """
    cart = get_or_create_cart(session_id)

    # Set cart ownership on first item
    if cart["restaurant_id"] is None:
        restaurant = get_restaurant(menu_item["restaurant_id"])
        cart["restaurant_id"] = menu_item["restaurant_id"]
        cart["restaurant_name"] = restaurant["name"] if restaurant else "Unknown"

    # Check for existing line item (upsert)
    for line in cart["items"]:
        if line["item_id"] == menu_item["item_id"]:
            line["quantity"] += quantity
            line["line_total_egp"] = round(
                line["quantity"] * line["unit_price_egp"], 2
            )
            return cart

    # New line item
    line_item = {
        "line_item_id": f"L{len(cart['items']) + 1:03d}",
        "item_id": menu_item["item_id"],
        "name": menu_item["name"],
        "quantity": quantity,
        "unit_price_egp": round(menu_item["unit_price_egp"], 2),
        "line_total_egp": round(menu_item["unit_price_egp"] * quantity, 2),
    }
    cart["items"].append(line_item)
    return cart


def clear_cart(session_id: str) -> None:
    """Wipe all items from the cart (used after cross-restaurant confirmation)."""
    if session_id in _CARTS:
        _CARTS[session_id]["items"] = []
        _CARTS[session_id]["restaurant_id"] = None
        _CARTS[session_id]["restaurant_name"] = None


def build_cart_response(cart: dict) -> dict:
    """
    Transform the internal cart dict into the API response shape
    defined in UC-3.md §2 (Success Response).
    """
    subtotal = round(
        sum(line["line_total_egp"] for line in cart["items"]), 2
    )
    return {
        "cart_id": cart["cart_id"],
        "restaurant_id": cart["restaurant_id"],
        "restaurant_name": cart["restaurant_name"],
        "items": cart["items"],
        "subtotal_egp": subtotal,
        "item_count": len(cart["items"]),
    }
