import math
from models.order_model import get_orders_from_db, get_order_by_id

class OrderAccessDeniedError(Exception):
    pass

class OrderNotFoundError(Exception):
    pass

class OrderService:
    @staticmethod
    def process_order_history(user_id, raw_orders, page=1, limit=10):
        """
        Core business logic and pagination orchestration.
        Ensures strict IDOR protection by filtering raw_orders to only those matching user_id.
        Ensures strict sorting by created_at DESC.
        """
        user_orders = [o for o in raw_orders if o.get('user_id') == user_id]
        sorted_orders = sorted(user_orders, key=lambda x: x.get('created_at', ''), reverse=True)
        
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

    @staticmethod
    def get_user_orders(user_id, page=1, limit=10):
        """
        Retrieves paginated orders for a user. Calls get_orders_from_db() which is patched in tests.
        """
        raw_orders = get_orders_from_db()
        return OrderService.process_order_history(user_id, raw_orders, page, limit)

    @staticmethod
    def get_user_order_by_id(user_id, order_id):
        """
        Retrieves a single order by ID and enforces strict IDOR protection.
        Validates that the requested order belongs strictly to the authenticated session user.
        """
        order = get_order_by_id(order_id)
        if not order:
            raise OrderNotFoundError(f"Order {order_id} not found.")
        
        if order.get('user_id') != user_id:
            raise OrderAccessDeniedError("You do not have permission to access this order.")
        
        return order
