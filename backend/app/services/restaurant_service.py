from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Static restaurant data (replaces DB for now)
# ---------------------------------------------------------------------------
_RESTAURANTS = [
    {
        "restaurant_id": "R001",
        "name": "Burger Palace",
        "cuisine_category": "American",
        "avg_rating": 4.5,
        "est_delivery_min": 25,
        "delivery_fee_egp": 15.00,
        "open_utc": "10:00",
        "close_utc": "22:00",
        "operating_hours_display": "10:00 AM – 10:00 PM",
    },
    {
        "restaurant_id": "R002",
        "name": "Pizza Kingdom",
        "cuisine_category": "Italian",
        "avg_rating": 4.2,
        "est_delivery_min": 35,
        "delivery_fee_egp": 20.00,
        "open_utc": "11:00",
        "close_utc": "23:00",
        "operating_hours_display": "11:00 AM – 11:00 PM",
    },
    {
        "restaurant_id": "R003",
        "name": "Sushi House",
        "cuisine_category": "Japanese",
        "avg_rating": 4.8,
        "est_delivery_min": 45,
        "delivery_fee_egp": 25.00,
        "open_utc": "12:00",
        "close_utc": "21:00",
        "operating_hours_display": "12:00 PM – 9:00 PM",
    },
    {
        "restaurant_id": "R004",
        "name": "Night Bites",
        "cuisine_category": "Street Food",
        "avg_rating": 3.9,
        "est_delivery_min": 20,
        "delivery_fee_egp": 10.00,
        "open_utc": "20:00",
        "close_utc": "04:00",
        "operating_hours_display": "8:00 PM – 4:00 AM",
    },
]


# ---------------------------------------------------------------------------
# REQ19 — server-side UTC clock (mockable in tests)
# ---------------------------------------------------------------------------
def get_server_time() -> str:
    """Return current UTC time as 'HH:MM'. Intentionally isolated so tests
    can mock it with @patch('app.services.restaurant_service.get_server_time')."""
    return datetime.now(timezone.utc).strftime("%H:%M")


# ---------------------------------------------------------------------------
# Operating-hours logic
# ---------------------------------------------------------------------------
def _to_minutes(t: str) -> int:
    h, m = map(int, t.split(":"))
    return h * 60 + m


def _is_open(open_utc: str, close_utc: str, current_time: str) -> bool:
    cur = _to_minutes(current_time)
    op = _to_minutes(open_utc)
    cl = _to_minutes(close_utc)

    if op < cl:
        # Normal window  e.g. 10:00 – 22:00
        return op <= cur < cl
    else:
        # Cross-midnight  e.g. 20:00 – 04:00
        return cur >= op or cur < cl


# ---------------------------------------------------------------------------
# Public service function
# ---------------------------------------------------------------------------
def get_all_restaurants() -> list:
    current_time = get_server_time()
    result = []
    for r in _RESTAURANTS:
        open_status = _is_open(r["open_utc"], r["close_utc"], current_time)
        result.append(
            {
                "restaurant_id": r["restaurant_id"],
                "name": r["name"],
                "cuisine_category": r["cuisine_category"],
                "avg_rating": r["avg_rating"],
                "est_delivery_min": r["est_delivery_min"],
                "delivery_fee_egp": r["delivery_fee_egp"],
                "is_open": open_status,
                "status_label": "Open" if open_status else "Currently Closed",
                "operating_hours_display": r["operating_hours_display"],
            }
        )
    return result
