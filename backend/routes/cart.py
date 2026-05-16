from flask import Blueprint, session, jsonify, request
from backend.services.cart_service import refresh_session_cart, update_item_quantity, remove_item

cart_bp = Blueprint('cart_bp', __name__)

@cart_bp.route('/api/v1/cart', methods=['GET'])
def get_cart():
    from backend.services.cart_service import _get_empty_cart
    session['cart'] = _get_empty_cart() # Force reset for testing
    cart = refresh_session_cart(session)
    return jsonify({"cart": cart}), 200

@cart_bp.route('/api/v1/cart/items/<line_item_id>', methods=['PATCH'])
def update_quantity(line_item_id):
    data = request.get_json()
    quantity = data.get('quantity', 1)
    cart = update_item_quantity(session, line_item_id, quantity)
    return jsonify({"cart": cart}), 200

@cart_bp.route('/api/v1/cart/items/<line_item_id>', methods=['DELETE'])
def delete_item(line_item_id):
    cart = remove_item(session, line_item_id)
    return jsonify({"cart": cart}), 200

@cart_bp.route('/api/v1/cart/checkout/prepare', methods=['POST'])
def prepare_checkout():
    cart = refresh_session_cart(session)
    return jsonify({"cart": cart}), 200
