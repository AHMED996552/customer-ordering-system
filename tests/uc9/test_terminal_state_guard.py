"""
test_terminal_state_guard.py — UC-9 Track Live Order Status
============================================================
Backend tests: Terminal State Guard.

Covers:
  - DELIVERED order → HTTP 200, stream_endpoint = null
  - CANCELLED order → HTTP 200, stream_endpoint = null
  - No SSE stream opened for terminal orders
  - Timeline is still fully returned for terminal orders
  - Active states (PENDING, ACCEPTED, IN_PREPARATION, OUT_FOR_DELIVERY) → valid stream_endpoint
  - Gherkin Scenario 4: Tracking a terminal-state order
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock

import pytest

from tests.uc9.factories import (
    make_active_order,
    make_terminal_order,
    make_delivered_timeline,
    make_cancelled_timeline,
    ORDER_ID_ACTIVE,
    ORDER_ID_TERMINAL,
    USER_ID_OWNER,
    ACTIVE_STATUSES,
    TERMINAL_STATUSES,
)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_order(client, order_id: str):
    return client.get(f"/api/v1/orders/{order_id}")


# ── DELIVERED Terminal State ──────────────────────────────────────────────────

class TestDeliveredOrderTerminalState:
    """
    Gherkin Scenario 4: Tracking a terminal-state (DELIVERED) order.
    """

    def test_delivered_order_returns_http_200(
        self, authenticated_session, monkeypatch
    ):
        """
        DELIVERED order must return HTTP 200 (not 410 Gone or any other code).
        The client should always be able to view the final state.
        """
        order = make_terminal_order(status="DELIVERED")["order"]
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: order,
            raising=False,
        )
        response = _get_order(authenticated_session, ORDER_ID_TERMINAL)
        assert response.status_code == 200

    def test_delivered_order_stream_endpoint_is_null(
        self, authenticated_session, monkeypatch
    ):
        """
        Gherkin Scenario 4: stream_endpoint must be null for DELIVERED orders.
        Client MUST NOT open an SSE connection when stream_endpoint is null.
        """
        order = make_terminal_order(status="DELIVERED")["order"]
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: order,
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_TERMINAL).data)
        assert data["order"]["stream_endpoint"] is None, (
            "stream_endpoint must be null for DELIVERED (terminal) orders. "
            "The client must not attempt to open an SSE connection."
        )

    def test_delivered_order_status_is_delivered(
        self, authenticated_session, monkeypatch
    ):
        """DELIVERED order response must have status = 'DELIVERED'."""
        order = make_terminal_order(status="DELIVERED")["order"]
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: order,
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_TERMINAL).data)
        assert data["order"]["status"] == "DELIVERED"

    def test_delivered_order_timeline_is_returned(
        self, authenticated_session, monkeypatch
    ):
        """
        Even for terminal orders, the full status_timeline must be returned.
        The client renders the complete journey.
        """
        order = make_terminal_order(status="DELIVERED")["order"]
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: order,
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_TERMINAL).data)
        assert isinstance(data["order"]["status_timeline"], list)
        assert len(data["order"]["status_timeline"]) == 5

    def test_delivered_order_all_stages_completed(
        self, authenticated_session, monkeypatch
    ):
        """All 5 stages must have completed=True for a DELIVERED order."""
        order = make_terminal_order(status="DELIVERED")["order"]
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: order,
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_TERMINAL).data)
        for entry in data["order"]["status_timeline"]:
            assert entry["completed"] is True, (
                f"Stage {entry['stage']} should be completed=True for DELIVERED order"
            )

    def test_delivered_order_all_stages_have_timestamps(
        self, authenticated_session, monkeypatch
    ):
        """All timeline stages for DELIVERED order must have non-null timestamps."""
        order = make_terminal_order(status="DELIVERED")["order"]
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: order,
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_TERMINAL).data)
        for entry in data["order"]["status_timeline"]:
            assert entry["timestamp"] is not None, (
                f"Stage {entry['stage']} should have a timestamp for DELIVERED order"
            )


# ── CANCELLED Terminal State ──────────────────────────────────────────────────

class TestCancelledOrderTerminalState:
    """Terminal state tests for CANCELLED orders."""

    def test_cancelled_order_returns_http_200(
        self, authenticated_session, monkeypatch
    ):
        """CANCELLED order must return HTTP 200."""
        order = make_terminal_order(status="CANCELLED")["order"]
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: order,
            raising=False,
        )
        response = _get_order(authenticated_session, ORDER_ID_TERMINAL)
        assert response.status_code == 200

    def test_cancelled_order_stream_endpoint_is_null(
        self, authenticated_session, monkeypatch
    ):
        """stream_endpoint must be null for CANCELLED orders."""
        order = make_terminal_order(status="CANCELLED")["order"]
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: order,
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_TERMINAL).data)
        assert data["order"]["stream_endpoint"] is None

    def test_cancelled_order_status_is_cancelled(
        self, authenticated_session, monkeypatch
    ):
        """CANCELLED order response must have status = 'CANCELLED'."""
        order = make_terminal_order(status="CANCELLED")["order"]
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: order,
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_TERMINAL).data)
        assert data["order"]["status"] == "CANCELLED"

    def test_cancelled_order_timeline_is_returned(
        self, authenticated_session, monkeypatch
    ):
        """Full status_timeline must be returned for CANCELLED orders."""
        order = make_terminal_order(status="CANCELLED")["order"]
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: order,
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_TERMINAL).data)
        assert isinstance(data["order"]["status_timeline"], list)
        assert len(data["order"]["status_timeline"]) == 5

    def test_cancelled_order_only_pending_is_completed(
        self, authenticated_session, monkeypatch
    ):
        """For CANCELLED order, only PENDING stage should be completed."""
        order = make_terminal_order(status="CANCELLED")["order"]
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: order,
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_TERMINAL).data)
        timeline = {entry["stage"]: entry for entry in data["order"]["status_timeline"]}
        assert timeline["PENDING"]["completed"] is True
        for stage in ["ACCEPTED", "IN_PREPARATION", "OUT_FOR_DELIVERY", "DELIVERED"]:
            assert timeline[stage]["completed"] is False


# ── Parametrized: Both Terminal States ────────────────────────────────────────

class TestBothTerminalStates:
    """Parametrized tests covering both DELIVERED and CANCELLED."""

    @pytest.mark.parametrize("status", TERMINAL_STATUSES)
    def test_terminal_order_stream_endpoint_is_null(
        self, authenticated_session, monkeypatch, status
    ):
        """stream_endpoint must be null for ALL terminal statuses."""
        order = make_terminal_order(status=status)["order"]
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: order,
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_TERMINAL).data)
        assert data["order"]["stream_endpoint"] is None, (
            f"stream_endpoint must be null for {status} terminal status"
        )

    @pytest.mark.parametrize("status", TERMINAL_STATUSES)
    def test_terminal_order_returns_200(
        self, authenticated_session, monkeypatch, status
    ):
        """HTTP 200 must be returned for all terminal statuses."""
        order = make_terminal_order(status=status)["order"]
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: order,
            raising=False,
        )
        response = _get_order(authenticated_session, ORDER_ID_TERMINAL)
        assert response.status_code == 200


# ── Active States: Valid stream_endpoint ──────────────────────────────────────

class TestActiveStateStreamEndpoint:
    """
    For ALL active (non-terminal) statuses, stream_endpoint must be
    a valid non-null string URL.
    """

    @pytest.mark.parametrize("status", ACTIVE_STATUSES)
    def test_active_order_stream_endpoint_is_valid_url(
        self, authenticated_session, monkeypatch, status
    ):
        """
        Gherkin Scenario 2 (outline): For every active status transition,
        the stream_endpoint must be non-null and a valid API path.
        """
        order = make_active_order(status=status)["order"]
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: order,
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_ACTIVE).data)
        endpoint = data["order"]["stream_endpoint"]
        assert endpoint is not None
        assert isinstance(endpoint, str)
        assert endpoint.startswith("/api/v1/orders/")
        assert endpoint.endswith("/status-stream")

    @pytest.mark.parametrize("status", ACTIVE_STATUSES)
    def test_active_order_returns_200(
        self, authenticated_session, monkeypatch, status
    ):
        """All active statuses must return HTTP 200."""
        order = make_active_order(status=status)["order"]
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: order,
            raising=False,
        )
        response = _get_order(authenticated_session, ORDER_ID_ACTIVE)
        assert response.status_code == 200
