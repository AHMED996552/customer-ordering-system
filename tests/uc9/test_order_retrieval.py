"""
test_order_retrieval.py — UC-9 Track Live Order Status
=======================================================
Backend tests: Happy path — authorized order retrieval.

Covers:
  - HTTP 200 for authorized active order
  - Full API response contract validation (all fields, types)
  - stream_endpoint is a valid non-null URL for active orders
  - status_timeline structure: stage, completed, timestamp
  - items array, delivery_address, all required top-level fields
  - Gherkin Scenario 1: Successfully open order tracking page
"""

from __future__ import annotations

import json
from unittest.mock import patch, MagicMock
from typing import Any

import pytest

from tests.uc9.factories import (
    make_active_order,
    make_timeline,
    ORDER_ID_ACTIVE,
    ORDER_ID_TERMINAL,
    USER_ID_OWNER,
    STREAM_ENDPOINT,
    ACTIVE_STATUSES,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_order(client, order_id: str) -> Any:
    return client.get(f"/api/v1/orders/{order_id}")


# ── Happy path: active order retrieval ───────────────────────────────────────

class TestActiveOrderRetrieval:
    """
    Gherkin Scenario 1: Successfully open order tracking page and receive
    current order status. Validates the full HTTP 200 response contract.
    """

    def test_returns_http_200_for_authorized_active_order(
        self, authenticated_session, monkeypatch, active_order_payload
    ):
        """Authorized user retrieves their own active order → HTTP 200."""
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: active_order_payload["order"],
            raising=False,
        )
        response = _get_order(authenticated_session, ORDER_ID_ACTIVE)
        assert response.status_code == 200

    def test_response_contains_order_key(
        self, authenticated_session, monkeypatch, active_order_payload
    ):
        """Response body must have top-level 'order' key."""
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: active_order_payload["order"],
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_ACTIVE).data)
        assert "order" in data

    def test_response_order_id_matches_request(
        self, authenticated_session, monkeypatch, active_order_payload
    ):
        """Response order_id must match the requested order ID."""
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: active_order_payload["order"],
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_ACTIVE).data)
        assert data["order"]["order_id"] == ORDER_ID_ACTIVE

    def test_response_includes_status_field(
        self, authenticated_session, monkeypatch, active_order_payload
    ):
        """Response must include a 'status' string field."""
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: active_order_payload["order"],
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_ACTIVE).data)
        assert isinstance(data["order"]["status"], str)
        assert data["order"]["status"] in [
            "PENDING", "ACCEPTED", "IN_PREPARATION", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"
        ]

    def test_stream_endpoint_is_non_null_string_for_active_order(
        self, authenticated_session, monkeypatch, active_order_payload
    ):
        """
        Active order must return a non-null stream_endpoint string.
        Per UC-9: stream_endpoint is a URL for active orders.
        """
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: active_order_payload["order"],
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_ACTIVE).data)
        assert data["order"]["stream_endpoint"] is not None
        assert isinstance(data["order"]["stream_endpoint"], str)
        assert data["order"]["stream_endpoint"].startswith("/api/v1/orders/")
        assert "status-stream" in data["order"]["stream_endpoint"]

    def test_stream_endpoint_references_correct_order_id(
        self, authenticated_session, monkeypatch, active_order_payload
    ):
        """stream_endpoint must contain the requested order_id."""
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: active_order_payload["order"],
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_ACTIVE).data)
        assert ORDER_ID_ACTIVE in data["order"]["stream_endpoint"]

    # ── status_timeline contract ──────────────────────────────────────────────

    def test_status_timeline_is_a_list(
        self, authenticated_session, monkeypatch, active_order_payload
    ):
        """status_timeline must be an array."""
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: active_order_payload["order"],
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_ACTIVE).data)
        assert isinstance(data["order"]["status_timeline"], list)

    def test_status_timeline_has_five_stages(
        self, authenticated_session, monkeypatch, active_order_payload
    ):
        """status_timeline must have exactly 5 stages."""
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: active_order_payload["order"],
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_ACTIVE).data)
        assert len(data["order"]["status_timeline"]) == 5

    def test_status_timeline_stage_names(
        self, authenticated_session, monkeypatch, active_order_payload
    ):
        """status_timeline must contain all 5 defined stage names in order."""
        expected_stages = ["PENDING", "ACCEPTED", "IN_PREPARATION", "OUT_FOR_DELIVERY", "DELIVERED"]
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: active_order_payload["order"],
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_ACTIVE).data)
        actual_stages = [entry["stage"] for entry in data["order"]["status_timeline"]]
        assert actual_stages == expected_stages

    def test_status_timeline_completed_field_is_boolean(
        self, authenticated_session, monkeypatch, active_order_payload
    ):
        """Each timeline entry 'completed' field must be a boolean."""
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: active_order_payload["order"],
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_ACTIVE).data)
        for entry in data["order"]["status_timeline"]:
            assert isinstance(entry["completed"], bool), (
                f"Stage {entry['stage']} completed field is not bool: {entry['completed']!r}"
            )

    def test_status_timeline_timestamp_is_string_or_null(
        self, authenticated_session, monkeypatch, active_order_payload
    ):
        """Each timeline timestamp must be an ISO 8601 string or null."""
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: active_order_payload["order"],
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_ACTIVE).data)
        for entry in data["order"]["status_timeline"]:
            ts = entry.get("timestamp")
            assert ts is None or isinstance(ts, str), (
                f"Stage {entry['stage']} timestamp is invalid: {ts!r}"
            )

    def test_completed_stages_have_timestamps(
        self, authenticated_session, monkeypatch
    ):
        """
        Stages with completed=True must have a non-null timestamp.
        Stages with completed=False must have timestamp=null.
        """
        order = make_active_order(status="IN_PREPARATION")["order"]
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: order,
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_ACTIVE).data)
        for entry in data["order"]["status_timeline"]:
            if entry["completed"]:
                assert entry["timestamp"] is not None, (
                    f"Completed stage {entry['stage']} has null timestamp"
                )
            else:
                assert entry["timestamp"] is None, (
                    f"Incomplete stage {entry['stage']} has non-null timestamp"
                )

    # ── Items array contract ──────────────────────────────────────────────────

    def test_items_array_is_present_and_non_empty(
        self, authenticated_session, monkeypatch, active_order_payload
    ):
        """Response 'items' must be a non-empty list."""
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: active_order_payload["order"],
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_ACTIVE).data)
        items = data["order"]["items"]
        assert isinstance(items, list)
        assert len(items) > 0

    def test_item_fields_present(
        self, authenticated_session, monkeypatch, active_order_payload
    ):
        """Each item must have item_id, name, quantity, unit_price_egp, line_total_egp."""
        required_fields = {"item_id", "name", "quantity", "unit_price_egp", "line_total_egp"}
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: active_order_payload["order"],
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_ACTIVE).data)
        for item in data["order"]["items"]:
            missing = required_fields - set(item.keys())
            assert not missing, f"Item missing fields: {missing}"

    # ── Top-level required fields ─────────────────────────────────────────────

    @pytest.mark.parametrize(
        "field",
        [
            "order_id",
            "status",
            "restaurant_id",
            "restaurant_name",
            "items",
            "server_computed_total_egp",
            "delivery_address",
            "special_instructions",
            "payment_reference",
            "created_at",
            "cancellable",
            "status_timeline",
            "stream_endpoint",
        ],
    )
    def test_required_top_level_fields_present(
        self, authenticated_session, monkeypatch, active_order_payload, field
    ):
        """All required top-level fields from the API contract must be present."""
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: active_order_payload["order"],
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_ACTIVE).data)
        assert field in data["order"], f"Missing required field: '{field}'"

    def test_delivery_address_has_required_fields(
        self, authenticated_session, monkeypatch, active_order_payload
    ):
        """delivery_address must contain street, city, notes."""
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: active_order_payload["order"],
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_ACTIVE).data)
        addr = data["order"]["delivery_address"]
        assert "street" in addr
        assert "city" in addr
        assert "notes" in addr

    def test_cancellable_is_boolean(
        self, authenticated_session, monkeypatch, active_order_payload
    ):
        """'cancellable' must be a boolean."""
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: active_order_payload["order"],
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_ACTIVE).data)
        assert isinstance(data["order"]["cancellable"], bool)

    def test_server_computed_total_is_numeric(
        self, authenticated_session, monkeypatch, active_order_payload
    ):
        """server_computed_total_egp must be a number."""
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: active_order_payload["order"],
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_ACTIVE).data)
        total = data["order"]["server_computed_total_egp"]
        assert isinstance(total, (int, float))
        assert total >= 0

    # ── Content-Type ──────────────────────────────────────────────────────────

    def test_response_content_type_is_json(
        self, authenticated_session, monkeypatch, active_order_payload
    ):
        """Response Content-Type must be application/json."""
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: active_order_payload["order"],
            raising=False,
        )
        response = _get_order(authenticated_session, ORDER_ID_ACTIVE)
        assert "application/json" in response.content_type

    # ── Status-specific tests ─────────────────────────────────────────────────

    @pytest.mark.parametrize("status", ACTIVE_STATUSES)
    def test_active_status_returns_non_null_stream_endpoint(
        self, authenticated_session, monkeypatch, status
    ):
        """
        Gherkin Scenario 1 + Scenario 2 variations:
        For every active status, stream_endpoint must be non-null.
        """
        order = make_active_order(status=status)["order"]
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: order,
            raising=False,
        )
        data = json.loads(_get_order(authenticated_session, ORDER_ID_ACTIVE).data)
        assert data["order"]["stream_endpoint"] is not None
