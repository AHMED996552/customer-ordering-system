import os
import sqlite3
import re
from typing import Optional, Dict, Any, List
from flask import current_app

def get_item_description(name: str) -> str:
    """Generates an appetizing, luxury-tier description based on item name."""
    name_lower = name.lower()
    if "whopper" in name_lower:
        return "A signature flame-grilled beef patty topped with juicy tomatoes, fresh lettuce, creamy mayonnaise, ketchup, crunchy pickles, and sliced onions on a toasted sesame bun."
    if "fries" in name_lower:
        return "Golden, crispy premium potatoes seasoned to perfection with a touch of sea salt."
    if "pizza" in name_lower:
        return "Freshly rolled artisanal dough topped with our signature herb-infused tomato sauce, premium mozzarella, and gourmet toppings, baked to golden perfection."
    if "zinger" in name_lower:
        return "A double-breaded, extra-crispy spicy chicken breast fillet topped with fresh lettuce and creamy mayonnaise on a toasted bun."
    if "royale" in name_lower:
        return "A premium chicken fillet, lightly breaded and fried to golden perfection, topped with shredded lettuce and creamy mayo."
    if "wings" in name_lower:
        return "Tender, juicy chicken wings tossed in our signature blend of herbs and spices, fried to a perfect crisp."
    if "shake" in name_lower or "smoothie" in name_lower:
        return "A rich, creamy, and decadent hand-spun milkshake made with premium ice cream and whole milk."
    if "juice" in name_lower:
        return "Freshly squeezed, ice-cold premium fruit juice bursting with natural vitamins and refreshing flavor."
    if "latte" in name_lower or "cappuccino" in name_lower:
        return "Expertly brewed espresso shot combined with silky, steamed whole milk and topped with a velvety layer of microfoam."
    if "pepsi" in name_lower or "sprite" in name_lower or "can" in name_lower:
        return f"A refreshing, ice-cold canned {name} to perfectly complement your meal."
    if "burger" in name_lower:
        return "A premium, juicy beef patty grilled to perfection, topped with fresh lettuce, tomatoes, and our signature house sauce on a toasted bun."
    if "sandwich" in name_lower or "sub" in name_lower or "wrap" in name_lower:
        return "A fresh, gourmet sandwich layered with premium proteins, crisp greens, and house-made dressing on freshly baked bread."
    return f"A delicious, freshly prepared portion of {name}, crafted using only the finest premium ingredients for an extraordinary taste experience."

def get_item_category(name: str) -> str:
    """Categorizes items dynamically into logical and distinct menu categories."""
    name_lower = name.lower()
    if "pizza" in name_lower:
        return "Pizzas"
    if "pepsi" in name_lower or "sprite" in name_lower or "can" in name_lower or "juice" in name_lower or "shake" in name_lower or "latte" in name_lower or "cappuccino" in name_lower or "drink" in name_lower:
        return "Drinks"
    if "fries" in name_lower or "rings" in name_lower or "bread" in name_lower or "sticks" in name_lower or "salad" in name_lower or "wedges" in name_lower or "wings" in name_lower:
        return "Sides"
    if "burger" in name_lower or "whopper" in name_lower or "royale" in name_lower or "sandwich" in name_lower or "wrap" in name_lower or "zinger" in name_lower or "sub" in name_lower:
        return "Burgers"
    return "Mains"

def get_menu_for_restaurant(restaurant_id: str) -> Optional[Dict[str, Any]]:
    """
    Queries the SQLite database to retrieve the restaurant metadata and menu items.
    Groups the items by dynamically computed categories.
    """
    # 1. Clean and convert restaurant_id to integer (e.g. "R001" -> 1, "2" -> 2)
    digits = re.sub(r"\D", "", str(restaurant_id))
    if not digits:
        return None
    db_restaurant_id = int(digits)

    # 2. Get database path from Flask config or fallback
    db_path = "customer_ordering_system.db"
    try:
        if current_app:
            db_path = current_app.config.get("DATABASE_PATH") or db_path
    except RuntimeError:
        # Outside of application context (e.g. testing or running stand-alone scripts)
        pass

    db_path = os.environ.get("DATABASE_PATH") or db_path

    if not os.path.exists(db_path):
        return None

    # 3. Query Database
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        # Fetch Restaurant info
        cursor.execute(
            "SELECT name, status FROM Restaurants WHERE restaurant_id = ?",
            (db_restaurant_id,)
        )
        res_row = cursor.fetchone()
        if not res_row:
            return None

        restaurant_name = res_row["name"]
        is_open = (res_row["status"] == "OPEN")

        # Fetch Menu Items info
        cursor.execute(
            "SELECT item_id, name, price_egp, is_available FROM MenuItems WHERE restaurant_id = ?",
            (db_restaurant_id,)
        )
        item_rows = cursor.fetchall()

        # 4. Group Items by Category
        categories_dict: Dict[str, List[Dict[str, Any]]] = {}
        for row in item_rows:
            name = row["name"]
            cat = get_item_category(name)
            
            item_data = {
                "item_id": str(row["item_id"]),
                "name": name,
                "description": get_item_description(name),
                "price_egp": float(row["price_egp"]),
                "available": bool(row["is_available"])
            }
            
            if cat not in categories_dict:
                categories_dict[cat] = []
            categories_dict[cat].append(item_data)

        # 5. Format to the expected layout
        menu_categories = []
        # Maintain a elegant rendering order
        order_pref = ["Burgers", "Pizzas", "Mains", "Sides", "Drinks"]
        
        # Sort categories based on preference list, placing any others at the end
        sorted_cats = sorted(
            categories_dict.keys(),
            key=lambda x: order_pref.index(x) if x in order_pref else len(order_pref)
        )

        for cat in sorted_cats:
            menu_categories.append({
                "category": cat,
                "items": categories_dict[cat]
            })

        return {
            "restaurant": {
                "restaurant_id": str(restaurant_id),
                "name": restaurant_name,
                "is_open": is_open
            },
            "menu": menu_categories
        }

    except Exception as e:
        print(f"Error querying menu in service: {e}")
        return None
    finally:
        conn.close()
