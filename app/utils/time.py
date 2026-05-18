"""
app/utils/time.py
-----------------
Server-side UTC clock authority for UC-10.

NEVER accept client-supplied timestamps. All temporal decisions (cancellation
window enforcement) are made exclusively using `server_utc_now()`.

This thin wrapper exists so that tests can patch it via:
    @patch('app.utils.time.server_utc_now')
"""

from datetime import datetime, timezone


def server_utc_now() -> datetime:
    """
    Returns the current UTC time as a timezone-aware datetime object.

    This is the SOLE authoritative time source for all server-side temporal
    decisions.  It is a named function (not an inline call) so that the test
    suite can substitute a deterministic mock without monkey-patching the
    standard library.
    """
    return datetime.now(timezone.utc)
