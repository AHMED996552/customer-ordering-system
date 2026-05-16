"""
main.py — Flask Application Factory for Customer Ordering System
"""

import os
from flask import Flask
from database.schema import OrderingSystemDB
from backend.routes.auth_routes import auth_bp


def create_app(config: dict | None = None) -> Flask:
    app = Flask(__name__)

    # ── Defaults ──────────────────────────────────────────────────────────────
    app.config["DATABASE_PATH"] = os.environ.get(
        "DATABASE_PATH", "customer_ordering_system.db"
    )
    app.config["JWT_SECRET_KEY"] = os.environ.get(
        "JWT_SECRET_KEY", "dev-secret-change-me-in-production"
    )
    app.config["ENV"] = os.environ.get("FLASK_ENV", "development")

    # ── Override with test/runtime config ────────────────────────────────────
    if config:
        app.config.update(config)

    # ── Initialize DB (creates tables if not exist) ───────────────────────────
    OrderingSystemDB(db_path=app.config["DATABASE_PATH"])

    # ── Register Blueprints ───────────────────────────────────────────────────
    app.register_blueprint(auth_bp)

    return app


if __name__ == "__main__":
    flask_app = create_app()
    flask_app.run(debug=True, port=5000)
