"""
backend/streams/sse.py
UC-9 — Track Live Order Status

Server-Sent Events (SSE) stream provider.

Provides:
  - sse_stream_provider: module-level object with `.subscribe(order_id)` method
    (monkeypatch target for tests: backend.routes.orders.sse_stream_provider.subscribe)
  - format_sse_event(): formats a dict as an SSE wire-format string
  - SSEStreamProvider: the provider class
"""

from __future__ import annotations

import json
from collections import defaultdict
from threading import Lock
from typing import Any, Generator, Iterator


TERMINAL_STATUSES = frozenset({"DELIVERED", "CANCELLED"})


def format_sse_event(event_type: str, data: dict[str, Any]) -> str:
    """
    Format a Server-Sent Event in the SSE wire format.

    Per UC-9 API contract:
      event: status_update
      data: {"new_status": "ACCEPTED", "timestamp": "2026-05-10T14:34:10Z"}

    Returns a string ending with \\n\\n (SSE event terminator).
    """
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


def format_status_update(new_status: str, timestamp: str) -> str:
    """
    Format a UC-9 status_update SSE event.
    """
    return format_sse_event(
        "status_update",
        {"new_status": new_status, "timestamp": timestamp},
    )


class SSEStreamProvider:
    """
    SSE stream provider for UC-9 order status updates.

    In a production system this would subscribe to a Redis Pub/Sub channel,
    a message broker, or a polling loop. Here it exposes a minimal interface
    that satisfies the test monkeypatch contract.

    Tests monkeypatch: backend.routes.orders.sse_stream_provider.subscribe
    """

    def subscribe(self, order_id: str) -> Iterator[str]:
        """
        Return an iterator of SSE event strings for the given order.

        Yields SSE-formatted strings. In production, this would block and
        yield events as they arrive. Here it yields nothing (empty stream)
        as the real data pipeline is beyond the scope of UC-9 tests.

        Yields:
            SSE wire-format strings (e.g. "event: status_update\\ndata: {...}\\n\\n")
        """
        # Real implementation would use a pub/sub subscription here.
        # Tests override this via monkeypatching.
        return iter([])  # pragma: no cover


# Module-level singleton — the monkeypatch target in tests
sse_stream_provider = SSEStreamProvider()
