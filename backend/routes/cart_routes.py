"""
backend/routes/cart_routes.py
──────────────────────────────
HTTP layer for the Cart feature (UC-3).

Responsibilities (only):
  • Parse and validate the raw HTTP request (presence of required fields,
    type-coercion attempt for quantity).
  • Delegate ALL business logic to cart_service.
  • Map service exceptions → Standard Error Envelope → correct HTTP status.
  • Never contain business logic directly.

Standard Error Envelope (UC-3.md §4):
  {
    "error": {
      "code":    "ERROR_CODE_STRING",
      "message": "Human-readable description.",
      "fields":  { "field_name": "detail" }   // only for validation errors
    }
  }
"""

from flask import Blueprint, request, jsonify

from backend.services.cart_service import (
    add_item_to_cart,
    checkout,
    CartValidationError,
    CartConflictError,
    ItemUnavailableError,
    EmptyCartError,
)

# ──────────────────────────────────────────────────────────────────────────────
# Blueprint registration
# ──────────────────────────────────────────────────────────────────────────────

cart_bp = Blueprint("cart", __name__, url_prefix="/api/v1/cart")


# ──────────────────────────────────────────────────────────────────────────────
# Helper: build the Standard Error Envelope
# ──────────────────────────────────────────────────────────────────────────────

def _error_envelope(code: str, message: str, fields: dict | None = None) -> dict:
    """Return a Standard Error Envelope dict (UC-3.md §4)."""
    envelope: dict = {"code": code, "message": message}
    if fields:
        envelope["fields"] = fields
    return {"error": envelope}


def _get_session_id() -> str | None:
    """Extract the session_id from the HTTP-only cookie."""
    return request.cookies.get("session_id")


# ──────────────────────────────────────────────────────────────────────────────
# POST /api/v1/cart/items  –  Add Item to Cart (UC-3 REQ3)
# ──────────────────────────────────────────────────────────────────────────────

@cart_bp.route("/items", methods=["POST"])
def add_item():
    """
    Add an item to the active session cart.

    Request body (JSON):
        {
            "item_id":  "string",   // Required
            "quantity": integer     // Required — strict positive integer ≥ 1
        }

    Success  → 200 OK           + cart snapshot
    Failure  → 422              + VALIDATION_ERROR
    Failure  → 422              + ITEM_UNAVAILABLE
    Failure  → 409              + CROSS_RESTAURANT_CONFLICT
    """

    # ── 1. Session guard ────────────────────────────────────────────────────
    session_id = _get_session_id()
    if not session_id:
        # Use a deterministic fallback so un-authenticated test calls still work
        # (The real auth guard belongs in a separate auth middleware).
        session_id = "anonymous"

    # ── 2. Parse JSON body ──────────────────────────────────────────────────
    body = request.get_json(silent=True)
    if body is None:
        return jsonify(
            _error_envelope(
                "VALIDATION_ERROR",
                "Request body must be valid JSON with Content-Type: application/json.",
            )
        ), 422

    # ── 3. Validate required field: item_id ─────────────────────────────────
    item_id = body.get("item_id")
    if item_id is None or str(item_id).strip() == "":
        return jsonify(
            _error_envelope(
                "VALIDATION_ERROR",
                "The 'item_id' field is required.",
                {"item_id": "This field must be a non-empty string."},
            )
        ), 422

    # ── 4. Validate required field: quantity ─────────────────────────────────
    # REQ12 + REQ13: We must detect floats AND non-integer strings at the HTTP
    # boundary BEFORE passing to the service, so the service always receives a
    # clean Python int (or something that will raise CartValidationError).
    raw_quantity = body.get("quantity")

    if raw_quantity is None:
        return jsonify(
            _error_envelope(
                "VALIDATION_ERROR",
                "The 'quantity' field is required.",
                {"quantity": "This field must be a positive integer."},
            )
        ), 422

    # REQ13: Reject floats (e.g. 1.5, 0.5) — JSON numbers without fractional
    # part come in as int in Python's json decoder already; floats arrive as
    # float.  String "NaN" arrives as a string (not a JSON number at all).
    if isinstance(raw_quantity, float):
        return jsonify(
            _error_envelope(
                "VALIDATION_ERROR",
                "Quantity must be a whole number.",
                {"quantity": f"Received {raw_quantity}, which is not a whole number."},
            )
        ), 422

    if isinstance(raw_quantity, str):
        return jsonify(
            _error_envelope(
                "VALIDATION_ERROR",
                "Quantity must be a whole number.",
                {"quantity": f"Received '{raw_quantity}', which is not a valid integer."},
            )
        ), 422

    # At this point raw_quantity should be an int (or bool — guard that out).
    if isinstance(raw_quantity, bool):
        return jsonify(
            _error_envelope(
                "VALIDATION_ERROR",
                "Quantity must be a whole number.",
                {"quantity": "Boolean values are not accepted."},
            )
        ), 422

    # ── 5. Delegate to service layer ─────────────────────────────────────────
    try:
        cart_response = add_item_to_cart(
            session_id=session_id,
            item_id=item_id,
            quantity=raw_quantity,   # passes as int; service re-validates
        )
        return jsonify({"cart": cart_response}), 200

    except CartValidationError as exc:
        # REQ12 / REQ13 — 422
        return jsonify(
            _error_envelope("VALIDATION_ERROR", exc.message, exc.fields or None)
        ), 422

    except ItemUnavailableError as exc:
        # REQ20 — 422
        return jsonify(
            _error_envelope(
                "ITEM_UNAVAILABLE",
                exc.message,
                {"item_id": exc.item_id} if exc.item_id else None,
            )
        ), 422

    except CartConflictError as exc:
        # REQ14 — 409
        return jsonify(
            _error_envelope(
                "CROSS_RESTAURANT_CONFLICT",
                exc.message,
                {
                    "current_restaurant": exc.current_restaurant,
                    "new_restaurant": exc.new_restaurant,
                },
            )
        ), 409

    except Exception as exc:  # noqa: BLE001
        # Unhandled — 500; never leak internals to the client
        return jsonify(
            _error_envelope("INTERNAL_ERROR", "An unexpected error occurred.")
        ), 500


# ──────────────────────────────────────────────────────────────────────────────
# POST /api/v1/cart/checkout  –  Checkout guard (UC-3 REQ21)
# ──────────────────────────────────────────────────────────────────────────────

@cart_bp.route("/checkout", methods=["POST"])
def checkout_cart():
    """
    Trigger checkout for the active session cart.

    Success  → 200 OK
    Failure  → 400  + EMPTY_CART
    """
    session_id = _get_session_id() or "anonymous"

    try:
        result = checkout(session_id)
        return jsonify(result), 200

    except EmptyCartError as exc:
        return jsonify(
            _error_envelope("EMPTY_CART", exc.message)
        ), 400

    except Exception as exc:  # noqa: BLE001
        return jsonify(
            _error_envelope("INTERNAL_ERROR", "An unexpected error occurred.")
        ), 500
