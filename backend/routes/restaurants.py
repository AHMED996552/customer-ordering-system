from flask import Blueprint, jsonify
from backend.services.restaurant_service import get_all_restaurants

bp = Blueprint("restaurants", __name__)


@bp.route("/api/v1/restaurants", methods=["GET"])
def catalog():
    try:
        restaurants = get_all_restaurants()
        return jsonify(
            {
                "restaurants": restaurants,
                "total_count": len(restaurants),
            }
        ), 200
    except Exception:
        return jsonify(
            {
                "error": {
                    "code": "SERVICE_UNAVAILABLE",
                    "message": "The restaurant catalog is temporarily unavailable. Please try again.",
                }
            }
        ), 503
