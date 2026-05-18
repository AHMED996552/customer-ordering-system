from flask import Blueprint, request, jsonify
from services import auth_service
from services.order_service import OrderService, OrderAccessDeniedError, OrderNotFoundError

order_bp = Blueprint('orders', __name__)

@order_bp.route('/orders', methods=['GET'])
def view_order_history():
    """
    GET /api/v1/orders
    Handles HTTP query parameter parsing (page, limit).
    Resolves authenticated user identity exclusively from server-side HTTP-only session cookie.
    Formats all errors into strict Standard Error Envelope.
    """
    session_cookie = request.cookies.get('session')
    user_data = auth_service.decode_session_cookie(session_cookie)
    
    if not session_cookie or not user_data or 'user_id' not in user_data:
        return jsonify({
            "error": {
                "code": "UNAUTHENTICATED",
                "message": "Authentication required. Please log in."
            }
        }), 401
        
    user_id = user_data['user_id']
    
    page_param = request.args.get('page', 1)
    limit_param = request.args.get('limit', 10)
    
    errors = {}
    
    try:
        page = int(page_param)
        if page < 1:
            errors['page'] = "Page must be a positive integer."
    except ValueError:
        errors['page'] = "Page must be a valid integer."
        
    try:
        limit = int(limit_param)
        if limit < 1 or limit > 50:
            errors['limit'] = "Limit must be between 1 and 50."
    except ValueError:
        errors['limit'] = "Limit must be a valid integer."
        
    if errors:
        return jsonify({
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid pagination parameters.",
                "fields": errors
            }
        }), 422
        
    try:
        result = OrderService.get_user_orders(user_id, page, limit)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": str(e)
            }
        }), 500


@order_bp.route('/orders/<order_id>', methods=['GET'])
def view_order_detail(order_id):
    """
    GET /api/v1/orders/<order_id>
    Resolves authenticated user identity exclusively from server-side HTTP-only session cookie.
    Enforces strict IDOR protection via OrderService.
    """
    session_cookie = request.cookies.get('session')
    user_data = auth_service.decode_session_cookie(session_cookie)
    
    if not session_cookie or not user_data or 'user_id' not in user_data:
        return jsonify({
            "error": {
                "code": "UNAUTHENTICATED",
                "message": "Authentication required. Please log in."
            }
        }), 401
        
    user_id = user_data['user_id']
    
    try:
        order = OrderService.get_user_order_by_id(user_id, order_id)
        return jsonify(order), 200
    except OrderAccessDeniedError as e:
        return jsonify({
            "error": {
                "code": "ORDER_ACCESS_DENIED",
                "message": str(e)
            }
        }), 403
    except OrderNotFoundError as e:
        return jsonify({
            "error": {
                "code": "ORDER_NOT_FOUND",
                "message": str(e)
            }
        }), 404
    except Exception as e:
        return jsonify({
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": str(e)
            }
        }), 500
