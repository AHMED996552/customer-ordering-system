import sqlite3
from datetime import datetime

class OrderingSystemDB:
    def __init__(self, db_path="customer_ordering_system.db"):
        self.db_path = db_path
        self.init_db()

    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        # Requirement: Enable Foreign Key Support
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

    def init_db(self):
        """Initializes the database schema with strict constraints."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # 1. Restaurants Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS Restaurants (
                    restaurant_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    status TEXT CHECK(status IN ('OPEN', 'CLOSED')) DEFAULT 'OPEN',
                    operating_hours TEXT
                )
            """)

            # 2. MenuItems Table (REQ20: Availability Guard)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS MenuItems (
                    item_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    restaurant_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    price_egp REAL NOT NULL CHECK(price_egp > 0),
                    is_available BOOLEAN DEFAULT 1,
                    FOREIGN KEY (restaurant_id) REFERENCES Restaurants(restaurant_id)
                )
            """)

            # 3. Carts Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS Carts (
                    cart_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # 4. CartItems Table (REQ12 & REQ13: Quantity Guard)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS CartItems (
                    line_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    cart_id INTEGER NOT NULL,
                    item_id INTEGER NOT NULL,
                    quantity INTEGER NOT NULL CHECK(quantity >= 1), 
                    unit_price_at_addition REAL NOT NULL,
                    FOREIGN KEY (cart_id) REFERENCES Carts(cart_id),
                    FOREIGN KEY (item_id) REFERENCES MenuItems(item_id)
                )
            """)

            # 5. Orders Table (Idempotency via unique payment_reference)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS Orders (
                    order_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    cart_id INTEGER NOT NULL,
                    total_price REAL NOT NULL,
                    payment_reference TEXT UNIQUE NOT NULL,
                    status TEXT DEFAULT 'CONFIRMED',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (cart_id) REFERENCES Carts(cart_id)
                )
            """)
            conn.commit()
            print("DBA Trace: Database initialized with core padlocks.")

    def add_item_to_cart(self, cart_id, item_id, quantity):
        """
        Implements the 'Guard Chain' Logic:
        Quantity -> Availability -> Restaurant Consistency -> Server-Price fetching
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # GUARD 1: Quantity Check (Python side before DB hit)
            if not isinstance(quantity, int) or quantity < 1:
                raise ValueError("REQ12/13: Quantity must be a strict positive integer.")

            # GUARD 2: Fetch Item Data (Server-Side Authority)
            cursor.execute("SELECT restaurant_id, price_egp, is_available FROM MenuItems WHERE item_id = ?", (item_id,))
            item = cursor.fetchone()
            if not item:
                raise ValueError("Item not found.")
            
            res_id, price, is_available = item

            # GUARD 3: REQ20 Availability Guard
            if not is_available:
                raise ValueError("REQ20: This item is currently unavailable.")

            # GUARD 4: REQ14 Cross-Restaurant Guard
            cursor.execute("""
                SELECT m.restaurant_id FROM CartItems ci
                JOIN MenuItems m ON ci.item_id = m.item_id
                WHERE ci.cart_id = ? LIMIT 1
            """, (cart_id,))
            existing_cart_restaurant = cursor.fetchone()
            
            if existing_cart_restaurant and existing_cart_restaurant[0] != res_id:
                raise ValueError("REQ14: Cross-Restaurant Cart Pollution blocked (HTTP 409).")

            # SUCCESS PATH: Add to DB using authoritative price
            cursor.execute("""
                INSERT INTO CartItems (cart_id, item_id, quantity, unit_price_at_addition)
                VALUES (?, ?, ?, ?)
            """, (cart_id, item_id, quantity, price))
            
            conn.commit()
            print(f"DBA Trace: Item {item_id} added to Cart {cart_id} successfully.")
            return True

        except Exception as e:
            print(f"Application Guard Error: {e}")
            return False
        finally:
            conn.close()

# Example Usage for Validation
if __name__ == "__main__":
    db = OrderingSystemDB()
    
    # 1. Setup Sample Data
    with db.get_connection() as conn:
        c = conn.cursor()
        c.execute("INSERT OR IGNORE INTO Restaurants (restaurant_id, name) VALUES (1, 'Burger King'), (2, 'Pizza Hut')")
        c.execute("INSERT OR IGNORE INTO MenuItems (item_id, restaurant_id, name, price_egp, is_available) VALUES (101, 1, 'Whopper', 150.0, 1)")
        c.execute("INSERT OR IGNORE INTO MenuItems (item_id, restaurant_id, name, price_egp, is_available) VALUES (102, 2, 'Large Pizza', 300.0, 1)")
        c.execute("INSERT OR IGNORE INTO Carts (cart_id) VALUES (1)")
        conn.commit()

    # 2. Test Guard Chain
    print("\n--- Testing REQ12: Negative Quantity ---")
    db.add_item_to_cart(cart_id=1, item_id=101, quantity=-1)

    print("\n--- Testing Happy Path: Add Burger ---")
    db.add_item_to_cart(cart_id=1, item_id=101, quantity=2)

    print("\n--- Testing REQ14: Adding Pizza to Burger Cart (Conflict) ---")
    db.add_item_to_cart(cart_id=1, item_id=102, quantity=1)