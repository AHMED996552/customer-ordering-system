from flask import jsonify

class APIError(Exception):
    def __init__(self, code, message, status_code=400, fields=None):
        super().__init__()
        self.code = code
        self.message = message
        self.status_code = status_code
        self.fields = fields

    def to_dict(self):
        rv = {
            "error": {
                "code": self.code,
                "message": self.message
            }
        }
        if self.fields:
            rv["error"]["fields"] = self.fields
        return rv

def register_error_handlers(app):
    @app.errorhandler(APIError)
    def handle_api_error(error):
        response = jsonify(error.to_dict())
        response.status_code = error.status_code
        return response

    @app.errorhandler(400)
    def handle_400(e):
        return jsonify({"error": {"code": "BAD_REQUEST", "message": "Bad request format"}}), 400

    @app.errorhandler(413)
    def handle_413(e):
        return jsonify({"error": {"code": "PAYLOAD_TOO_LARGE", "message": "Request payload exceeds limit"}}), 413
