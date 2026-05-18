import pytest
import app.services.cart_service as cart_service


@pytest.fixture(autouse=True)
def clear_cart():
    cart_service.clear_cart()
    yield
    cart_service.clear_cart()


# ---------------------------------------------------------------------------
# REQ3 — Add Item to Cart
# ---------------------------------------------------------------------------

def test_tc01_add_valid_item_returns_200(client):
    """REQ3: Valid item + quantity → 200 with cart payload."""
    response = client.post("/api/v1/cart/items", json={"item_id": "I001", "quantity": 2})
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert any(line["item_id"] == "I001" for line in data["cart"])


def test_tc02_add_valid_item_accumulates_quantity(client):
    """REQ3: Adding same item twice accumulates quantity."""
    client.post("/api/v1/cart/items", json={"item_id": "I001", "quantity": 1})
    client.post("/api/v1/cart/items", json={"item_id": "I001", "quantity": 2})
    response = client.get("/api/v1/cart")
    data = response.get_json()
    item = next(l for l in data["cart"] if l["item_id"] == "I001")
    assert item["quantity"] == 3


# ---------------------------------------------------------------------------
# REQ12 — Negative / Zero Quantity Guard
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("qty", [0, -1, -100])
def test_tc03_non_positive_quantity_rejected(client, qty):
    """REQ12: Server rejects quantity ≤ 0 with 422 VALIDATION_ERROR."""
    response = client.post("/api/v1/cart/items", json={"item_id": "I001", "quantity": qty})
    assert response.status_code == 422
    data = response.get_json()
    assert data["error"]["code"] == "VALIDATION_ERROR"


# ---------------------------------------------------------------------------
# REQ13 — Fractional Quantity Guard
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("qty", [1.5, 0.5, 2.3])
def test_tc04_fractional_quantity_rejected(client, qty):
    """REQ13: Server rejects non-integer quantity with 422, message contains 'whole number'."""
    response = client.post("/api/v1/cart/items", json={"item_id": "I001", "quantity": qty})
    assert response.status_code == 422
    data = response.get_json()
    assert "whole number" in data["error"]["message"].lower()


def test_tc05_nan_string_quantity_rejected(client):
    """REQ13: String 'NaN' quantity rejected with 400 or 422."""
    response = client.post("/api/v1/cart/items", json={"item_id": "I001", "quantity": "NaN"})
    assert response.status_code in (400, 422)


# ---------------------------------------------------------------------------
# REQ14 — Cross-Restaurant Cart Guard
# ---------------------------------------------------------------------------

def test_tc06_cross_restaurant_conflict_returns_409(client):
    """REQ14: Adding item from different restaurant → 409 CROSS_RESTAURANT_CONFLICT."""
    client.post("/api/v1/cart/items", json={"item_id": "I001", "quantity": 1})  # R001
    response = client.post("/api/v1/cart/items", json={"item_id": "I004", "quantity": 1})  # R002
    assert response.status_code == 409
    data = response.get_json()
    assert data["error"]["code"] == "CROSS_RESTAURANT_CONFLICT"


def test_tc07_same_restaurant_no_conflict(client):
    """REQ14: Adding items from same restaurant succeeds."""
    client.post("/api/v1/cart/items", json={"item_id": "I001", "quantity": 1})  # R001
    response = client.post("/api/v1/cart/items", json={"item_id": "I002", "quantity": 1})  # R001
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# REQ20 — Unavailable Item Notification
# ---------------------------------------------------------------------------

def test_tc08_unavailable_item_returns_422_item_unavailable(client):
    """REQ20: Unavailable item → 422 ITEM_UNAVAILABLE."""
    response = client.post("/api/v1/cart/items", json={"item_id": "I003", "quantity": 1})
    assert response.status_code == 422
    data = response.get_json()
    assert data["error"]["code"] == "ITEM_UNAVAILABLE"


# ---------------------------------------------------------------------------
# REQ21 — Empty Cart Checkout Guard
# ---------------------------------------------------------------------------

def test_tc09_checkout_empty_cart_returns_400(client):
    """REQ21: Checkout with empty cart → 400."""
    response = client.post("/api/v1/checkout")
    assert response.status_code == 400
    data = response.get_json()
    assert "empty" in data["error"]["message"].lower()


# ---------------------------------------------------------------------------
# REQ3 — Missing fields
# ---------------------------------------------------------------------------

def test_tc10_missing_item_id_returns_400(client):
    """REQ3: Missing item_id → 400."""
    response = client.post("/api/v1/cart/items", json={"quantity": 1})
    assert response.status_code == 400


def test_tc11_missing_quantity_returns_400(client):
    """REQ3: Missing quantity → 400."""
    response = client.post("/api/v1/cart/items", json={"item_id": "I001"})
    assert response.status_code == 400
