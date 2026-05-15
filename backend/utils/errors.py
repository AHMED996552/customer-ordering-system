from flask import jsonify

def api_error(code, message, status_code=400):
    """Standardized API Error response."""
    return jsonify({
        "error": {
            "code": code,
            "message": message
        }
    }), status_code
