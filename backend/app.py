"""
backend/app.py
UC-9 — Track Live Order Status

Flask application factory.

The test conftest imports: from backend.app import create_app
"""

from __future__ import annotations

from flask import Flask


def create_app(config: dict | None = None) -> Flask:
    """
    Flask application factory.

    Creates and configures the Flask application, registers blueprints,
    and applies any provided configuration overrides.

    Args:
        config: Optional dict of Flask config values to override defaults.
                Typically {"TESTING": True, "SECRET_KEY": "..."} in tests.

    Returns:
        Configured Flask application instance.
    """
    app = Flask(__name__)

    # ── Default configuration ─────────────────────────────────────────────────
    app.config.update(
        {
            "SECRET_KEY": "change-me-in-production",
            "SESSION_COOKIE_HTTPONLY": True,
            "SESSION_COOKIE_SAMESITE": "Lax",
            "TESTING": False,
        }
    )

    # ── Apply overrides (e.g. test config) ────────────────────────────────────
    if config:
        app.config.update(config)

    # ── Register blueprints ───────────────────────────────────────────────────
    from backend.routes.orders import orders_bp
    app.register_blueprint(orders_bp)

    return app
