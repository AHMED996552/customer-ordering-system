"""
backend/routes/orders.py
UC-9 — Track Live Order Status

Flask Blueprint: Order tracking routes.

Routes:
  GET /api/v1/orders/<order_id>
    → Returns order data + stream_endpoint (null for terminal orders)
    → HTTP 403 with ORDER_ACCESS_DENIED for nonexistent or unauthorized orders

  GET /api/v1/orders/<order_id>/status-stream
    → SSE stream for live status updates
    → HTTP 403 for unauthorized access
    → Requires active (non-terminal) order

CRITICAL: The monkeypatch targets in the test suite are:
  backend.routes.orders.order_repository.get_order_for_user
  backend.routes.orders.sse_stream_provider.subscribe

These are MODULE-LEVEL references, so order_repository and sse_stream_provider
must be imported at module level and referenced directly — NOT via string
lookups at call time. This is what makes monkeypatching work.
"""

from __future__ import annotations

import json
from typing import Any

from flask import Blueprint, Response, jsonify, session, stream_with_context

# ── Module-level imports — these are the monkeypatch targets ─────────────────
# Tests patch: backend.routes.orders.order_repository.get_order_for_user
# Tests patch: backend.routes.orders.sse_stream_provider.subscribe
from backend.repositories import order_repository
from backend.streams.sse import sse_stream_provider, format_sse_event

# ── Constants ─────────────────────────────────────────────────────────────────

TERMINAL_STATUSES = frozenset({"DELIVERED", "CANCELLED"})

ACCESS_DENIED_RESPONSE = {
    "error": {
        "code": "ORDER_ACCESS_DENIED",
        "message": "You do not have permission to access this order.",
    }
}

# ── Blueprint ─────────────────────────────────────────────────────────────────

orders_bp = Blueprint("orders", __name__, url_prefix="/api/v1/orders")


# ── Authorization helper ───────────────────────────────────────────────────────

def _get_authenticated_user_id() -> str | None:
    """
    Resolve the authenticated user ID from the server-side session.

    Per UC-9: 'Identity is resolved exclusively from the server-side session.
    No user_id is accepted in the request.'

    Returns the user_id string if valid, otherwise None.
    """
    user_id = session.get("user_id")
    if not user_id or not isinstance(user_id, str) or not user_id.strip():
        return None
    return user_id


def _build_stream_endpoint(order_id: str, status: str) -> str | None:
    """
    Return the SSE stream endpoint URL for active orders, or None for terminal orders.

    Per UC-9 Terminal State Guard:
      - DELIVERED or CANCELLED → stream_endpoint = null
      - All other statuses → valid stream URL
    """
    if status in TERMINAL_STATUSES:
        return None
    return f"/api/v1/orders/{order_id}/status-stream"


# ── Route: GET /api/v1/orders/<order_id> ─────────────────────────────────────

@orders_bp.route("/<order_id>", methods=["GET"])
def get_order(order_id: str) -> tuple[Response, int] | Response:
    """
    UC-9: Retrieve order status and tracking information.

    Authorization Guard:
      - Resolves identity from session (not request body/params)
      - Returns identical HTTP 403 ORDER_ACCESS_DENIED for:
        * nonexistent orders
        * orders belonging to another user
      - Never returns HTTP 404 (prevents order ID enumeration)

    Terminal State Guard:
      - Returns stream_endpoint: null for DELIVERED/CANCELLED orders
      - Returns valid stream_endpoint for all active statuses

    Response: HTTP 200 with full order object, or HTTP 403 with error envelope.
    """
    # ── Step 1: Resolve authenticated user from session ───────────────────────
    user_id = _get_authenticated_user_id()
    if user_id is None:
        return jsonify(ACCESS_DENIED_RESPONSE), 403

    # ── Step 2: Authorization guard (single query path) ───────────────────────
    # get_order_for_user returns None for both nonexistent and unauthorized orders.
    # This is the anti-enumeration mechanism: the caller cannot distinguish them.
    try:
        order = order_repository.get_order_for_user(order_id, user_id)
    except Exception:
        # DB errors must not leak internal details
        return jsonify({"error": {"code": "INTERNAL_SERVER_ERROR", "message": "An unexpected error occurred."}}), 500

    if order is None:
        # SECURITY: Identical response whether order doesn't exist or belongs to another user.
        # HTTP 404 is never returned here.
        return jsonify(ACCESS_DENIED_RESPONSE), 403

    # ── Step 3: Build response with terminal-state guard ─────────────────────
    status = order.get("status", "")
    stream_endpoint = _build_stream_endpoint(order_id, status)

    # Merge stream_endpoint into the order object (may override stored value)
    order_response = dict(order)
    order_response["stream_endpoint"] = stream_endpoint

    # Remove internal fields not part of the API contract
    order_response.pop("user_id", None)

    return jsonify({"order": order_response}), 200


# ── Route: GET /api/v1/orders/<order_id>/status-stream ────────────────────────

@orders_bp.route("/<order_id>/status-stream", methods=["GET"])
def get_order_status_stream(order_id: str) -> tuple[Response, int] | Response:
    """
    UC-9: SSE stream for live order status updates.

    Authorization Guard:
      - Same authorization check as the main order route
      - HTTP 403 ORDER_ACCESS_DENIED for unauthorized access

    Terminal State Guard:
      - HTTP 403 for terminal-state orders (DELIVERED, CANCELLED)
        since stream_endpoint is null for these orders

    SSE Protocol:
      Content-Type: text/event-stream
      Events: event: status_update\\ndata: {"new_status": "...", "timestamp": "..."}\\n\\n
    """
    # ── Step 1: Authenticate ──────────────────────────────────────────────────
    user_id = _get_authenticated_user_id()
    if user_id is None:
        return jsonify(ACCESS_DENIED_RESPONSE), 403

    # ── Step 2: Authorize (same single-query path) ────────────────────────────
    try:
        order = order_repository.get_order_for_user(order_id, user_id)
    except Exception:
        return jsonify({"error": {"code": "INTERNAL_SERVER_ERROR", "message": "An unexpected error occurred."}}), 500

    if order is None:
        return jsonify(ACCESS_DENIED_RESPONSE), 403

    # ── Step 3: Terminal state guard ──────────────────────────────────────────
    status = order.get("status", "")
    if status in TERMINAL_STATUSES:
        # Terminal orders have stream_endpoint = null; no active stream exists
        return jsonify(ACCESS_DENIED_RESPONSE), 403

    # ── Step 4: Stream SSE events ─────────────────────────────────────────────
    def _generate():
        """Generator yielding SSE events from the stream provider."""
        try:
            for event_data in sse_stream_provider.subscribe(order_id):
                yield event_data
        except GeneratorExit:
            pass

    return Response(
        stream_with_context(_generate()),
        status=200,
        content_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
