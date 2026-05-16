import pytest
from flask import Flask

# Attempt to import the real app factory, but provide a dummy fallback
# to ensure the tests can be parsed and run (though they might skip or fail)
# when the application logic is not yet implemented.
try:
    from backend.app import create_app
except ImportError:
    def create_app():
        app = Flask(__name__)
        # Dummy route to avoid 404s if we just want the test to run something
        # But for strictly following the TDD approach, returning a dummy app
        # is enough, and tests will assert 404 when endpoints aren't registered.
        return app

@pytest.fixture
def app():
    """Create and configure a new app instance for each test."""
    app = create_app()
    app.config.update({
        "TESTING": True,
    })
    return app

@pytest.fixture
def client(app):
    """A test client for the app."""
    return app.test_client()

@pytest.fixture
def runner(app):
    """A test runner for the app's cli commands."""
    return app.test_cli_runner()
