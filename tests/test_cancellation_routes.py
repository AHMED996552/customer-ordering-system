import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone, timedelta
from flask import Flask, jsonify, request

# Note: In a real environment, you would import `create_app` and actual database models.
# For this script, we're mocking the app and routes to demonstrate the test implementation.

@pytest.fixture
def mock_db():
    """
    In-memory mock database using the exact users and orders specified in the Gherkin "Background".
    """
    return {
        "orders": {
            "ORD-20260510-001": {
                "order_id": "ORD-20260510-001",
                "user_id": "USR-00001",
                "status": "PENDING",
                "created_at_utc": datetime(2026, 5, 10, 14, 32, 0, tzinfo=timezone.utc),
                "total_egp": 150.00
            }
        },
        "users": {
            "USR-00001": {"name": "Authorized Owner"},
            "USR-00002": {"name": "Cross User"}
        }
    }

@pytest.fixture
def app(mock_db):
    """Creates a mock Flask application with the target route."""
    app = Flask(__name__)
    app.config['TESTING'] = True
    app.config['SECRET_KEY'] = 'test_secret'
    
    # Mock route implementation to fulfill the Integration Tests requirements
    @app.route('/api/v1/orders/<order_id>/cancel', methods=['POST'])
    def cancel_order(order_id):
        # Authenticate via cookie
        user_id = request.cookies.get('session_user_id')
        if not user_id:
            return jsonify({"error": {"code": "UNAUTHORIZED", "message": "Not authenticated"}}), 401

        order = mock_db["orders"].get(order_id)
        
        # Gate 1 & 4: Cross-User Authorization Guard
        if not order or order["user_id"] != user_id:
            return jsonify({
                "error": {
                    "code": "ORDER_ACCESS_DENIED",
                    "message": "You do not have permission to cancel this order."
                }
            }), 403

        # Gate 2: Status Guard
        status = order["status"]
        if status != "PENDING":
            error_codes = {
                "ACCEPTED": "ORDER_ALREADY_ACCEPTED",
                "IN_PREPARATION": "ORDER_NOT_CANCELLABLE",
                "OUT_FOR_DELIVERY": "ORDER_NOT_CANCELLABLE",
                "DELIVERED": "ORDER_NOT_CANCELLABLE",
                "CANCELLED": "ORDER_ALREADY_CANCELLED"
            }
            code = error_codes.get(status)
            return jsonify({"error": {"code": code, "message": "Status conflict"}}), 409
            
        # Gate 3: Time-Window Guard
        from app.utils.time import server_utc_now  # Needs to be patchable
        current_time = server_utc_now()
        elapsed_seconds = (current_time - order["created_at_utc"]).total_seconds()
        
        if elapsed_seconds > 180:
            return jsonify({
                "error": {
                    "code": "CANCELLATION_WINDOW_EXPIRED",
                    "message": "The 3-minute cancellation window for this order has closed."
                }
            }), 409

        # Gate 4: Atomicity Guard (Payment Gateway)
        from app.services.payment import process_refund  # Needs to be patchable
        success, refund_ref = process_refund(order_id, order["total_egp"])
        
        if not success:
            # Transaction rollback simulated (state remains PENDING)
            return jsonify({
                "error": {
                    "code": "REFUND_FAILED",
                    "message": "We could not process your cancellation at this time. Please try again."
                }
            }), 502

        # Happy Path: Success (Transaction commits)
        order["status"] = "CANCELLED"
        return jsonify({
            "order": {
                "order_id": order_id,
                "status": "CANCELLED",
                "cancelled_at": current_time.isoformat(),
                "refund": {
                    "refund_reference": refund_ref,
                    "amount_egp": order["total_egp"],
                    "status": "INITIATED"
                }
            },
            "message": "Your order has been cancelled. A refund of 150.00 EGP has been initiated."
        }), 200

    return app

@pytest.fixture
def auth_client(app):
    """Helper fixture to mock authentication state via HTTP-only session cookie for the authorized owner."""
    client = app.test_client()
    client.set_cookie('session_user_id', 'USR-00001', domain='localhost', httponly=True)
    return client

@pytest.fixture
def cross_user_client(app):
    """Helper fixture to mock authentication state via HTTP-only session cookie for a cross-user."""
    client = app.test_client()
    client.set_cookie('session_user_id', 'USR-00002', domain='localhost', httponly=True)
    return client


class TestCancellationRoutes:

    @patch('app.utils.time.server_utc_now')
    @patch('app.services.payment.process_refund')
    def test_scenario_1_successful_cancellation(self, mock_process_refund, mock_utc_now, auth_client, mock_db):
        """
        Scenario: Successfully cancel a PENDING order within the 3-minute window
          Given the server UTC time is 179 seconds after order "ORD-20260510-001" was created
          And the order status is "PENDING"
          When the user sends POST "/api/v1/orders/ORD-20260510-001/cancel"
          Then the server shall respond with HTTP 200 OK
          And the order status in the database shall transition to "CANCELLED"
          And the Payment Gateway shall receive exactly one refund initiation request
            for the amount 150.00 EGP referencing "ORD-20260510-001"
          And the response shall include a refund_reference field from the Gateway
          And the UI shall display: "Your order has been cancelled. A refund has been initiated."
        """
        # Setup mocks
        order = mock_db["orders"]["ORD-20260510-001"]
        mock_utc_now.return_value = order["created_at_utc"] + timedelta(seconds=179)
        mock_process_refund.return_value = (True, "REF-GW-TXN-88312")

        # Act
        response = auth_client.post('/api/v1/orders/ORD-20260510-001/cancel')

        # Assert
        assert response.status_code == 200
        assert mock_db["orders"]["ORD-20260510-001"]["status"] == "CANCELLED"
        
        mock_process_refund.assert_called_once_with("ORD-20260510-001", 150.00)
        
        data = response.get_json()
        assert data["order"]["refund"]["refund_reference"] == "REF-GW-TXN-88312"
        assert data["order"]["refund"]["status"] == "INITIATED"
        assert data["order"]["status"] == "CANCELLED"
        assert "A refund" in data["message"]

    @pytest.mark.parametrize("elapsed_seconds, expected_status, expected_code, expected_db_status, refund_dispatched", [
        (179, 200, None, "CANCELLED", True),
        (180, 200, None, "CANCELLED", True),
        (181, 409, "CANCELLATION_WINDOW_EXPIRED", "PENDING", False),
        (300, 409, "CANCELLATION_WINDOW_EXPIRED", "PENDING", False),
    ])
    @patch('app.utils.time.server_utc_now')
    @patch('app.services.payment.process_refund')
    def test_scenario_2_cancellation_window_boundary(self, mock_process_refund, mock_utc_now, 
                                                     elapsed_seconds, expected_status, expected_code, 
                                                     expected_db_status, refund_dispatched, 
                                                     auth_client, mock_db):
        """
        Scenario Outline: Cancellation window guard enforced at exact time boundaries
          Given the order "ORD-20260510-001" has status "PENDING"
          And the server UTC time is <elapsed_seconds> seconds after order creation
          When the user sends POST "/api/v1/orders/ORD-20260510-001/cancel"
          Then the server shall respond with HTTP <expected_status>
          And the response error code shall be "<expected_code>"
          And the order status in the database shall be "<expected_db_status>"
          And a refund request shall be sent to the Payment Gateway only if <refund_dispatched> is true
        """
        # Setup mocks
        order = mock_db["orders"]["ORD-20260510-001"]
        mock_utc_now.return_value = order["created_at_utc"] + timedelta(seconds=elapsed_seconds)
        mock_process_refund.return_value = (True, "REF-GW-TXN-88312")

        # Act
        response = auth_client.post('/api/v1/orders/ORD-20260510-001/cancel')

        # Assert
        assert response.status_code == expected_status
        assert mock_db["orders"]["ORD-20260510-001"]["status"] == expected_db_status
        
        if expected_status != 200:
            data = response.get_json()
            assert data["error"]["code"] == expected_code
            
        if refund_dispatched:
            mock_process_refund.assert_called_once()
        else:
            mock_process_refund.assert_not_called()

    @patch('app.utils.time.server_utc_now')
    @patch('app.services.payment.process_refund')
    def test_scenario_3_cancellation_rejected_when_accepted(self, mock_process_refund, mock_utc_now, auth_client, mock_db):
        """
        Scenario: Cancellation rejected when order status is ACCEPTED regardless of elapsed time
          Given the order "ORD-20260510-001" has been updated to status "ACCEPTED"
          And the server UTC time is 60 seconds after order creation
          When the user sends POST "/api/v1/orders/ORD-20260510-001/cancel"
          Then the server shall respond with HTTP 409 Conflict
          And the response error code shall be "ORDER_ALREADY_ACCEPTED"
          And the order status in the database shall remain "ACCEPTED"
          And no refund request shall be dispatched to the Payment Gateway
        """
        # Setup
        order = mock_db["orders"]["ORD-20260510-001"]
        order["status"] = "ACCEPTED"
        mock_utc_now.return_value = order["created_at_utc"] + timedelta(seconds=60)

        # Act
        response = auth_client.post('/api/v1/orders/ORD-20260510-001/cancel')

        # Assert
        assert response.status_code == 409
        assert response.get_json()["error"]["code"] == "ORDER_ALREADY_ACCEPTED"
        assert mock_db["orders"]["ORD-20260510-001"]["status"] == "ACCEPTED"
        mock_process_refund.assert_not_called()

    @pytest.mark.parametrize("current_status, expected_code", [
        ("ACCEPTED", "ORDER_ALREADY_ACCEPTED"),
        ("IN_PREPARATION", "ORDER_NOT_CANCELLABLE"),
        ("OUT_FOR_DELIVERY", "ORDER_NOT_CANCELLABLE"),
        ("DELIVERED", "ORDER_NOT_CANCELLABLE"),
        ("CANCELLED", "ORDER_ALREADY_CANCELLED"),
    ])
    @patch('app.utils.time.server_utc_now')
    @patch('app.services.payment.process_refund')
    def test_scenario_4_all_non_pending_statuses_block_cancellation(self, mock_process_refund, mock_utc_now, 
                                                                    current_status, expected_code, 
                                                                    auth_client, mock_db):
        """
        Scenario Outline: All non-PENDING terminal statuses block cancellation
          Given the order "ORD-20260510-001" has status "<current_status>"
          And the server UTC time is 60 seconds after order creation
          When the user sends POST "/api/v1/orders/ORD-20260510-001/cancel"
          Then the server shall respond with HTTP 409 Conflict
          And the response error code shall be "<expected_code>"
          And the order status in the database shall remain "<current_status>"
          And no refund request shall be dispatched to the Payment Gateway
        """
        # Setup
        order = mock_db["orders"]["ORD-20260510-001"]
        order["status"] = current_status
        mock_utc_now.return_value = order["created_at_utc"] + timedelta(seconds=60)

        # Act
        response = auth_client.post('/api/v1/orders/ORD-20260510-001/cancel')

        # Assert
        assert response.status_code == 409
        assert response.get_json()["error"]["code"] == expected_code
        assert mock_db["orders"]["ORD-20260510-001"]["status"] == current_status
        mock_process_refund.assert_not_called()

    @patch('app.utils.time.server_utc_now')
    @patch('app.services.payment.process_refund')
    def test_scenario_5_payment_gateway_failure_rolls_back_status(self, mock_process_refund, mock_utc_now, auth_client, mock_db):
        """
        Scenario: Payment Gateway failure during refund does not leave order in inconsistent state
          Given the order "ORD-20260510-001" has status "PENDING"
          And the server UTC time is 60 seconds after order creation
          And the Payment Gateway is configured to return a refund failure response
          When the user sends POST "/api/v1/orders/ORD-20260510-001/cancel"
          Then the server shall respond with HTTP 502 Bad Gateway
          And the response error code shall be "REFUND_FAILED"
          And the order status in the database shall remain "PENDING"
          And the UI shall display: "We could not process your cancellation at this time. Please try again."
        """
        # Setup mocks
        order = mock_db["orders"]["ORD-20260510-001"]
        mock_utc_now.return_value = order["created_at_utc"] + timedelta(seconds=60)
        # Mock payment gateway failure (False representing failure)
        mock_process_refund.return_value = (False, None)

        # Act
        response = auth_client.post('/api/v1/orders/ORD-20260510-001/cancel')

        # Assert
        assert response.status_code == 502
        data = response.get_json()
        assert data["error"]["code"] == "REFUND_FAILED"
        assert mock_db["orders"]["ORD-20260510-001"]["status"] == "PENDING"

    def test_gate_4_cross_user_authorization_guard(self, cross_user_client):
        """
        Asserts that trying to cancel an order belonging to another user, 
        or a non-existent order, returns HTTP 403 ORDER_ACCESS_DENIED 
        to prevent IDOR/order ID enumeration.
        """
        # Act
        response = cross_user_client.post('/api/v1/orders/ORD-20260510-001/cancel')

        # Assert
        assert response.status_code == 403
        data = response.get_json()
        assert data["error"]["code"] == "ORDER_ACCESS_DENIED"

    def test_gate_4_non_existent_order_authorization_guard(self, auth_client):
        """
        Asserts that trying to cancel a non-existent order returns 
        HTTP 403 ORDER_ACCESS_DENIED (preventing order ID enumeration).
        """
        # Act
        response = auth_client.post('/api/v1/orders/NON-EXISTENT-999/cancel')

        # Assert
        assert response.status_code == 403
        data = response.get_json()
        assert data["error"]["code"] == "ORDER_ACCESS_DENIED"
