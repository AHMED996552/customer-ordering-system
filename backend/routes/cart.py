from flask import Blueprint, session, jsonify
from backend.services.cart_service import refresh_session_cart

cart_bp = Blueprint('cart_bp', __name__)

@cart_bp.route('/api/v1/cart', methods=['GET'])
def get_cart():
    cart = refresh_session_cart(session)
    return jsonify({"cart": cart}), 200
