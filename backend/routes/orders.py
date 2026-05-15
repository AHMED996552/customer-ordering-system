from flask import Blueprint, request, jsonify, session
from backend.services.checkout_service import CheckoutService
from backend.utils.errors import APIError

orders_bp = Blueprint('orders', __name__)

@orders_bp.route('/checkout', methods=['POST'])
def checkout():
    # REQ18: Strict Payload Size Limit
    # Reject request immediately if payload exceeds 500 characters
    data_str = request.get_data(as_text=True)
    if len(data_str) > 500:
        raise APIError("PAYLOAD_TOO_LARGE", "Request payload exceeds 500 characters", status_code=413)

    payload = request.get_json()
    if not payload:
        raise APIError("BAD_REQUEST", "Invalid JSON payload", status_code=400)

    cart = session.get('cart')
    if not cart:
        # Fallback to payload items if session cart is empty
        cart = payload.get('items', [])

    # Process via the atomic pipeline
    result = CheckoutService.process_checkout(cart, payload)

    # On full success, clear the cart
    session.pop('cart', None)

    return jsonify(result), 201
