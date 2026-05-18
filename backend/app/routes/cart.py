from flask import Blueprint, jsonify, request
from app.services.cart_service import (
    add_cart_item,
    get_cart as _get_cart,
    ValidationError,
    ItemUnavailableError,
    CrossRestaurantError,
)

bp = Blueprint("cart", __name__)


@bp.route("/api/v1/cart/items", methods=["POST"])
def add_item():
    body = request.get_json(silent=True) or {}
    item_id = body.get("item_id")
    quantity = body.get("quantity")

    if not item_id or quantity is None:
        return jsonify({
            "error": {"code": "BAD_REQUEST", "message": "item_id and quantity are required."}
        }), 400

    # REQ13: reject non-integer (float) quantity before any casting
    if not isinstance(quantity, int) or isinstance(quantity, bool):
        return jsonify({
            "error": {"code": "VALIDATION_ERROR", "message": "Quantity must be a whole number."}
        }), 422

    try:
        result = add_cart_item(item_id, quantity)
        return jsonify(result), 200

    except CrossRestaurantError as e:
        return jsonify({
            "error": {"code": "CROSS_RESTAURANT_CONFLICT", "message": str(e)}
        }), 409

    except ItemUnavailableError as e:
        return jsonify({
            "error": {"code": "ITEM_UNAVAILABLE", "message": str(e)}
        }), 422

    except ValidationError as e:
        return jsonify({
            "error": {"code": "VALIDATION_ERROR", "message": str(e)}
        }), 422

    except Exception:
        return jsonify({
            "error": {"code": "SERVICE_UNAVAILABLE", "message": "Cart service unavailable."}
        }), 503


@bp.route("/api/v1/cart", methods=["GET"])
def get_cart():
    return jsonify({"cart": _get_cart()}), 200


@bp.route("/api/v1/checkout", methods=["POST"])
def checkout():
    cart = _get_cart()
    if not cart:
        return jsonify({
            "error": {"code": "EMPTY_CART", "message": "Cannot checkout with an empty cart."}
        }), 400
    # Placeholder: real order persistence would go here
    return jsonify({"success": True, "message": "Order placed.", "items": cart}), 200
