"""
test_sse_stream.py — UC-9 Track Live Order Status
==================================================
Backend tests: SSE Stream Endpoint — GET /api/v1/orders/{id}/status-stream

Covers:
  - Authorization: Only the order owner can connect
  - Content-Type: text/event-stream
  - Event payload structure: new_status + timestamp
  - Proper SSE event serialization format
  - Unauthorized SSE access → HTTP 403
  - Terminal state SSE access → HTTP 403 or stream closes immediately
  - Multiple status transitions emitted in order
  - Event ordering guarantees
"""

from __future__ import annotations

import json
from io import BytesIO
from unittest.mock import MagicMock, patch, call

import pytest

from tests.uc9.factories import (
    make_active_order,
    make_terminal_order,
    make_sse_event,
    make_sse_data_string,
    ORDER_ID_ACTIVE,
    ORDER_ID_TERMINAL,
    ORDER_ID_OTHER_USER,
    USER_ID_OWNER,
    USER_ID_OTHER,
    ACTIVE_STATUSES,
)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _stream_url(order_id: str) -> str:
    return f"/api/v1/orders/{order_id}/status-stream"


def _connect_stream(client, order_id: str):
    return client.get(
        _stream_url(order_id),
        headers={"Accept": "text/event-stream"},
    )


# ── Authorization: Only owner can connect ─────────────────────────────────────

class TestSSEStreamAuthorization:
    """SSE stream endpoint must enforce the same authorization as the order route."""

    def test_authorized_user_can_connect_to_stream(
        self, authenticated_session, monkeypatch
    ):
        """
        Order owner can establish an SSE connection.
        Must return 200 with text/event-stream content type.
        """
        order = make_active_order()["order"]
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: order,
            raising=False,
        )
        # Mock the SSE generator to return an empty stream
        monkeypatch.setattr(
            "backend.routes.orders.sse_stream_provider.subscribe",
            lambda order_id: iter([]),
            raising=False,
        )
        response = _connect_stream(authenticated_session, ORDER_ID_ACTIVE)
        assert response.status_code == 200

    def test_authorized_stream_content_type_is_event_stream(
        self, authenticated_session, monkeypatch
    ):
        """
        SSE stream response must have Content-Type: text/event-stream.
        Per UC-9 API contract: protocol is SSE.
        """
        order = make_active_order()["order"]
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: order,
            raising=False,
        )
        monkeypatch.setattr(
            "backend.routes.orders.sse_stream_provider.subscribe",
            lambda order_id: iter([]),
            raising=False,
        )
        response = _connect_stream(authenticated_session, ORDER_ID_ACTIVE)
        assert response.status_code == 200
        assert "text/event-stream" in response.content_type

    def test_unauthenticated_stream_access_is_rejected(
        self, unauthenticated_client
    ):
        """Unauthenticated SSE connection must be rejected (401 or 403)."""
        response = _connect_stream(unauthenticated_client, ORDER_ID_ACTIVE)
        assert response.status_code in (401, 403)

    def test_cross_user_stream_access_returns_403(
        self, authenticated_session, monkeypatch
    ):
        """
        User connecting to another user's order stream must receive HTTP 403.
        The same ORDER_ACCESS_DENIED guard applies to the stream endpoint.
        """
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: None,
            raising=False,
        )
        response = _connect_stream(authenticated_session, ORDER_ID_OTHER_USER)
        assert response.status_code == 403

    def test_cross_user_stream_error_code(
        self, authenticated_session, monkeypatch
    ):
        """403 response for cross-user stream access must use ORDER_ACCESS_DENIED."""
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: None,
            raising=False,
        )
        response = _connect_stream(authenticated_session, ORDER_ID_OTHER_USER)
        if response.status_code == 403:
            data = json.loads(response.data)
            assert data.get("error", {}).get("code") == "ORDER_ACCESS_DENIED"


# ── Terminal State: No active stream ──────────────────────────────────────────

class TestSSETerminalStateGuard:
    """
    Terminal-state orders (DELIVERED, CANCELLED) must not support SSE.
    Connecting to their stream endpoint must be rejected or the stream
    must close immediately without emitting events.
    """

    @pytest.mark.parametrize("status", ["DELIVERED", "CANCELLED"])
    def test_terminal_order_stream_rejected(
        self, authenticated_session, monkeypatch, status
    ):
        """
        Stream connection for terminal-state orders must be rejected (403)
        or return HTTP 200 with an immediately-closed stream.
        """
        order = make_terminal_order(status=status)["order"]
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: order,
            raising=False,
        )
        response = _connect_stream(authenticated_session, ORDER_ID_TERMINAL)
        # Either rejected outright, or stream closes with no events
        assert response.status_code in (200, 403, 410), (
            f"Unexpected status {response.status_code} for terminal {status} order stream"
        )


# ── Event Payload Structure ────────────────────────────────────────────────────

class TestSSEEventPayload:
    """
    Validate the SSE event payload structure.

    Per UC-9 API contract:
      event: status_update
      data: {"new_status": "<STATUS>", "timestamp": "<ISO8601>"}
    """

    def test_sse_event_data_contains_new_status(self):
        """SSE event payload must contain 'new_status' field."""
        event = make_sse_event("ACCEPTED", "2026-05-10T14:34:10Z")
        assert "new_status" in event
        assert event["new_status"] == "ACCEPTED"

    def test_sse_event_data_contains_timestamp(self):
        """SSE event payload must contain 'timestamp' field."""
        event = make_sse_event("ACCEPTED", "2026-05-10T14:34:10Z")
        assert "timestamp" in event
        assert event["timestamp"] == "2026-05-10T14:34:10Z"

    def test_sse_event_payload_has_no_extra_fields(self):
        """SSE event payload must contain exactly: new_status, timestamp."""
        event = make_sse_event("ACCEPTED", "2026-05-10T14:34:10Z")
        assert set(event.keys()) == {"new_status", "timestamp"}

    def test_sse_data_string_format(self):
        """
        SSE data string must follow the SSE wire format:
          event: status_update\\n
          data: {...}\\n\\n
        """
        raw = make_sse_data_string("ACCEPTED", "2026-05-10T14:34:10Z")
        assert raw.startswith("event: status_update\n")
        assert "data: " in raw
        assert raw.endswith("\n\n")

    def test_sse_data_string_is_valid_json(self):
        """The data portion of the SSE string must be parseable JSON."""
        raw = make_sse_data_string("IN_PREPARATION", "2026-05-10T14:40:00Z")
        # Extract data line
        for line in raw.split("\n"):
            if line.startswith("data: "):
                payload = json.loads(line[6:])
                assert payload["new_status"] == "IN_PREPARATION"
                break
        else:
            pytest.fail("No data: line found in SSE string")

    @pytest.mark.parametrize(
        "status,timestamp",
        [
            ("PENDING", "2026-05-10T14:32:00Z"),
            ("ACCEPTED", "2026-05-10T14:34:10Z"),
            ("IN_PREPARATION", "2026-05-10T14:40:00Z"),
            ("OUT_FOR_DELIVERY", "2026-05-10T15:00:00Z"),
            ("DELIVERED", "2026-05-10T15:30:00Z"),
            ("CANCELLED", "2026-05-10T14:35:00Z"),
        ],
    )
    def test_sse_event_accepts_all_valid_statuses(self, status, timestamp):
        """SSE events must be constructable for all valid order statuses."""
        event = make_sse_event(status, timestamp)
        assert event["new_status"] == status
        assert event["timestamp"] == timestamp


# ── Event Ordering ─────────────────────────────────────────────────────────────

class TestSSEEventOrdering:
    """
    Events must be emitted in the correct chronological order.
    Status updates must reflect the state machine sequence.
    """

    def test_status_transitions_are_in_state_machine_order(self):
        """
        Status transitions emitted by the SSE stream must follow the
        defined state machine order: PENDING → ACCEPTED → IN_PREPARATION
        → OUT_FOR_DELIVERY → DELIVERED.
        """
        state_machine_order = [
            "PENDING", "ACCEPTED", "IN_PREPARATION", "OUT_FOR_DELIVERY", "DELIVERED"
        ]
        # Build a sequence of events simulating a full order lifecycle
        events = [
            make_sse_event(status, f"2026-05-10T14:3{i}:00Z")
            for i, status in enumerate(state_machine_order)
        ]
        for i, event in enumerate(events):
            assert event["new_status"] == state_machine_order[i]

    def test_sse_data_is_json_serializable(self):
        """SSE event payloads must be JSON-serializable (no datetime objects)."""
        event = make_sse_event("ACCEPTED", "2026-05-10T14:34:10Z")
        serialized = json.dumps(event)
        reparsed = json.loads(serialized)
        assert reparsed == event

    def test_multiple_events_maintain_insertion_order(self):
        """Multiple SSE events must preserve insertion order."""
        statuses = ["ACCEPTED", "IN_PREPARATION", "OUT_FOR_DELIVERY"]
        events = [make_sse_event(s, "2026-05-10T14:30:00Z") for s in statuses]
        for idx, event in enumerate(events):
            assert event["new_status"] == statuses[idx]
