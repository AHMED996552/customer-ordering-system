from typing import Optional

# This represents the database data.
# We include it here as a static fallback in case the monkeypatch fails or for real testing,
# but the tests will mock `get_menu_for_restaurant` directly.
MOCK_MENU_DB_DATA = {
    "restaurant": {
        "restaurant_id": "R001",
        "name": "Burger Palace",
        "is_open": True
    },
    "menu": [
        {
            "category": "Burgers",
            "items": [
                {
                    "item_id": "I001",
                    "name": "Classic Burger",
                    "description": "Beef patty, lettuce, tomato, house sauce.",
                    "price_egp": 75.00,
                    "available": True
                },
                {
                    "item_id": "I003",
                    "name": "Unavailable Special",
                    "description": "Chef's secret recipe.",
                    "price_egp": 50.00,
                    "available": False
                }
            ]
        },
        {
            "category": "Sides",
            "items": [
                {
                    "item_id": "I004",
                    "name": "Loaded Fries",
                    "description": "Fries with cheese and jalapenos.",
                    "price_egp": 45.00,
                    "available": True
                }
            ]
        }
    ]
}

def get_menu_for_restaurant(restaurant_id: str) -> Optional[dict]:
    """
    Fetches the menu data for a specific restaurant.
    Returns None if the restaurant is not found.
    """
    if restaurant_id == "R001":
        # Return a copy to avoid mutating the static mock data
        import copy
        return copy.deepcopy(MOCK_MENU_DB_DATA)
    return None
