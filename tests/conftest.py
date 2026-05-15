"""
tests/conftest.py
──────────────────
Pytest configuration and shared fixtures for the UC-3 test suite.

What this file does:
  1. Starts the Flask app in a background thread BEFORE any test runs.
  2. Waits for the server to become ready (up to 5 s).
  3. Tears it down after the full session.

This lets test_uc3_add_to_cart.py fire real `requests.post(...)` calls
against http://localhost:8000/api/v1 without requiring a separate terminal.

Usage:
    pytest tests/                # runs everything
    pytest tests/test_uc3_add_to_cart.py -v
"""

import threading
import time

import pytest
import requests

# ── Import the app factory (path is relative to project root) ────────────────
import sys
import os

# Ensure the project root is on sys.path so `backend.*` imports resolve
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from main import create_app  # noqa: E402

# ── Constants ────────────────────────────────────────────────────────────────
_HOST = "127.0.0.1"
_PORT = 8000
_BASE_URL = f"http://{_HOST}:{_PORT}"


# ──────────────────────────────────────────────────────────────────────────────
# Session-scoped fixture: start / stop server
# ──────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session", autouse=True)
def flask_server():
    """
    Spin up the Flask development server in a daemon thread for the entire
    pytest session.  Yields control to the tests, then the daemon dies
    automatically when pytest exits.
    """
    app = create_app()
    app.config["TESTING"] = True

    thread = threading.Thread(
        target=lambda: app.run(host=_HOST, port=_PORT, use_reloader=False),
        daemon=True,
    )
    thread.start()

    # Wait up to 5 s for the server to become responsive
    deadline = time.time() + 5
    while time.time() < deadline:
        try:
            requests.get(f"{_BASE_URL}/api/v1/cart/items", timeout=1)
            break
        except requests.ConnectionError:
            time.sleep(0.1)

    yield  # tests run here

    # Daemon thread is killed automatically when pytest exits


# ──────────────────────────────────────────────────────────────────────────────
# Function-scoped fixture: fresh cart per test
# ──────────────────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def reset_cart():
    """
    Clear the in-memory cart store before each test so tests are independent.
    Imports the module-level dict directly and empties it.
    """
    from backend.models import cart_model
    cart_model._CARTS.clear()
    yield
    cart_model._CARTS.clear()
