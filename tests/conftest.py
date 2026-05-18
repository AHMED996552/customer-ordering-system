import pytest
from unittest.mock import patch
# Assuming your flask app is imported from main or app module
from main import app 

@pytest.fixture
def mock_db_orders():
    """
    Mock database fixture containing the exact records specified in the Gherkin Background.
    """
    return [
        {
            "order_id": "ORD-20260510-001",
            "user_id": "USR-00001",
            "restaurant_name": "Burger Palace",
            "created_at": "2026-05-10T14:32:00Z",
            "item_summary": "Classic Burger x2",
            "total_egp": 150.00,
            "status": "DELIVERED",
            "cancellable": False
        },
        {
            "order_id": "ORD-20260509-002",
            "user_id": "USR-00001",
            "restaurant_name": "Pizza Kingdom",
            "created_at": "2026-05-09T20:15:00Z",
            "item_summary": "Pepperoni Pizza x1",
            "total_egp": 110.00,
            "status": "DELIVERED",
            "cancellable": False
        },
        {
            "order_id": "ORD-20260508-003",
            "user_id": "USR-00001",
            "restaurant_name": "Sushi House",
            "created_at": "2026-05-08T13:00:00Z",
            "item_summary": "Spicy Tuna Roll x3",
            "total_egp": 210.00,
            "status": "CANCELLED",
            "cancellable": False
        },
        {
            "order_id": "ORD-20260510-004",
            "user_id": "USR-00002",
            "restaurant_name": "Night Bites",
            "created_at": "2026-05-10T22:00:00Z",
            "item_summary": "Late Night Combo x1",
            "total_egp": 65.00,
            "status": "DELIVERED",
            "cancellable": False
        }
    ]

@pytest.fixture
def client():
    """Provides an unauthenticated Flask test client."""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

@pytest.fixture
def auth_client_usr1(client):
    """
    Provides an authenticated test client for USR-00001.
    Sets an HTTP-only session cookie and mocks the internal session decoder.
    """
    client.set_cookie('session', 'mock_session_token_usr1', domain='localhost', httponly=True)
    with patch('services.auth_service.decode_session_cookie', return_value={"user_id": "USR-00001"}):
        yield client

@pytest.fixture
def auth_client_usr2(client):
    """
    Provides an authenticated test client for USR-00002.
    """
    client.set_cookie('session', 'mock_session_token_usr2', domain='localhost', httponly=True)
    with patch('services.auth_service.decode_session_cookie', return_value={"user_id": "USR-00002"}):
        yield client
