"""
app/__init__.py
---------------
Thin alias package so that test patches on `app.utils.time` and
`app.services.payment` resolve to the real implementations inside `backend`.

The test suite uses:
    @patch('app.utils.time.server_utc_now')
    @patch('app.services.payment.process_refund')

This package satisfies those import paths without duplicating any logic.
"""

# Re-export the backend package's public API so the top-level `app` package
# behaves identically to `backend` for callers that import from `app.*`.
from backend import create_app  # noqa: F401
