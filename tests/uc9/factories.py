"""
factories.py — UC-9 Track Live Order Status
============================================
Deterministic data factories for building canonical UC-9 API response payloads
and SSE event payloads in backend tests.

Aligned strictly with the UC-9 API contract specification.
"""

from __future__ import annotations

from typing import Any

# ── Constants ─────────────────────────────────────────────────────────────────

ORDER_ID_ACTIVE = "ORD-20260510-001"
ORDER_ID_TERMINAL = "ORD-20260510-002"
ORDER_ID_OTHER_USER = "ORD-20260510-004"

USER_ID_OWNER = "USR-00001"
USER_ID_OTHER = "USR-00002"

STREAM_ENDPOINT = f"/api/v1/orders/{ORDER_ID_ACTIVE}/status-stream"

ACTIVE_STATUSES = ["PENDING", "ACCEPTED", "IN_PREPARATION", "OUT_FOR_DELIVERY"]
TERMINAL_STATUSES = ["DELIVERED", "CANCELLED"]

# ── Timeline factories ────────────────────────────────────────────────────────

_STAGE_ORDER = ["PENDING", "ACCEPTED", "IN_PREPARATION", "OUT_FOR_DELIVERY", "DELIVERED"]

_COMPLETED_TIMESTAMPS: dict[str, str] = {
    "PENDING": "2026-05-10T14:32:00Z",
    "ACCEPTED": "2026-05-10T14:34:10Z",
    "IN_PREPARATION": "2026-05-10T14:40:00Z",
    "OUT_FOR_DELIVERY": "2026-05-10T15:00:00Z",
    "DELIVERED": "2026-05-10T15:30:00Z",
}


def make_timeline(current_status: str) -> list[dict[str, Any]]:
    """
    Build a 5-stage status timeline for a given active status.

    Stages before current_status are completed=True with timestamps.
    current_status and subsequent stages are completed=False, timestamp=None.
    """
    current_index = _STAGE_ORDER.index(current_status) if current_status in _STAGE_ORDER else -1

    return [
        {
            "stage": stage,
            "completed": idx < current_index,
            "timestamp": _COMPLETED_TIMESTAMPS[stage] if idx < current_index else None,
        }
        for idx, stage in enumerate(_STAGE_ORDER)
    ]


def make_delivered_timeline() -> list[dict[str, Any]]:
    """Build a fully-completed timeline for DELIVERED status."""
    return [
        {"stage": stage, "completed": True, "timestamp": _COMPLETED_TIMESTAMPS[stage]}
        for stage in _STAGE_ORDER
    ]


def make_cancelled_timeline() -> list[dict[str, Any]]:
    """Build a timeline for a CANCELLED order (only PENDING completed)."""
    return [
        {
            "stage": stage,
            "completed": stage == "PENDING",
            "timestamp": _COMPLETED_TIMESTAMPS["PENDING"] if stage == "PENDING" else None,
        }
        for stage in _STAGE_ORDER
    ]


# ── Order factories ───────────────────────────────────────────────────────────

def make_active_order(
    order_id: str = ORDER_ID_ACTIVE,
    status: str = "IN_PREPARATION",
    user_id: str = USER_ID_OWNER,
    **overrides: Any,
) -> dict[str, Any]:
    """
    Build a canonical active order payload.
    Returns the full API response body: {"order": {...}}.
    """
    order = {
        "order_id": order_id,
        "status": status,
        "restaurant_id": "R001",
        "restaurant_name": "Burger Palace",
        "items": [
            {
                "item_id": "I001",
                "name": "Classic Burger",
                "quantity": 2,
                "unit_price_egp": 75.00,
                "line_total_egp": 150.00,
            }
        ],
        "server_computed_total_egp": 150.00,
        "delivery_address": {
            "street": "15 El-Geish Street",
            "city": "Alexandria",
            "notes": "Ring doorbell twice.",
        },
        "special_instructions": "No onions, please.",
        "payment_reference": "PAY-GW-TXN-77241",
        "created_at": "2026-05-10T14:32:00Z",
        "cancellable": False,
        "status_timeline": make_timeline(status),
        "stream_endpoint": f"/api/v1/orders/{order_id}/status-stream",
        **overrides,
    }
    return {"order": order}


def make_terminal_order(
    order_id: str = ORDER_ID_TERMINAL,
    status: str = "DELIVERED",
    **overrides: Any,
) -> dict[str, Any]:
    """
    Build a canonical terminal-state order payload.
    stream_endpoint is always null for terminal orders.
    Returns the full API response body: {"order": {...}}.
    """
    if status == "CANCELLED":
        timeline = make_cancelled_timeline()
    else:
        timeline = make_delivered_timeline()

    order = {
        "order_id": order_id,
        "status": status,
        "restaurant_id": "R001",
        "restaurant_name": "Burger Palace",
        "items": [
            {
                "item_id": "I001",
                "name": "Classic Burger",
                "quantity": 2,
                "unit_price_egp": 75.00,
                "line_total_egp": 150.00,
            }
        ],
        "server_computed_total_egp": 150.00,
        "delivery_address": {
            "street": "15 El-Geish Street",
            "city": "Alexandria",
            "notes": "Ring doorbell twice.",
        },
        "special_instructions": "No onions, please.",
        "payment_reference": "PAY-GW-TXN-77241",
        "created_at": "2026-05-10T14:32:00Z",
        "cancellable": False,
        "status_timeline": timeline,
        "stream_endpoint": None,  # ← Terminal state guard: always null
        **overrides,
    }
    return {"order": order}


def make_access_denied_error() -> dict[str, Any]:
    """
    Build the canonical 403 ORDER_ACCESS_DENIED error envelope.

    Per UC-9 security rules, this response is structurally identical
    whether the order does not exist or belongs to another user.
    """
    return {
        "error": {
            "code": "ORDER_ACCESS_DENIED",
            "message": "You do not have permission to access this order.",
        }
    }


def make_sse_event(new_status: str, timestamp: str) -> dict[str, Any]:
    """
    Build a canonical SSE status_update event payload.

    Per UC-9 API contract:
      data: {"new_status": "ACCEPTED", "timestamp": "2026-05-10T14:34:10Z"}
    """
    return {
        "new_status": new_status,
        "timestamp": timestamp,
    }


def make_sse_data_string(new_status: str, timestamp: str) -> str:
    """
    Format an SSE event as a raw SSE data string.
    E.g.:  "event: status_update\ndata: {\"new_status\": ...}\n\n"
    """
    import json
    payload = make_sse_event(new_status, timestamp)
    return f"event: status_update\ndata: {json.dumps(payload)}\n\n"
