"""
conftest.py — UC-9 Track Live Order Status
==========================================
Shared pytest fixtures for the UC-9 test suite.

Provides:
  - Flask app + test client
  - Canonical order data factories (via factories.py)
  - Session helpers to inject authenticated user sessions
  - Monkeypatch helpers for order repository, SSE stream layer
  - Isolated test state (no shared mutable state between tests)
"""

from __future__ import annotations

import json
from typing import Any, Generator
from unittest.mock import MagicMock, patch

import pytest

# ── Application factory import ───────────────────────────────────────────────
# Adjust this import path once the UC-9 application code is implemented.
# The fixture below creates a minimal Flask app stub if the real one isn't ready,
# so tests can be written and run independently of implementation completeness.

try:
    from backend.app import create_app  # type: ignore[import]
    _HAS_REAL_APP = True
except ImportError:
    _HAS_REAL_APP = False

from tests.uc9.factories import (
    make_active_order,
    make_terminal_order,
    make_access_denied_error,
    make_sse_event,
    ORDER_ID_ACTIVE,
    ORDER_ID_TERMINAL,
    ORDER_ID_OTHER_USER,
    USER_ID_OWNER,
    USER_ID_OTHER,
    STREAM_ENDPOINT,
)


# ── App fixture ───────────────────────────────────────────────────────────────

def _build_stub_app():
    """
    Build a minimal Flask application stub that wires up the UC-9 routes
    using the canonical URL patterns from the API contract.

    This stub is used when the real application code is not yet implemented.
    It registers placeholder routes that return 501 Not Implemented, allowing
    the test suite to be authored and run before the implementation exists.
    """
    from flask import Flask, jsonify, session, request, Response
    import time

    app = Flask(__name__)
    app.config["TESTING"] = True
    app.config["SECRET_KEY"] = "uc9-test-secret-key"
    app.config["SESSION_COOKIE_HTTPONLY"] = True

    # ── Stub route: GET /api/v1/orders/<order_id> ─────────────────────────────
    @app.route("/api/v1/orders/<order_id>", methods=["GET"])
    def get_order_stub(order_id: str):  # type: ignore[return]
        return jsonify({"error": {"code": "NOT_IMPLEMENTED", "message": "UC-9 not yet implemented"}}), 501

    # ── Stub route: GET /api/v1/orders/<order_id>/status-stream ───────────────
    @app.route("/api/v1/orders/<order_id>/status-stream", methods=["GET"])
    def get_order_stream_stub(order_id: str):  # type: ignore[return]
        return jsonify({"error": {"code": "NOT_IMPLEMENTED", "message": "UC-9 not yet implemented"}}), 501

    return app


@pytest.fixture(scope="session")
def app():
    """
    Session-scoped Flask application.

    Uses the real app if importable, otherwise falls back to the stub.
    Override UC-9 routes via monkeypatching in individual tests.
    """
    if _HAS_REAL_APP:
        flask_app = create_app({"TESTING": True, "SECRET_KEY": "uc9-test-secret"})
    else:
        flask_app = _build_stub_app()

    flask_app.config.update(
        {
            "TESTING": True,
            "SECRET_KEY": "uc9-test-secret-key",
            "SESSION_COOKIE_HTTPONLY": True,
            "WTF_CSRF_ENABLED": False,
        }
    )
    yield flask_app


@pytest.fixture()
def client(app):
    """
    Per-test Flask test client with an isolated request context.
    """
    with app.test_client() as c:
        yield c


# ── Session helpers ───────────────────────────────────────────────────────────

@pytest.fixture()
def authenticated_session(client, app):
    """
    Inject a valid session for USER_ID_OWNER into the test client.

    Usage:
        def test_something(client, authenticated_session):
            response = client.get("/api/v1/orders/ORD-001")
    """
    with client.session_transaction() as sess:
        sess["user_id"] = USER_ID_OWNER
        sess["authenticated"] = True
    yield client


@pytest.fixture()
def other_user_session(client):
    """Inject a valid session for a *different* user (USER_ID_OTHER)."""
    with client.session_transaction() as sess:
        sess["user_id"] = USER_ID_OTHER
        sess["authenticated"] = True
    yield client


@pytest.fixture()
def unauthenticated_client(client):
    """Test client with NO session (unauthenticated)."""
    yield client


# ── Repository / service patch factories ─────────────────────────────────────

@pytest.fixture()
def mock_order_repository():
    """
    Returns a MagicMock that stands in for the order repository.

    Configure per-test via:
        mock_order_repository.get_order_for_user.return_value = make_active_order()
    """
    repo = MagicMock(name="OrderRepository")
    # Sensible default: return the canonical active order
    repo.get_order_for_user.return_value = make_active_order()
    return repo


@pytest.fixture()
def mock_sse_publisher():
    """
    Returns a MagicMock for the SSE publisher / stream provider.
    """
    publisher = MagicMock(name="SSEPublisher")
    publisher.subscribe.return_value = iter([make_sse_event("ACCEPTED", "2026-05-10T14:34:10Z")])
    return publisher


# ── Data convenience fixtures ─────────────────────────────────────────────────

@pytest.fixture()
def active_order_payload() -> dict[str, Any]:
    """Canonical active order payload (IN_PREPARATION)."""
    return make_active_order()


@pytest.fixture()
def terminal_order_payload() -> dict[str, Any]:
    """Canonical terminal order payload (DELIVERED)."""
    return make_terminal_order()


@pytest.fixture()
def access_denied_payload() -> dict[str, Any]:
    """Canonical 403 ORDER_ACCESS_DENIED error envelope."""
    return make_access_denied_error()
