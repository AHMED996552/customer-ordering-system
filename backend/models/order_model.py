import sqlite3
from database.schema import OrderingSystemDB

def get_db_connection():
    db = OrderingSystemDB()
    return db.get_connection()

def get_orders_from_db():
    """
    Fetches all raw orders from the database.
    In production, this queries the Orders table and joins with CartItems, MenuItems, and Restaurants
    to populate the 6 mandatory fields: order_id, restaurant_name, created_at, item_summary, total_egp, status.
    Note: This function is patched by integration tests to return mock data.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        query = """
            SELECT 
                o.order_id,
                o.user_id,
                r.name AS restaurant_name,
                o.created_at,
                GROUP_CONCAT(m.name || ' x' || ci.quantity, ', ') AS item_summary,
                o.total_price AS total_egp,
                o.status
            FROM Orders o
            JOIN CartItems ci ON o.cart_id = ci.cart_id
            JOIN MenuItems m ON ci.item_id = m.item_id
            JOIN Restaurants r ON m.restaurant_id = r.restaurant_id
            GROUP BY o.order_id
            ORDER BY o.created_at DESC
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        orders = []
        for row in rows:
            orders.append({
                "order_id": f"ORD-{row[0]}",
                "user_id": row[1],
                "restaurant_name": row[2],
                "created_at": row[3],
                "item_summary": row[4],
                "total_egp": float(row[5]),
                "status": row[6]
            })
        return orders
    except Exception as e:
        print(f"Database error in get_orders_from_db: {e}")
        return []
    finally:
        conn.close()

def get_order_by_id(order_id):
    """
    Fetches a single order by its ID from the database.
    Note: This function is patched by integration tests to return mock data.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        raw_id = str(order_id).replace("ORD-", "")
        if not raw_id.isdigit():
            return None
            
        query = """
            SELECT 
                o.order_id,
                o.user_id,
                r.name AS restaurant_name,
                o.created_at,
                GROUP_CONCAT(m.name || ' x' || ci.quantity, ', ') AS item_summary,
                o.total_price AS total_egp,
                o.status
            FROM Orders o
            JOIN CartItems ci ON o.cart_id = ci.cart_id
            JOIN MenuItems m ON ci.item_id = m.item_id
            JOIN Restaurants r ON m.restaurant_id = r.restaurant_id
            WHERE o.order_id = ?
            GROUP BY o.order_id
        """
        cursor.execute(query, (int(raw_id),))
        row = cursor.fetchone()
        if not row:
            return None
            
        return {
            "order_id": f"ORD-{row[0]}",
            "user_id": row[1],
            "restaurant_name": row[2],
            "created_at": row[3],
            "item_summary": row[4],
            "total_egp": float(row[5]),
            "status": row[6]
        }
    except Exception as e:
        print(f"Database error in get_order_by_id: {e}")
        return None
    finally:
        conn.close()

def fetch_user_orders_paginated(user_id, page=1, limit=10):
    """
    Direct SQL/ORM implementation for fetching paginated orders for a specific user,
    strictly sorted by created_at DESC.
    Populates the 6 mandatory fields required by UI.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        offset = (page - 1) * limit
        query = """
            SELECT 
                o.order_id,
                o.user_id,
                r.name AS restaurant_name,
                o.created_at,
                GROUP_CONCAT(m.name || ' x' || ci.quantity, ', ') AS item_summary,
                o.total_price AS total_egp,
                o.status
            FROM Orders o
            JOIN CartItems ci ON o.cart_id = ci.cart_id
            JOIN MenuItems m ON ci.item_id = m.item_id
            JOIN Restaurants r ON m.restaurant_id = r.restaurant_id
            WHERE o.user_id = ?
            GROUP BY o.order_id
            ORDER BY o.created_at DESC
            LIMIT ? OFFSET ?
        """
        cursor.execute(query, (user_id, limit, offset))
        rows = cursor.fetchall()
        
        orders = []
        for row in rows:
            orders.append({
                "order_id": f"ORD-{row[0]}",
                "user_id": row[1],
                "restaurant_name": row[2],
                "created_at": row[3],
                "item_summary": row[4],
                "total_egp": float(row[5]),
                "status": row[6]
            })
        return orders
    except Exception as e:
        print(f"Database error in fetch_user_orders_paginated: {e}")
        return []
    finally:
        conn.close()
