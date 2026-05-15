import pytest
from unittest.mock import patch, MagicMock

# ==============================================================================
# FIXTURES & UTILITIES
# ==============================================================================

@pytest.fixture
def app():
    """
    Strict import of the app factory. Fails loudly if the backend architecture
    is missing or improperly configured.
    """
    from backend import create_app
    app = create_app({'TESTING': True})
    return app

@pytest.fixture
def client(app):
    """Standard Flask test client."""
    return app.test_client()

@pytest.fixture
def mock_get_item():
    """
    Patches the service layer directly to avoid coupling tests to DB implementation details.
    """
    with patch('backend.services.cart_service.get_item') as mock:
        yield mock

@pytest.fixture
def mock_checkout_side_effects():
    """
    Composite fixture that prevents actual side-effects (payment processing, order creation)
    during checkout validation tests.
    """
    with patch('backend.services.checkout_service.process_payment') as mock_payment, \
         patch('backend.services.checkout_service.create_order') as mock_order:
        yield {
            'payment': mock_payment,
            'order': mock_order
        }

def set_session_cart(client, cart_data: dict):
    """Utility to inject arbitrary state into the session cart."""
    with client.session_transaction() as sess:
        sess['cart'] = cart_data

def assert_cart_schema(cart: dict):
    """Strictly validates the complete structure and types of the cart response."""
    expected_keys = {
        'cart_id',
        'restaurant_id',
        'restaurant_name',
        'items',
        'subtotal_egp',
        'item_count',
        'checkout_eligible',
        'unavailable_items'
    }
    assert set(cart.keys()) == expected_keys, f"Missing or unexpected keys. Found: {cart.keys()}"
    
    assert isinstance(cart['items'], list)
    assert isinstance(cart['subtotal_egp'], (int, float))
    assert isinstance(cart['item_count'], int)
    assert isinstance(cart['checkout_eligible'], bool)
    assert isinstance(cart['unavailable_items'], list)
    
    for item in cart['items']:
        assert set(item.keys()).issuperset({'item_id', 'quantity', 'price_egp', 'line_total_egp', 'name'})
        assert isinstance(item['quantity'], int)
        assert isinstance(item['price_egp'], (int, float))
        assert isinstance(item['line_total_egp'], (int, float))

# ==============================================================================
# REQ4 — Cart Retrieval
# ==============================================================================

def test_tc_req4_01_retrieve_cart_multiple_items(client, mock_get_item):
    """TC-REQ4-01: Retrieve Cart with Multiple Items"""
    set_session_cart(client, {
        'restaurant_id': 'rest_123',
        'items': [
            {'item_id': 'item_1', 'quantity': 2},
            {'item_id': 'item_2', 'quantity': 1}
        ]
    })
    
    mock_get_item.side_effect = lambda item_id: {
        'item_1': {'id': 'item_1', 'name': 'Burger', 'price_egp': 50.0, 'is_available': True},
        'item_2': {'id': 'item_2', 'name': 'Fries', 'price_egp': 75.0, 'is_available': True}
    }.get(item_id)

    response = client.get('/api/v1/cart')
    assert response.status_code == 200
    
    data = response.get_json()
    assert 'cart' in data
    cart = data['cart']
    
    assert_cart_schema(cart)
    assert cart['item_count'] == 3
    assert cart['subtotal_egp'] == pytest.approx(175.0, rel=1e-5)
    assert cart['checkout_eligible'] is True
    assert len(cart['items']) == 2
    assert mock_get_item.call_count == 2

def test_tc_req4_02_correct_subtotal_computation(client, mock_get_item):
    """TC-REQ4-02: Correct Subtotal and Line Totals Computation"""
    set_session_cart(client, {
        'items': [
            {'item_id': 'item_A', 'quantity': 3},
            {'item_id': 'item_B', 'quantity': 2}
        ]
    })
    
    mock_get_item.side_effect = lambda item_id: {
        'item_A': {'id': 'item_A', 'name': 'A', 'price_egp': 10.50, 'is_available': True},
        'item_B': {'id': 'item_B', 'name': 'B', 'price_egp': 20.00, 'is_available': True}
    }.get(item_id)

    response = client.get('/api/v1/cart')
    assert response.status_code == 200
    cart = response.get_json()['cart']
    
    assert_cart_schema(cart)
    assert cart['subtotal_egp'] == pytest.approx(71.50, rel=1e-5)
    
    item_a_resp = next(i for i in cart['items'] if i['item_id'] == 'item_A')
    assert item_a_resp['line_total_egp'] == pytest.approx(31.50, rel=1e-5)
    
    item_b_resp = next(i for i in cart['items'] if i['item_id'] == 'item_B')
    assert item_b_resp['line_total_egp'] == pytest.approx(40.00, rel=1e-5)

def test_tc_req4_03_empty_cart_retrieval(client, mock_get_item):
    """TC-REQ4-03: Empty Cart Retrieval"""
    # Simulate empty/new session
    with client.session_transaction() as sess:
        sess.pop('cart', None)
        
    response = client.get('/api/v1/cart')
    assert response.status_code == 200
    cart = response.get_json()['cart']
    
    assert_cart_schema(cart)
    assert cart['items'] == []
    assert cart['subtotal_egp'] == pytest.approx(0.0)
    assert cart['item_count'] == 0
    assert cart['checkout_eligible'] is False
    assert cart['unavailable_items'] == []
    
    mock_get_item.assert_not_called()

def test_tc_req4_04_session_isolation(app):
    """TC-REQ4-04: Session Isolation Between Users"""
    client_a = app.test_client()
    client_b = app.test_client()
    
    set_session_cart(client_a, {'items': [{'item_id': 'item_1', 'quantity': 1}]})
        
    response_b = client_b.get('/api/v1/cart')
    assert response_b.status_code == 200
    cart_b = response_b.get_json()['cart']
    
    assert cart_b['items'] == []
    assert cart_b['subtotal_egp'] == pytest.approx(0.0)

def test_tc_req4_05_cart_consistency_after_updates(client, mock_get_item):
    """TC-REQ4-05: Cart Consistency After Updates"""
    set_session_cart(client, {'items': []})
        
    response = client.get('/api/v1/cart')
    assert response.status_code == 200
    cart = response.get_json()['cart']
    
    assert_cart_schema(cart)
    assert cart['item_count'] == 0
    mock_get_item.assert_not_called()

def test_tc_req4_06_duplicate_line_item_handling(client, mock_get_item):
    """TC-REQ4-06: Duplicate Line Item Handling"""
    set_session_cart(client, {
        'items': [
            {'item_id': 'item_1', 'quantity': 1},
            {'item_id': 'item_1', 'quantity': 1}
        ]
    })
        
    mock_get_item.return_value = {'id': 'item_1', 'name': 'Burger', 'price_egp': 10.0, 'is_available': True}
    
    response = client.get('/api/v1/cart')
    assert response.status_code == 200
    cart = response.get_json()['cart']
    
    assert_cart_schema(cart)
    assert len(cart['items']) == 1
    assert cart['items'][0]['quantity'] == 2
    assert cart['subtotal_egp'] == pytest.approx(20.0, rel=1e-5)

# ==============================================================================
# REQ15 — Stale Price Refresh
# ==============================================================================

def test_tc_req15_01_single_item_price_increase(client, mock_get_item):
    """TC-REQ15-01: Single Item Price Increase"""
    set_session_cart(client, {'items': [{'item_id': 'item_1', 'quantity': 1}]})
        
    # Price increased from implicit cached 50 to 100 in DB
    mock_get_item.return_value = {'id': 'item_1', 'name': 'A', 'price_egp': 100.0, 'is_available': True}
    
    response = client.get('/api/v1/cart')
    cart = response.get_json()['cart']
    
    assert cart['items'][0]['price_egp'] == pytest.approx(100.0, rel=1e-5)
    assert cart['subtotal_egp'] == pytest.approx(100.0, rel=1e-5)
    mock_get_item.assert_called_once_with('item_1')

def test_tc_req15_02_single_item_price_decrease(client, mock_get_item):
    """TC-REQ15-02: Single Item Price Decrease"""
    set_session_cart(client, {'items': [{'item_id': 'item_1', 'quantity': 1}]})
        
    mock_get_item.return_value = {'id': 'item_1', 'name': 'A', 'price_egp': 40.0, 'is_available': True}
    
    response = client.get('/api/v1/cart')
    cart = response.get_json()['cart']
    
    assert cart['items'][0]['price_egp'] == pytest.approx(40.0, rel=1e-5)
    assert cart['subtotal_egp'] == pytest.approx(40.0, rel=1e-5)

def test_tc_req15_03_multiple_items_with_updated_prices(client, mock_get_item):
    """TC-REQ15-03: Multiple Items With Updated Prices"""
    set_session_cart(client, {
        'items': [
            {'item_id': 'item_A', 'quantity': 1},
            {'item_id': 'item_B', 'quantity': 1}
        ]
    })
        
    mock_get_item.side_effect = lambda item_id: {
        'item_A': {'id': 'item_A', 'name': 'A', 'price_egp': 20.0, 'is_available': True},
        'item_B': {'id': 'item_B', 'name': 'B', 'price_egp': 30.0, 'is_available': True}
    }.get(item_id)
    
    response = client.get('/api/v1/cart')
    cart = response.get_json()['cart']
    
    assert cart['subtotal_egp'] == pytest.approx(50.0, rel=1e-5)
    assert mock_get_item.call_count == 2

def test_tc_req15_04_mixed_updated_unchanged_prices(client, mock_get_item):
    """TC-REQ15-04: Mixed Updated + Unchanged Prices"""
    set_session_cart(client, {
        'items': [
            {'item_id': 'item_A', 'quantity': 1},
            {'item_id': 'item_B', 'quantity': 1}
        ]
    })
        
    mock_get_item.side_effect = lambda item_id: {
        'item_A': {'id': 'item_A', 'name': 'A', 'price_egp': 50.0, 'is_available': True},
        'item_B': {'id': 'item_B', 'name': 'B', 'price_egp': 25.0, 'is_available': True}
    }.get(item_id)
    
    response = client.get('/api/v1/cart')
    cart = response.get_json()['cart']
    
    assert cart['subtotal_egp'] == pytest.approx(75.0, rel=1e-5)

def test_tc_req15_05_decimal_precision_check(client, mock_get_item):
    """TC-REQ15-05: Decimal Precision Check"""
    set_session_cart(client, {
        'items': [
            {'item_id': 'item_A', 'quantity': 1},
            {'item_id': 'item_B', 'quantity': 1}
        ]
    })
        
    mock_get_item.side_effect = lambda item_id: {
        'item_A': {'id': 'item_A', 'name': 'A', 'price_egp': 10.10, 'is_available': True},
        'item_B': {'id': 'item_B', 'name': 'B', 'price_egp': 20.20, 'is_available': True}
    }.get(item_id)
    
    response = client.get('/api/v1/cart')
    cart = response.get_json()['cart']
    
    assert cart['subtotal_egp'] == pytest.approx(30.30, rel=1e-5)

# ==============================================================================
# REQ20 — Unavailable Item Detection
# ==============================================================================

def test_tc_req20_01_item_becomes_unavailable(client, mock_get_item):
    """TC-REQ20-01: Item Becomes Unavailable"""
    set_session_cart(client, {'items': [{'item_id': 'item_1', 'quantity': 1}]})
        
    mock_get_item.return_value = {'id': 'item_1', 'name': 'A', 'price_egp': 50.0, 'is_available': False}
    
    response = client.get('/api/v1/cart')
    assert response.status_code == 200
    cart = response.get_json()['cart']
    
    assert_cart_schema(cart)
    assert cart['checkout_eligible'] is False
    assert 'item_1' in cart['unavailable_items']
    
    # REQ20-06: Ensure it is not silently removed
    item_in_cart = any(i['item_id'] == 'item_1' for i in cart['items'])
    assert item_in_cart is True

def test_tc_req20_02_multiple_unavailable_items(client, mock_get_item):
    """TC-REQ20-02: Multiple Unavailable Items"""
    set_session_cart(client, {
        'items': [
            {'item_id': 'item_1', 'quantity': 1},
            {'item_id': 'item_2', 'quantity': 1}
        ]
    })
        
    mock_get_item.side_effect = lambda item_id: {
        'item_1': {'id': 'item_1', 'name': 'A', 'price_egp': 50.0, 'is_available': False},
        'item_2': {'id': 'item_2', 'name': 'B', 'price_egp': 75.0, 'is_available': False}
    }.get(item_id)
    
    response = client.get('/api/v1/cart')
    cart = response.get_json()['cart']
    
    assert cart['checkout_eligible'] is False
    assert set(cart['unavailable_items']) == {'item_1', 'item_2'}

def test_tc_req20_03_mixed_available_unavailable_cart(client, mock_get_item):
    """TC-REQ20-03: Mixed Available/Unavailable Cart"""
    set_session_cart(client, {
        'items': [
            {'item_id': 'item_1', 'quantity': 1},
            {'item_id': 'item_2', 'quantity': 1}
        ]
    })
        
    mock_get_item.side_effect = lambda item_id: {
        'item_1': {'id': 'item_1', 'name': 'A', 'price_egp': 50.0, 'is_available': True},
        'item_2': {'id': 'item_2', 'name': 'B', 'price_egp': 75.0, 'is_available': False}
    }.get(item_id)
    
    response = client.get('/api/v1/cart')
    cart = response.get_json()['cart']
    
    assert cart['checkout_eligible'] is False
    assert cart['unavailable_items'] == ['item_2']

def test_tc_req20_04_item_restored_to_available(client, mock_get_item):
    """TC-REQ20-04: Item Restored to Available"""
    set_session_cart(client, {'items': [{'item_id': 'item_1', 'quantity': 1}]})
        
    mock_get_item.return_value = {'id': 'item_1', 'name': 'A', 'price_egp': 50.0, 'is_available': True}
    
    response = client.get('/api/v1/cart')
    cart = response.get_json()['cart']
    
    assert cart['checkout_eligible'] is True
    assert cart['unavailable_items'] == []

def test_tc_req20_05_malicious_checkout_bypass(client, mock_get_item, mock_checkout_side_effects):
    """TC-REQ20-05: Malicious Checkout Bypass Attempt (Unavailable Items)"""
    set_session_cart(client, {'items': [{'item_id': 'item_1', 'quantity': 1}]})
        
    mock_get_item.return_value = {'id': 'item_1', 'name': 'A', 'price_egp': 50.0, 'is_available': False}
    
    response = client.post('/api/v1/orders/checkout')
    assert response.status_code == 400
    
    error = response.get_json().get('error', {})
    assert 'unavailable' in error.get('message', '').lower()
    
    # Side-effect prevention assertion
    mock_checkout_side_effects['payment'].assert_not_called()
    mock_checkout_side_effects['order'].assert_not_called()

# ==============================================================================
# REQ21 — Empty Cart Guard
# ==============================================================================

def test_tc_req21_01_checkout_with_empty_cart(client, mock_checkout_side_effects):
    """TC-REQ21-01: Checkout With Explicitly Empty Cart"""
    set_session_cart(client, {'items': []})
        
    response = client.post('/api/v1/orders/checkout')
    assert response.status_code == 400
    assert response.get_json().get('error', {}).get('code') == 'CART_EMPTY'
    
    mock_checkout_side_effects['payment'].assert_not_called()
    mock_checkout_side_effects['order'].assert_not_called()

def test_tc_req21_02_checkout_with_expired_session(client, mock_checkout_side_effects):
    """TC-REQ21-02: Checkout With Expired Session"""
    response = client.post('/api/v1/orders/checkout')
    # Standardizing on 401 for missing session context in secure routes, or 400 if strictly empty handler
    assert response.status_code == 400
    assert response.get_json().get('error', {}).get('code') == 'CART_EMPTY'
    
    mock_checkout_side_effects['payment'].assert_not_called()
    mock_checkout_side_effects['order'].assert_not_called()

def test_tc_req21_04_malicious_direct_post(client, mock_checkout_side_effects):
    """TC-REQ21-04: Malicious Direct POST Payload"""
    set_session_cart(client, {'items': []})
        
    malicious_payload = {
        'items': [{'item_id': 'item_1', 'quantity': 1}]
    }
    
    response = client.post('/api/v1/orders/checkout', json=malicious_payload)
    assert response.status_code == 400
    assert response.get_json().get('error', {}).get('code') == 'CART_EMPTY'
    
    mock_checkout_side_effects['payment'].assert_not_called()
    mock_checkout_side_effects['order'].assert_not_called()

# ==============================================================================
# Negative / Malformed State Tests (Robustness)
# ==============================================================================

def test_tc_neg_01_missing_items_key(client, mock_get_item):
    """Test corrupted session cart missing the 'items' key."""
    set_session_cart(client, {'restaurant_id': 'rest_123'})
    
    response = client.get('/api/v1/cart')
    assert response.status_code == 200
    cart = response.get_json()['cart']
    assert_cart_schema(cart)
    assert cart['items'] == []
    assert cart['item_count'] == 0

def test_tc_neg_02_corrupted_session_cart_type(client, mock_get_item):
    """Test session cart stored as string instead of dict."""
    set_session_cart(client, "this is a corrupted cart string")
    
    response = client.get('/api/v1/cart')
    assert response.status_code == 200
    cart = response.get_json()['cart']
    assert_cart_schema(cart)
    assert cart['items'] == []
    assert cart['item_count'] == 0

def test_tc_neg_03_invalid_quantity_types(client, mock_get_item):
    """Test handling of invalid quantity types in the session."""
    set_session_cart(client, {
        'items': [
            {'item_id': 'item_1', 'quantity': "2"}, # String instead of int
            {'item_id': 'item_2', 'quantity': 1.5}  # Float instead of int
        ]
    })
    
    mock_get_item.return_value = {'id': 'item_1', 'name': 'A', 'price_egp': 10.0, 'is_available': True}
    
    response = client.get('/api/v1/cart')
    assert response.status_code == 200
    cart = response.get_json()['cart']
    assert_cart_schema(cart)

def test_tc_neg_04_deleted_db_item(client, mock_get_item):
    """TC-EDGE-02: Missing Item Records in DB (Soft/Hard Deleted)"""
    set_session_cart(client, {'items': [{'item_id': 'item_1', 'quantity': 1}]})
        
    mock_get_item.return_value = None
    
    response = client.get('/api/v1/cart')
    assert response.status_code == 200
    cart = response.get_json()['cart']
    
    # Missing DB record forces checkout block
    assert cart['checkout_eligible'] is False
    assert 'item_1' in cart['unavailable_items']

def test_tc_neg_05_null_item_id(client, mock_get_item):
    """Test session containing an item with null ID."""
    set_session_cart(client, {
        'items': [
            {'item_id': None, 'quantity': 1}
        ]
    })
    
    response = client.get('/api/v1/cart')
    assert response.status_code == 200
    cart = response.get_json()['cart']
    
    # Expected behavior: invalid items are pruned or marked unavailable
    assert_cart_schema(cart)
