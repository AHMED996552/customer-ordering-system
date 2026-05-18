"""
main.py — Flask Application Factory for Customer Ordering System
"""

import os
from flask import Flask
from flask_cors import CORS
from database.schema import OrderingSystemDB
from backend.routes.auth import auth_bp
from backend.routes.auth_routes import auth_login_bp
from backend.app.routes.cart import bp as cart_bp


def create_app(config: dict | None = None) -> Flask:
    app = Flask(__name__)

    app.config["DATABASE_PATH"] = os.environ.get(
        "DATABASE_PATH", "customer_ordering_system.db"
    )
    _jwt_secret = os.environ.get("JWT_SECRET_KEY")
    if not _jwt_secret:
        raise RuntimeError(
            "JWT_SECRET_KEY environment variable is not set. "
            "Set it before starting the server."
        )
    app.config["JWT_SECRET_KEY"] = _jwt_secret
    app.config["ENV"] = os.environ.get("FLASK_ENV", "development")

    if config:
        app.config.update(config)

    _allowed_origins = [
        o.strip()
        for o in os.environ.get(
            "ALLOWED_ORIGINS",
            "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001",
        ).split(",")
        if o.strip()
    ]
    CORS(app, supports_credentials=True, origins=_allowed_origins)

    OrderingSystemDB(db_path=app.config["DATABASE_PATH"])

    app.register_blueprint(auth_bp)
    app.register_blueprint(auth_login_bp)
    app.register_blueprint(cart_bp)

    return app


if __name__ == "__main__":
    flask_app = create_app()
    _debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    flask_app.run(debug=_debug, port=int(os.environ.get("PORT", 5000)))
