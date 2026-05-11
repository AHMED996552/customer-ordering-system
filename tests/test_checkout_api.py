import pytest
import uuid
import json
import copy
from unittest.mock import patch, MagicMock

# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def app():
    from backend import create_app
    app = create_app('testing')
    app.config['TESTING'] = True
    return app

@pytest.fixture
def client(app):
    with app.test_client() as client:
        yield client

@pytest.fixture
def active_cart_session(client):
    """Sets up a valid session with items in the cart (REQ21 Happy Path)."""
    with client.session_transaction() as sess:
        sess['cart'] = [{'item_id': 1, 'quantity': 1, 'price': 150.00}]
    return client

@pytest.fixture
def valid_payload():
    return {
        "idempotency_key": str(uuid.uuid4()),
        "client_total_egp": 150.00,
        "payment_method": {"gateway_token": "valid_token"},
        "notes": "No onions",
        "special_instructions": "Extra spicy"
    }

@pytest.fixture
def mock_payment_gateway():
    """Mock external payment gateway charge function."""
    with patch('backend.services.payment_service.PaymentGatewayService.charge') as mock_charge:
        mock_charge.return_value = {"status": "SUCCESS", "txn_id": "txn_123"}
        yield mock_charge

@pytest.fixture
def mock_db_session():
    """Mock SQLAlchemy DB session to track commits/rollbacks."""
    from backend.repositories.mock_db import db
    with patch.object(db, 'rollback') as mock_rollback:
        yield mock_rollback

# =============================================================================
# REQ16 — Idempotency Tests
# =============================================================================
class TestIdempotency:
    @patch('backend.services.checkout_service.datetime')
    def test_tc_16_01_baseline_success(self, mock_dt, active_cart_session, valid_payload, mock_payment_gateway):
        import datetime
        mock_dt.datetime.now.return_value = datetime.datetime(2026, 5, 11, 12, 0, 0, tzinfo=datetime.timezone.utc)
        
        res = active_cart_session.post('/api/v1/orders/checkout', json=valid_payload)
        assert res.status_code == 201
        assert res.json['order_id'] is not None

    @patch('backend.services.checkout_service.datetime')
    def test_tc_16_02_rapid_duplicate_submission(self, mock_dt, active_cart_session, valid_payload):
        import datetime
        mock_dt.datetime.now.return_value = datetime.datetime(2026, 5, 11, 12, 0, 0, tzinfo=datetime.timezone.utc)
        
        with patch('backend.repositories.mock_db.MockDB.check_idempotency_lock') as mock_lock:
            mock_lock.side_effect = [False, True]
            
            res1 = active_cart_session.post('/api/v1/orders/checkout', json=valid_payload)
            res2 = active_cart_session.post('/api/v1/orders/checkout', json=valid_payload)
            
            assert res1.status_code == 201
            assert res2.status_code == 409

    def test_tc_16_05_missing_key(self, active_cart_session, valid_payload):
        del valid_payload["idempotency_key"]
        res = active_cart_session.post('/api/v1/orders/checkout', json=valid_payload)
        assert res.status_code == 422
        assert "idempotency_key" in res.json['error']['message']

    def test_tc_16_06_tampered_key_format(self, active_cart_session, valid_payload):
        valid_payload["idempotency_key"] = "' OR 1=1 --"
        res = active_cart_session.post('/api/v1/orders/checkout', json=valid_payload)
        assert res.status_code == 422

# =============================================================================
# REQ17 — Price Recalculation Tests
# =============================================================================
class TestPriceRecalculation:
    @patch('backend.services.checkout_service.datetime')
    @pytest.mark.parametrize("malicious_total", [
        0.01,           # TC-17-01: Underpay attack
        999999.00,      # TC-17-02: Overpay attack
        -150.00,        # TC-17-03: Negative payload
        150.00000001,   # TC-17-04: Float precision mismatch
    ])
    def test_tc_17_price_manipulation_ignored(self, mock_dt, active_cart_session, valid_payload, malicious_total, mock_payment_gateway):
        import datetime
        mock_dt.datetime.now.return_value = datetime.datetime(2026, 5, 11, 12, 0, 0, tzinfo=datetime.timezone.utc)
        
        valid_payload["client_total_egp"] = malicious_total
        res = active_cart_session.post('/api/v1/orders/checkout', json=valid_payload)
        
        assert res.status_code == 201
        # Expect server total (item price is 150)
        mock_payment_gateway.assert_called_once_with("valid_token", 150.0)

    def test_tc_17_05_string_type_for_total(self, active_cart_session, valid_payload):
        valid_payload["client_total_egp"] = "150.00"
        res = active_cart_session.post('/api/v1/orders/checkout', json=valid_payload)
        assert res.status_code == 422

# =============================================================================
# REQ18 — Character Limit (500 Chars)
# =============================================================================
class TestCharacterLimit:
    @patch('backend.services.checkout_service.datetime')
    def test_tc_18_01_exact_boundary(self, mock_dt, active_cart_session, valid_payload):
        import datetime
        mock_dt.datetime.now.return_value = datetime.datetime(2026, 5, 11, 12, 0, 0, tzinfo=datetime.timezone.utc)
        
        payload_str = json.dumps(valid_payload)
        padding_needed = 500 - len(payload_str)
        valid_payload["notes"] += "A" * (padding_needed - 10)
        res = active_cart_session.post('/api/v1/orders/checkout', json=valid_payload)
        assert res.status_code == 201

    def test_tc_18_02_exceeds_boundary(self, active_cart_session, valid_payload):
        valid_payload["notes"] = "A" * 600
        res = active_cart_session.post('/api/v1/orders/checkout', json=valid_payload)
        assert res.status_code == 413

    def test_tc_18_04_nested_json_dos(self, active_cart_session, valid_payload):
        valid_payload["notes"] = {"level1": {"level2": {"level3": "A"*400}}}
        res = active_cart_session.post('/api/v1/orders/checkout', json=valid_payload)
        assert res.status_code in [413, 400, 422]

# =============================================================================
# REQ19 — Operating Hours Validation
# =============================================================================
class TestOperatingHours:
    @patch('backend.services.checkout_service.datetime')
    def test_tc_19_01_before_opening(self, mock_dt, active_cart_session, valid_payload):
        import datetime
        # Closed before 10:00 UTC
        mock_dt.datetime.now.return_value = datetime.datetime(2026, 5, 11, 9, 59, 0, tzinfo=datetime.timezone.utc)
        mock_dt.timezone = datetime.timezone
        res = active_cart_session.post('/api/v1/orders/checkout', json=valid_payload)
        assert res.status_code == 403

    @patch('backend.services.checkout_service.datetime')
    def test_tc_19_03_after_closing(self, mock_dt, active_cart_session, valid_payload):
        import datetime
        # Closed at 22:00 UTC
        mock_dt.datetime.now.return_value = datetime.datetime(2026, 5, 11, 22, 1, 0, tzinfo=datetime.timezone.utc)
        mock_dt.timezone = datetime.timezone
        res = active_cart_session.post('/api/v1/orders/checkout', json=valid_payload)
        assert res.status_code == 403

# =============================================================================
# REQ20 — Unavailable Items
# =============================================================================
class TestUnavailableItems:
    @patch('backend.services.checkout_service.datetime')
    def test_tc_20_01_out_of_stock_at_checkout(self, mock_dt, client, valid_payload):
        import datetime
        mock_dt.datetime.now.return_value = datetime.datetime(2026, 5, 11, 12, 0, 0, tzinfo=datetime.timezone.utc)
        
        # Item ID 3 is set as unavailable in MockDB
        with client.session_transaction() as sess:
            sess['cart'] = [{'item_id': 3, 'quantity': 1, 'price': 50.00}]
            
        res = client.post('/api/v1/orders/checkout', json=valid_payload)
        assert res.status_code == 422
        assert "ITEM_UNAVAILABLE" in res.json['error']['code']

# =============================================================================
# REQ21 — Empty Cart Guard
# =============================================================================
class TestEmptyCartGuard:
    def test_tc_21_01_empty_cart_session(self, client, valid_payload):
        with client.session_transaction() as sess:
            sess['cart'] = []
        res = client.post('/api/v1/orders/checkout', json=valid_payload)
        assert res.status_code == 400
        assert "CART_EMPTY" in res.json['error']['code']

    def test_tc_21_04_missing_session_cookie(self, client, valid_payload):
        res = client.post('/api/v1/orders/checkout', json=valid_payload)
        assert res.status_code == 400

    def test_tc_21_05_zero_quantity_item(self, client, valid_payload):
        with client.session_transaction() as sess:
            sess['cart'] = [{'item_id': 1, 'quantity': 0}]
        res = client.post('/api/v1/orders/checkout', json=valid_payload)
        assert res.status_code == 400

# =============================================================================
# Payment Failure Guard
# =============================================================================
class TestPaymentFailures:
    @patch('backend.services.checkout_service.datetime')
    def test_tc_pmt_01_gateway_decline(self, mock_dt, active_cart_session, valid_payload, mock_db_session):
        import datetime
        mock_dt.datetime.now.return_value = datetime.datetime(2026, 5, 11, 12, 0, 0, tzinfo=datetime.timezone.utc)
        
        from backend.services.payment_service import PaymentError
        with patch('backend.services.payment_service.PaymentGatewayService.charge') as mock_charge:
            mock_charge.side_effect = PaymentError("Insufficient funds")
            
            res = active_cart_session.post('/api/v1/orders/checkout', json=valid_payload)
            assert res.status_code == 402
            mock_db_session.assert_called_once()  # Asserts db.rollback() was called!
