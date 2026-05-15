from flask import Blueprint, session, jsonify, request
from backend.services.cart_service import refresh_session_cart
from backend.services.checkout_service import process_payment, create_order
from backend.utils.errors import api_error

orders_bp = Blueprint('orders_bp', __name__)

@orders_bp.route('/api/v1/orders/checkout', methods=['POST'])
def checkout():
    # Force a refresh to validate latest state
    cart = refresh_session_cart(session)
    
    # REQ21: Empty Cart Guard
    if not cart['items'] or cart['item_count'] == 0:
        return api_error("CART_EMPTY", "Cart is empty. Add items before initiating checkout.")
        
    # REQ20: Unavailable Items
    if not cart['checkout_eligible']:
        return api_error("UNAVAILABLE_ITEMS", "Cart contains unavailable items.")
        
    # Valid -> Trigger Side Effects
    process_payment(cart)
    create_order(cart)
    
    return jsonify({"status": "success"}), 200
