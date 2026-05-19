import os
import sqlite3
from flask import current_app
from backend.services.restaurant_service import parse_operating_hours

def get_operating_hours(restaurant_id: str) -> dict:
    """
    Fetches the operating hours for a given restaurant from the database.
    """
    db_path = "customer_ordering_system.db"
    try:
        if current_app:
            db_path = current_app.config.get("DATABASE_PATH") or db_path
    except RuntimeError:
        pass
    
    db_path = os.environ.get("DATABASE_PATH") or db_path
    
    if not os.path.exists(db_path):
        return None
        
    try:
        # Extract integer ID
        import re
        digits = re.sub(r"\D", "", str(restaurant_id))
        if not digits:
            return None
            
        res_id = int(digits)
        
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("SELECT operating_hours FROM Restaurants WHERE restaurant_id = ?", (res_id,))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return None
        
        if row["operating_hours"]:
            op_display = row["operating_hours"]
            open_utc, close_utc = parse_operating_hours(op_display)
            return {"open": open_utc, "close": close_utc}
            
        # Row exists but no operating_hours column value — use fallback
        return {"open": "10:00", "close": "22:00"}
            
    except Exception as e:
        print(f"Error fetching operating hours for {restaurant_id}: {e}")
        
    return None
