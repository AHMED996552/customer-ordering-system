import re
from flask import Blueprint, jsonify
from backend.services.menu_service import get_menu_for_restaurant
from backend.repositories.restaurant_repo import get_operating_hours
import backend.utils.time as time_utils

menu_bp = Blueprint('menu_bp', __name__)

def is_time_between(current_time: str, open_time: str, close_time: str) -> bool:
    """
    Checks if current_time (HH:MM) is between open_time and close_time.
    Assumes all times are in the same UTC timezone.
    """
    return open_time <= current_time < close_time

@menu_bp.route('/api/v1/restaurants/<restaurant_id>/menu', methods=['GET'])
def get_restaurant_menu(restaurant_id: str):
    # Security: basic sanitization for malformed IDs (prevent injection/weird characters)
    # Allows alphanumeric and hyphens.
    if not re.match(r"^[a-zA-Z0-9\-]+$", restaurant_id):
        return jsonify({
            "error": {
                "code": "RESTAURANT_NOT_FOUND",
                "message": "No restaurant exists with the provided ID."
            }
        }), 404

    # 1. Capture current UTC time
    current_utc = time_utils.server_utc_now()
    
    # 2. Fetch operating hours
    hours = get_operating_hours(restaurant_id)
    if not hours:
        return jsonify({
            "error": {
                "code": "RESTAURANT_NOT_FOUND",
                "message": "No restaurant exists with the provided ID."
            }
        }), 404
        
    # 3. Boundary validation (REQ19)
    if not is_time_between(current_utc, hours['open'], hours['close']):
        return jsonify({
            "error": {
                "code": "RESTAURANT_CLOSED",
                "message": "Burger Palace is currently closed and cannot accept orders.",
                "details": {
                    "restaurant_id": restaurant_id,
                    "operating_hours_utc": hours,
                    "server_utc_time_at_request": current_utc
                }
            }
        }), 403
        
    # 4. Fetch menu data
    menu_data = get_menu_for_restaurant(restaurant_id)
    if not menu_data:
        return jsonify({
            "error": {
                "code": "RESTAURANT_NOT_FOUND",
                "message": "No restaurant exists with the provided ID."
            }
        }), 404
        
    # 5. Inject server_utc_time_at_request
    menu_data["server_utc_time_at_request"] = current_utc
    
    return jsonify(menu_data), 200
