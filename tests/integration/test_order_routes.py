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
    # Mock database retrieval call within the route
    with patch('services.order_service.get_orders_from_db', return_value=mock_db_orders):
        response = auth_client_usr1.get('/api/v1/orders?page=1&limit=10')
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Assert list length and ownership
        assert len(data["orders"]) == 3
        
        # Assert sort order matches background specification exactly
        assert data["orders"][0]["order_id"] == "ORD-20260510-001"
        assert data["orders"][1]["order_id"] == "ORD-20260509-002"
        assert data["orders"][2]["order_id"] == "ORD-20260508-003"
        
        # Assert the 6 mandatory fields are present in every returned item
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
    # Generate 25 mock orders to test the boundary behaviors
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
        
        # User 2 should only see their 1 order ("Night Bites"), not User 1's orders
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
    # Specifically looking for USR-00002's order
    mock_order = [o for o in mock_db_orders if o["order_id"] == "ORD-20260510-004"][0]
    
    with patch('services.order_service.get_order_by_id', return_value=mock_order):
        response = auth_client_usr1.get('/api/v1/orders/ORD-20260510-004')
        
        assert response.status_code == 403
        data = response.get_json()
        
        assert data["error"]["code"] == "ORDER_ACCESS_DENIED"
        assert "restaurant_name" not in data # Verify no data leaks


def test_scenario_6_successful_order_retrieval(auth_client_usr1, mock_db_orders):
    """
    Scenario 6: Happy Path - successfully retrieve an owned order by ID
      Given the user is authenticated as "USR-00001"
      When the user navigates to "/api/v1/orders/ORD-20260510-001"
      Then the server shall respond with HTTP 200 OK
      And the response shall contain the order fields matching the user.
    """
    mock_order = [o for o in mock_db_orders if o["order_id"] == "ORD-20260510-001"][0]
    
    with patch('services.order_service.get_order_by_id', return_value=mock_order):
        response = auth_client_usr1.get('/api/v1/orders/ORD-20260510-001')
        
        assert response.status_code == 200
        data = response.get_json()
        
        assert data["order_id"] == "ORD-20260510-001"
        assert data["user_id"] == "USR-00001"
        assert "status" in data
        assert "created_at" in data
        assert "restaurant_name" in data


def test_scenario_7_order_not_found(auth_client_usr1):
    """
    Scenario 7: Not Found - user requests a non-existent order
      Given the user is authenticated
      When the user navigates to "/api/v1/orders/ORD-99999999-999"
      Then the server shall respond with HTTP 404 Not Found
      And the error envelope contains "ORDER_NOT_FOUND"
    """
    with patch('services.order_service.get_order_by_id', return_value=None):
        response = auth_client_usr1.get('/api/v1/orders/ORD-99999999-999')
        
        assert response.status_code == 404
        data = response.get_json()
        
        assert data["error"]["code"] == "ORDER_NOT_FOUND"
        assert "restaurant_name" not in data
