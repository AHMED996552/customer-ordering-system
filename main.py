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
    app.config["JWT_SECRET_KEY"] = os.environ.get(
        "JWT_SECRET_KEY", "dev-secret-change-me-in-production"
    )
    app.config["ENV"] = os.environ.get("FLASK_ENV", "development")

    if config:
        app.config.update(config)

    CORS(
        app,
        supports_credentials=True,
        origins=["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"],
    )

    OrderingSystemDB(db_path=app.config["DATABASE_PATH"])

    app.register_blueprint(auth_bp)
    app.register_blueprint(auth_login_bp)
    app.register_blueprint(cart_bp)

    return app


if __name__ == "__main__":
    flask_app = create_app()
    flask_app.run(debug=True, port=5000)
