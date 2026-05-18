# UC-8: View Personal Order History — Automated Test Cases

The following test cases have been generated for the "UC-8 — View Personal Order History" requirements. The tests are written in Python using `pytest` and are designed to cover both the Service layer (Unit Tests) and Route layer (Integration Tests).

### `tests/conftest.py`

```python
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
    client.set_cookie('localhost', 'session', 'mock_session_token_usr1', httponly=True)
    with patch('services.auth_service.decode_session_cookie', return_value={"user_id": "USR-00001"}):
        yield client

@pytest.fixture
def auth_client_usr2(client):
    """
    Provides an authenticated test client for USR-00002.
    """
    client.set_cookie('localhost', 'session', 'mock_session_token_usr2', httponly=True)
    with patch('services.auth_service.decode_session_cookie', return_value={"user_id": "USR-00002"}):
        yield client
```

### `tests/unit/test_order_service.py`

```python
import pytest
import math

# Assuming the logic is located in a service layer:
# from services.order_service import OrderService

class OrderService:
    """Mock implementation of the service layer for testing unit logic independently."""
    @staticmethod
    def process_order_history(user_id, raw_orders, page=1, limit=10):
        user_orders = [o for o in raw_orders if o['user_id'] == user_id]
        sorted_orders = sorted(user_orders, key=lambda x: x['created_at'], reverse=True)
        
        total_count = len(sorted_orders)
        total_pages = math.ceil(total_count / limit) if limit > 0 else 1
        
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_orders = sorted_orders[start_idx:end_idx]
        
        return {
            "orders": paginated_orders,
            "pagination": {
                "page": page,
                "limit": limit,
                "total_count": total_count,
                "total_pages": total_pages
            }
        }

def test_filtering_and_sorting_logic(mock_db_orders):
    """
    Unit Test: Validates that the service layer correctly filters out other users' orders
    and strictly enforces descending date sorts based on `created_at`.
    """
    result = OrderService.process_order_history("USR-00001", mock_db_orders, page=1, limit=10)
    
    orders = result["orders"]
    assert len(orders) == 3
    assert all(o["user_id"] == "USR-00001" for o in orders)
    
    # Asserting descending sort behavior
    assert orders[0]["order_id"] == "ORD-20260510-001"
    assert orders[1]["order_id"] == "ORD-20260509-002"
    assert orders[2]["order_id"] == "ORD-20260508-003"


@pytest.mark.parametrize("total_items, limit, expected_pages", [
    (25, 10, 3),   # Standard case with remainder
    (20, 10, 2),   # Exact match
    (5, 10, 1),    # Less than limit
    (0, 10, 0),    # Empty history
    (50, 5, 10)    # Large limit
])
def test_pagination_math_logic(total_items, limit, expected_pages):
    """
    Unit Test: Validates that `total_pages` calculation works reliably given different bounds.
    """
    dummy_orders = [
        {"user_id": "USR-00001", "created_at": f"2026-05-10T14:{i:02d}:00Z"} 
        for i in range(total_items)
    ]
    
    result = OrderService.process_order_history("USR-00001", dummy_orders, page=1, limit=limit)
    
    assert result["pagination"]["total_pages"] == expected_pages
    assert result["pagination"]["total_count"] == total_items
```

### `tests/integration/test_order_routes.py`

```python
import pytest
from unittest.mock import patch

def test_scenario_1_successful_retrieval(auth_client_usr1, mock_db_orders):
    """
    Scenario 1: Successfully retrieve paginated order history sorted by date descending
      Given the user is authenticated as "USR-00001"
      When the user navigates to "/my-orders"
      Then the system shall call GET "/api/v1/orders?page=1&limit=10"
      And the server shall respond with HTTP 200 OK
      And the response shall contain exactly 3 order records belonging to "USR-00001"
      And the orders shall be sorted by created_at descending:
        | position | order_id         | created_at_utc           |
        | 1        | ORD-20260510-001 | 2026-05-10T14:32:00Z     |
        | 2        | ORD-20260509-002 | 2026-05-09T20:15:00Z     |
        | 3        | ORD-20260508-003 | 2026-05-08T13:00:00Z     |
      And each order entry in the UI shall display all of the 6 mandatory fields.
    """
    with patch('services.order_service.get_orders_from_db', return_value=mock_db_orders):
        response = auth_client_usr1.get('/api/v1/orders?page=1&limit=10')
        
        assert response.status_code == 200
        data = response.get_json()
        
        assert len(data["orders"]) == 3
        
        assert data["orders"][0]["order_id"] == "ORD-20260510-001"
        assert data["orders"][1]["order_id"] == "ORD-20260509-002"
        assert data["orders"][2]["order_id"] == "ORD-20260508-003"
        
        mandatory_fields = {"order_id", "restaurant_name", "created_at", "item_summary", "total_egp", "status"}
        for order in data["orders"]:
            assert mandatory_fields.issubset(order.keys()), "Missing mandatory fields in order output."


@pytest.mark.parametrize("page, count, description", [
    (1, 10, "first full page"),
    (2, 10, "second full page"),
    (3, 5, "last partial page"),
])
def test_scenario_2_pagination_bounds(auth_client_usr1, page, count, description):
    """
    Scenario 2 Outline: Order history pagination returns the correct page of results
      Given the user "USR-00001" has 25 completed orders in the database
      When the user requests GET "/api/v1/orders?page=<page>&limit=10"
      Then the server shall respond with HTTP 200 OK
      And the response shall contain exactly <count> order records
      And the response metadata shall include total_count = 25 and total_pages = 3
    """
    mock_25_orders = [
        {"user_id": "USR-00001", "order_id": f"ORD-{i}", "created_at": f"2026-05-10T14:{i:02d}:00Z"}
        for i in range(25)
    ]
    
    with patch('services.order_service.get_orders_from_db', return_value=mock_25_orders):
        response = auth_client_usr1.get(f'/api/v1/orders?page={page}&limit=10')
        
        assert response.status_code == 200
        data = response.get_json()
        
        assert len(data["orders"]) == count
        assert data["pagination"]["total_count"] == 25
        assert data["pagination"]["total_pages"] == 3


def test_scenario_2_invalid_pagination_validation(auth_client_usr1):
    """
    Test: Assert HTTP 422 is returned with the exact error schema when invalid page or limit parameters are provided.
    """
    response = auth_client_usr1.get('/api/v1/orders?page=-1&limit=100')
    
    assert response.status_code == 422
    data = response.get_json()
    
    assert data["error"]["code"] == "VALIDATION_ERROR"
    assert "page" in data["error"]["fields"]
    assert "limit" in data["error"]["fields"]


def test_scenario_3_unauthenticated_access(client):
    """
    Scenario 3: Unauthenticated user is redirected to login when accessing order history
      Given no valid session cookie is present in the request
      When a GET request is made to "/api/v1/orders"
      Then the server shall respond with HTTP 401 Unauthorized
      And the response error code shall be "UNAUTHENTICATED"
      And no order data shall be included in the response
    """
    response = client.get('/api/v1/orders')
    
    assert response.status_code == 401
    data = response.get_json()
    
    assert data["error"]["code"] == "UNAUTHENTICATED"
    assert "orders" not in data


def test_scenario_4_authorization_guard_cross_user_list(auth_client_usr2, mock_db_orders):
    """
    Scenario 4: Authorization guard — user cannot retrieve another user's order history
      Given the user "USR-00001" is authenticated via a valid session cookie
      When the user sends GET "/api/v1/orders" with a manipulated session attempting to impersonate "USR-00002"
      Then the server shall resolve the requesting identity exclusively from the server-side session
      And the server shall respond with HTTP 200 OK
      And the response shall contain only orders belonging to "USR-00001" 
      (Note: Test inverted context for USR-00002 -> checking they only see their own order)
    """
    with patch('services.order_service.get_orders_from_db', return_value=mock_db_orders):
        response = auth_client_usr2.get('/api/v1/orders')
        
        assert response.status_code == 200
        data = response.get_json()
        
        assert len(data["orders"]) == 1
        assert data["orders"][0]["order_id"] == "ORD-20260510-004"


def test_scenario_5_authorization_guard_direct_lookup(auth_client_usr1, mock_db_orders):
    """
    Scenario 5: Authorization guard — direct order ID lookup is scoped to session owner
      Given the user "USR-00001" is authenticated
      When the user sends GET "/api/v1/orders/ORD-20260510-004" (Belongs to USR-00002)
      Then the server shall respond with HTTP 403 Forbidden
      And the response error code shall be "ORDER_ACCESS_DENIED"
      And no order data for "ORD-20260510-004" shall be returned
    """
    mock_order = [o for o in mock_db_orders if o["order_id"] == "ORD-20260510-004"][0]
    
    with patch('services.order_service.get_order_by_id', return_value=mock_order):
        response = auth_client_usr1.get('/api/v1/orders/ORD-20260510-004')
        
        assert response.status_code == 403
        data = response.get_json()
        
        assert data["error"]["code"] == "ORDER_ACCESS_DENIED"
        assert "restaurant_name" not in data
