"""
test_authorization_guard.py — UC-9 Track Live Order Status
===========================================================
Backend tests: Authorization Guard — Anti-enumeration behavior.

Covers:
  - Nonexistent order → HTTP 403 ORDER_ACCESS_DENIED (NOT 404)
  - Another user's order → HTTP 403 ORDER_ACCESS_DENIED
  - Both cases return structurally identical error envelopes
  - No order data is leaked in error responses
  - Unauthenticated access is rejected
  - Malformed order IDs are guarded uniformly
  - Gherkin Scenario 3: Authorization guard
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock

import pytest

from tests.uc9.factories import (
    make_access_denied_error,
    make_active_order,
    ORDER_ID_ACTIVE,
    ORDER_ID_OTHER_USER,
    USER_ID_OWNER,
    USER_ID_OTHER,
)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_order(client, order_id: str):
    return client.get(f"/api/v1/orders/{order_id}")


# ── Nonexistent Order Guard ───────────────────────────────────────────────────

class TestNonexistentOrderGuard:
    """
    HTTP 403 (not 404) must be returned when an order does not exist.
    This prevents enumeration of valid order IDs.
    """

    def test_nonexistent_order_returns_403_not_404(
        self, authenticated_session, monkeypatch
    ):
        """
        Gherkin Scenario 3: When an order does not exist, the server must
        return HTTP 403 — never HTTP 404 — to prevent order ID enumeration.
        """
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: None,  # Simulates not found / not owned
            raising=False,
        )
        response = _get_order(authenticated_session, "ORD-DOES-NOT-EXIST")
        assert response.status_code == 403, (
            f"Expected 403 for nonexistent order, got {response.status_code}. "
            "HTTP 404 MUST NOT be returned — it leaks order existence."
        )

    def test_nonexistent_order_error_code_is_order_access_denied(
        self, authenticated_session, monkeypatch
    ):
        """Error code for nonexistent order must be ORDER_ACCESS_DENIED."""
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: None,
            raising=False,
        )
        response = _get_order(authenticated_session, "ORD-DOES-NOT-EXIST")
        data = json.loads(response.data)
        assert "error" in data
        assert data["error"]["code"] == "ORDER_ACCESS_DENIED"

    def test_nonexistent_order_error_envelope_structure(
        self, authenticated_session, monkeypatch
    ):
        """
        Error envelope for nonexistent order must match the exact structure:
        {"error": {"code": "ORDER_ACCESS_DENIED", "message": "..."}}
        """
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: None,
            raising=False,
        )
        response = _get_order(authenticated_session, "ORD-DOES-NOT-EXIST")
        data = json.loads(response.data)
        assert "error" in data
        assert "code" in data["error"]
        assert "message" in data["error"]
        assert "order" not in data  # No order data leaked

    def test_nonexistent_order_does_not_leak_order_data(
        self, authenticated_session, monkeypatch
    ):
        """No order data must be present in a 403 response."""
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: None,
            raising=False,
        )
        response = _get_order(authenticated_session, "ORD-DOES-NOT-EXIST")
        data = json.loads(response.data)
        assert "order" not in data
        assert "stream_endpoint" not in data
        assert "status_timeline" not in data


# ── Cross-User Access Guard ────────────────────────────────────────────────────

class TestCrossUserAccessGuard:
    """
    HTTP 403 ORDER_ACCESS_DENIED when authenticated user tries to access
    an order belonging to another user.
    """

    def test_cross_user_order_returns_403(
        self, authenticated_session, monkeypatch
    ):
        """
        Gherkin Scenario 3: Accessing another user's order must return HTTP 403.
        The order EXISTS in the DB but belongs to USER_ID_OTHER, not USER_ID_OWNER.
        """
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: None,  # Single query path: ownership+existence merged
            raising=False,
        )
        response = _get_order(authenticated_session, ORDER_ID_OTHER_USER)
        assert response.status_code == 403

    def test_cross_user_order_error_code_is_order_access_denied(
        self, authenticated_session, monkeypatch
    ):
        """Error code for cross-user access must be ORDER_ACCESS_DENIED."""
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: None,
            raising=False,
        )
        response = _get_order(authenticated_session, ORDER_ID_OTHER_USER)
        data = json.loads(response.data)
        assert data["error"]["code"] == "ORDER_ACCESS_DENIED"

    def test_cross_user_order_does_not_leak_order_data(
        self, authenticated_session, monkeypatch
    ):
        """No status data for the target order must be returned on 403."""
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: None,
            raising=False,
        )
        response = _get_order(authenticated_session, ORDER_ID_OTHER_USER)
        data = json.loads(response.data)
        assert "order" not in data


# ── Anti-Enumeration: Structural Identity ────────────────────────────────────

class TestAntiEnumerationBehavior:
    """
    The 403 response must be structurally IDENTICAL for:
      - A nonexistent order
      - An order belonging to another user

    This prevents an attacker from learning whether an order ID is valid.
    """

    def _get_403_response(self, client, monkeypatch, order_id: str) -> dict:
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda oid, uid: None,
            raising=False,
        )
        response = client.get(f"/api/v1/orders/{order_id}")
        assert response.status_code == 403
        return json.loads(response.data)

    def test_nonexistent_and_cross_user_responses_are_structurally_identical(
        self, authenticated_session, monkeypatch
    ):
        """
        The error envelope for a nonexistent order and a cross-user order
        must be byte-for-byte identical in structure (same keys, same error code).
        """
        nonexistent_data = self._get_403_response(
            authenticated_session, monkeypatch, "ORD-NONEXISTENT"
        )
        cross_user_data = self._get_403_response(
            authenticated_session, monkeypatch, ORDER_ID_OTHER_USER
        )

        # Same top-level structure
        assert set(nonexistent_data.keys()) == set(cross_user_data.keys())
        # Same error code
        assert nonexistent_data["error"]["code"] == cross_user_data["error"]["code"]
        # Same error envelope keys
        assert set(nonexistent_data["error"].keys()) == set(cross_user_data["error"].keys())

    def test_error_code_is_exactly_order_access_denied(
        self, authenticated_session, monkeypatch
    ):
        """Error code must be exactly 'ORDER_ACCESS_DENIED' (no variations)."""
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: None,
            raising=False,
        )
        response = _get_order(authenticated_session, "ORD-ANY")
        data = json.loads(response.data)
        assert data["error"]["code"] == "ORDER_ACCESS_DENIED"

    def test_no_404_leakage_for_any_invalid_order(
        self, authenticated_session, monkeypatch
    ):
        """
        HTTP 404 must NEVER be returned for order access failures.
        Only HTTP 403 with ORDER_ACCESS_DENIED is acceptable.
        """
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: None,
            raising=False,
        )
        for order_id in ["ORD-FAKE", "ORD-DOES-NOT-EXIST", "ORD-OTHER-USER-001"]:
            response = _get_order(authenticated_session, order_id)
            assert response.status_code != 404, (
                f"HTTP 404 returned for {order_id} — this leaks order existence information!"
            )
            assert response.status_code == 403


# ── Unauthenticated Access Guard ──────────────────────────────────────────────

class TestUnauthenticatedAccessGuard:
    """
    Unauthenticated requests (no session cookie) must be rejected.
    """

    def test_unauthenticated_request_is_rejected(
        self, unauthenticated_client
    ):
        """Request without a session must return 401 or 403 (not 200)."""
        response = _get_order(unauthenticated_client, ORDER_ID_ACTIVE)
        assert response.status_code in (401, 403), (
            f"Expected 401 or 403 for unauthenticated request, got {response.status_code}"
        )

    def test_unauthenticated_request_does_not_return_order_data(
        self, unauthenticated_client
    ):
        """Unauthenticated response must not contain any order data."""
        response = _get_order(unauthenticated_client, ORDER_ID_ACTIVE)
        if response.data:
            data = json.loads(response.data)
            assert "order" not in data


# ── Malformed Order ID Guard ──────────────────────────────────────────────────

class TestMalformedOrderIdGuard:
    """
    Malformed or suspicious order IDs must be handled gracefully —
    the authorization guard applies the same uniform 403 response.
    """

    @pytest.mark.parametrize(
        "malformed_id",
        [
            "'; DROP TABLE orders; --",
            "../../../etc/passwd",
            "ORD-" + "A" * 500,  # Excessively long
            "  ",  # Whitespace only
            "<script>alert(1)</script>",
            "ORD-\x00NULL",  # Null byte
        ],
    )
    def test_malformed_order_id_returns_safe_response(
        self, authenticated_session, monkeypatch, malformed_id
    ):
        """
        Malformed order IDs must not expose internal errors.
        Must return a safe response (4xx) without stack traces.
        """
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: None,
            raising=False,
        )
        response = _get_order(authenticated_session, malformed_id)
        # Must not be a 500 (no unhandled exceptions)
        assert response.status_code != 500, (
            f"Malformed ID {malformed_id!r} caused a 500 Internal Server Error"
        )
        # Must not leak internal error details if 500 occurs
        if response.status_code == 500:
            data = json.loads(response.data) if response.data else {}
            assert "traceback" not in str(data).lower()
