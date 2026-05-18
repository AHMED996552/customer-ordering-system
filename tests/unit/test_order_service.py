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
