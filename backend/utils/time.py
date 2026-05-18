from datetime import datetime, timezone

def server_utc_now() -> str:
    """
    Returns the current server UTC time as a formatted string.
    The UC-2 test suite mocks this to return "HH:MM".
    In a real implementation, this might return a full ISO string,
    but for the sake of boundary checking (e.g. 10:00 vs 22:00),
    we use the "HH:MM" format as tested.
    """
    return datetime.now(timezone.utc).strftime("%H:%M")
