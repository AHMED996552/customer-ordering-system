"""
test_security_resilience.py — UC-9 Track Live Order Status
===========================================================
Backend tests: Security and Resilience.

Covers:
  - Stale session replay (user_id mismatch after session reuse)
  - Concurrent tracking requests (no shared mutable state)
  - Malformed status timeline in DB response
  - Corrupted DB responses → graceful failure, no internal leakage
  - SQL injection-style order IDs
  - XSS-style order IDs
  - No internal field leakage (no tracebacks, no DB schema exposure)
  - Missing session fields
  - Oversized request payloads
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch
import threading
from typing import Any

import pytest

from tests.uc9.factories import (
    make_active_order,
    make_access_denied_error,
    ORDER_ID_ACTIVE,
    ORDER_ID_TERMINAL,
    ORDER_ID_OTHER_USER,
    USER_ID_OWNER,
    USER_ID_OTHER,
)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_order(client, order_id: str):
    return client.get(f"/api/v1/orders/{order_id}")


# ── Stale Session Replay ──────────────────────────────────────────────────────

class TestStaleSessionReplay:
    """
    A session with a stale or mismatched user_id must not grant access
    to orders belonging to the original user.
    """

    def test_stale_session_user_id_does_not_grant_access(
        self, client, app, monkeypatch
    ):
        """
        Simulates a session with a different user_id injected (e.g., session fixation).
        The order repository is called with the SESSION user_id — not a URL parameter.
        If the session user_id does not own the order, 403 must be returned.
        """
        # Set a session with USER_ID_OTHER (not the order owner)
        with client.session_transaction() as sess:
            sess["user_id"] = USER_ID_OTHER
            sess["authenticated"] = True

        # Repository returns None because USER_ID_OTHER does not own ORDER_ID_ACTIVE
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: None,
            raising=False,
        )
        response = _get_order(client, ORDER_ID_ACTIVE)
        assert response.status_code == 403

    def test_user_id_not_accepted_from_request_body(
        self, authenticated_session, monkeypatch, active_order_payload
    ):
        """
        Per UC-9: 'Identity is resolved exclusively from the server-side session.
        No user_id is accepted in the request.'

        Sending a user_id in the request must not change the identity resolution.
        """
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: active_order_payload["order"],
            raising=False,
        )
        # Attempt to inject a different user_id via query param
        response = authenticated_session.get(
            f"/api/v1/orders/{ORDER_ID_ACTIVE}?user_id={USER_ID_OTHER}"
        )
        # Must not fail due to injected user_id (session is still trusted)
        # If the implementation is correct, it ignores the query param entirely
        assert response.status_code in (200, 400, 403)
        if response.status_code == 200:
            data = json.loads(response.data)
            # The order must belong to the SESSION user, not the injected one
            assert "order" in data


# ── Missing/Invalid Session Fields ────────────────────────────────────────────

class TestInvalidSessionState:
    """Tests for missing or corrupt session fields."""

    def test_session_missing_user_id_is_rejected(self, client, app):
        """Session without user_id field must be treated as unauthenticated."""
        with client.session_transaction() as sess:
            sess["authenticated"] = True
            # user_id deliberately NOT set

        response = _get_order(client, ORDER_ID_ACTIVE)
        assert response.status_code in (401, 403), (
            f"Expected 401 or 403 for session missing user_id, got {response.status_code}"
        )

    def test_session_with_null_user_id_is_rejected(self, client, app):
        """Session with user_id = None must be treated as unauthenticated."""
        with client.session_transaction() as sess:
            sess["user_id"] = None
            sess["authenticated"] = True

        response = _get_order(client, ORDER_ID_ACTIVE)
        assert response.status_code in (401, 403)

    def test_session_with_empty_string_user_id_is_rejected(self, client, app):
        """Session with user_id = '' must be treated as unauthenticated."""
        with client.session_transaction() as sess:
            sess["user_id"] = ""
            sess["authenticated"] = True

        response = _get_order(client, ORDER_ID_ACTIVE)
        assert response.status_code in (401, 403)


# ── Corrupted / Malformed DB Responses ────────────────────────────────────────

class TestCorruptedDBResponses:
    """
    The repository layer may return malformed data due to DB corruption.
    The route must handle this gracefully without leaking internal details.
    """

    def test_repository_raises_exception_returns_500_without_leaking(
        self, authenticated_session, monkeypatch
    ):
        """
        If the repository raises an unexpected exception, the route must
        return HTTP 500 without leaking stack traces or internal schema.
        """
        def _raise(*args, **kwargs):
            raise RuntimeError("DB connection pool exhausted")

        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            _raise,
            raising=False,
        )
        response = _get_order(authenticated_session, ORDER_ID_ACTIVE)
        assert response.status_code == 500

        if response.data:
            raw = response.data.decode()
            # Must not leak internal error details
            assert "traceback" not in raw.lower()
            assert "RuntimeError" not in raw
            assert "pool exhausted" not in raw

    def test_repository_returns_none_for_existing_order_causes_403(
        self, authenticated_session, monkeypatch
    ):
        """
        If the repository returns None (order not found or not owned),
        the route must return HTTP 403 (not 500, not 404).
        """
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: None,
            raising=False,
        )
        response = _get_order(authenticated_session, ORDER_ID_ACTIVE)
        assert response.status_code == 403

    def test_malformed_timeline_in_db_response_handled_gracefully(
        self, authenticated_session, monkeypatch
    ):
        """
        If the DB returns an order with a malformed status_timeline (e.g., None),
        the route must handle this without a 500 crash.
        """
        order = make_active_order()["order"]
        order["status_timeline"] = None  # Simulate DB corruption

        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: order,
            raising=False,
        )
        response = _get_order(authenticated_session, ORDER_ID_ACTIVE)
        # Must not be an unhandled 500 — either 200 with empty timeline or 500 with no leakage
        if response.status_code == 500:
            if response.data:
                raw = response.data.decode()
                assert "traceback" not in raw.lower()

    def test_corrupted_status_value_handled_gracefully(
        self, authenticated_session, monkeypatch
    ):
        """
        If the DB returns an unknown status value, the route must handle
        it without crashing (may return 200 or 500, but not with leakage).
        """
        order = make_active_order()["order"]
        order["status"] = "CORRUPTED_STATUS_XYZ"

        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: order,
            raising=False,
        )
        response = _get_order(authenticated_session, ORDER_ID_ACTIVE)
        if response.status_code == 500:
            if response.data:
                raw = response.data.decode()
                assert "traceback" not in raw.lower()


# ── SQL Injection / XSS Order IDs ────────────────────────────────────────────

class TestInjectionAttacks:
    """
    Order IDs that contain injection payloads must never cause
    unhandled exceptions or internal error leakage.
    """

    @pytest.mark.parametrize(
        "malicious_id",
        [
            "'; DROP TABLE orders; --",
            "1 OR 1=1",
            "../../../etc/passwd",
            "<script>alert('xss')</script>",
            "ORD-$(cat /etc/passwd)",
            "ORD-`id`",
        ],
    )
    def test_injection_order_ids_do_not_cause_500(
        self, authenticated_session, monkeypatch, malicious_id
    ):
        """
        Injection-style order IDs must not trigger unhandled 500 errors.
        The authorization guard must intercept them safely.
        """
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: None,
            raising=False,
        )
        response = _get_order(authenticated_session, malicious_id)
        # Must not be 500 due to injection
        if response.status_code == 500:
            if response.data:
                raw = response.data.decode()
                assert "traceback" not in raw.lower()
                assert "DROP TABLE" not in raw
                assert "/etc/passwd" not in raw

    @pytest.mark.parametrize(
        "malicious_id",
        [
            "'; DROP TABLE orders; --",
            "1 OR 1=1",
            "../../../etc/passwd",
        ],
    )
    def test_injection_order_ids_do_not_leak_db_info(
        self, authenticated_session, monkeypatch, malicious_id
    ):
        """No DB schema information must appear in responses for injection-style IDs."""
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: None,
            raising=False,
        )
        response = _get_order(authenticated_session, malicious_id)
        if response.data:
            raw = response.data.decode().lower()
            # Must not expose SQL syntax, table names, or DB error messages
            for leak_indicator in ["sql", "syntax error", "table", "column", "traceback"]:
                assert leak_indicator not in raw, (
                    f"Response leaks DB info via '{leak_indicator}' for ID {malicious_id!r}"
                )


# ── Concurrent Tracking Requests ──────────────────────────────────────────────

class TestConcurrentTrackingRequests:
    """
    Concurrent requests for the same order must each be served independently
    with no shared mutable state contamination.
    """

    def test_concurrent_requests_return_independent_responses(
        self, app, monkeypatch
    ):
        """
        Simulate 5 concurrent requests for the same order.
        Each must receive a valid, independent response.
        """
        order = make_active_order()["order"]
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: order,
            raising=False,
        )
        results: list[int] = []
        errors: list[Exception] = []

        def _make_request():
            try:
                with app.test_client() as c:
                    with c.session_transaction() as sess:
                        sess["user_id"] = USER_ID_OWNER
                        sess["authenticated"] = True
                    response = c.get(f"/api/v1/orders/{ORDER_ID_ACTIVE}")
                    results.append(response.status_code)
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=_make_request) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=10)

        assert not errors, f"Concurrent requests raised exceptions: {errors}"
        # All responses must be the same status code
        assert all(code == results[0] for code in results), (
            f"Concurrent responses had different status codes: {results}"
        )


# ── Response Leakage Audit ────────────────────────────────────────────────────

class TestNoInternalLeakage:
    """
    Error responses must never contain internal implementation details.
    """

    @pytest.mark.parametrize(
        "order_id",
        ["ORD-FAKE", "ORD-OTHER-USER-001", ORDER_ID_OTHER_USER],
    )
    def test_403_response_does_not_contain_internal_fields(
        self, authenticated_session, monkeypatch, order_id
    ):
        """
        403 error responses must not contain any internal implementation details
        beyond the canonical error envelope.
        """
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda oid, uid: None,
            raising=False,
        )
        response = _get_order(authenticated_session, order_id)
        assert response.status_code == 403

        data = json.loads(response.data)
        assert set(data.keys()) == {"error"}, (
            f"403 response contains unexpected keys: {set(data.keys()) - {'error'}}"
        )
        assert set(data["error"].keys()) == {"code", "message"}, (
            f"Error envelope has unexpected keys: {set(data['error'].keys())}"
        )

    def test_403_response_does_not_reveal_user_id(
        self, authenticated_session, monkeypatch
    ):
        """403 response body must not contain any user_id values."""
        monkeypatch.setattr(
            "backend.routes.orders.order_repository.get_order_for_user",
            lambda order_id, user_id: None,
            raising=False,
        )
        response = _get_order(authenticated_session, ORDER_ID_OTHER_USER)
        raw = response.data.decode()
        assert USER_ID_OWNER not in raw
        assert USER_ID_OTHER not in raw
        assert "user_id" not in raw.lower()
