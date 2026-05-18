"""
main.py — Flask Application Factory for Customer Ordering System
"""

import os
from flask import Flask
from flask_cors import CORS
from database.schema import OrderingSystemDB
from backend.routes.auth import auth_bp
from backend.routes.auth_routes import auth_login_bp
from backend.routes.menu import menu_bp
from backend.routes.restaurants import bp as restaurants_bp


def create_app(config: dict | None = None) -> Flask:
    app = Flask(__name__)

    # ── Defaults ──────────────────────────────────────────────────────────────
    app.config["DATABASE_PATH"] = os.environ.get(
        "DATABASE_PATH"
    )
    app.config["JWT_SECRET_KEY"] = os.environ.get(
        "JWT_SECRET_KEY"
    )
    app.config["ENV"] = os.environ.get("FLASK_ENV", "development")

    # ── Override with test/runtime config ────────────────────────────────────
    if config:
        app.config.update(config)

    # ── CORS (must come before blueprints so all routes are covered) ──────────
    CORS(
        app,
        supports_credentials=True,
        origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    )

    # ── Initialize DB (creates tables if not exist) ───────────────────────────
    OrderingSystemDB(db_path=app.config["DATABASE_PATH"])

    # ── Register Blueprints ───────────────────────────────────────────────────
    app.register_blueprint(auth_bp)
    app.register_blueprint(auth_login_bp)
    app.register_blueprint(menu_bp)
    app.register_blueprint(restaurants_bp)


    return app


if __name__ == "__main__":
    flask_app = create_app()
    flask_app.run(debug=True, port=5000)
