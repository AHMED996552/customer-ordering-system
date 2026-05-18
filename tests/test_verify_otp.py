import pytest
import json
from datetime import datetime, timezone, timedelta
from myapp import create_app, db
from myapp.models.user import User

VERIFY_OTP_URL = "/api/v1/auth/verify-otp"

@pytest.fixture(scope="session")
def app():
    """Create a Flask application configured for testing."""
    flask_app = create_app()
    flask_app.config.update(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SQLALCHEMY_TRACK_MODIFICATIONS": False,
            "WTF_CSRF_ENABLED": False,
            "JWT_SECRET_KEY": "test-secret-key",
        }
    )
    with flask_app.app_context():
        db.create_all()
        yield flask_app
        db.drop_all()


@pytest.fixture()
def client(app):
    """Flask test client."""
    return app.test_client()


@pytest.fixture(autouse=True)
def clean_db(app):
    """Wipe tables before every test to guarantee isolation."""
    with app.app_context():
        for table in reversed(db.metadata.sorted_tables):
            db.session.execute(table.delete())
        db.session.commit()


class TestVerifyOTP:

    def test_verify_otp_success(self, app, client):
        # 1. Arrange: Seed a user with a valid, non-expired OTP
        future_expiry = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
        with app.app_context():
            user = User(
                email="verify.success@example.com",
                full_name="Success Verify",
                phone_number="01275644550",
                status="PENDING_VERIFICATION",
                otp_code="654321",
                otp_expires_at=future_expiry
            )
            user.set_password("SecurePass1!")
            db.session.add(user)
            db.session.commit()

        # 2. Act: Send correct OTP code
        response = client.post(
            VERIFY_OTP_URL,
            data=json.dumps({
                "email": "verify.success@example.com",
                "otp_code": "654321"
            }),
            content_type="application/json"
        )

        # 3. Assert: 200 OK & ACTIVE status
        assert response.status_code == 200
        data = response.get_json()
        assert data["message"] == "Account verified successfully"
        assert data["user"]["status"] == "ACTIVE"

        # Check DB updates
        with app.app_context():
            db_user = User.query.filter_by(email="verify.success@example.com").first()
            assert db_user.status == "ACTIVE"
            assert db_user.otp_code is None
            assert db_user.otp_expires_at is None

    def test_verify_otp_invalid_code(self, app, client):
        # 1. Arrange: Seed user
        future_expiry = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
        with app.app_context():
            user = User(
                email="verify.invalid@example.com",
                full_name="Invalid Verify",
                phone_number="01275644550",
                status="PENDING_VERIFICATION",
                otp_code="123456",
                otp_expires_at=future_expiry
            )
            user.set_password("SecurePass1!")
            db.session.add(user)
            db.session.commit()

        # 2. Act: Send wrong OTP
        response = client.post(
            VERIFY_OTP_URL,
            data=json.dumps({
                "email": "verify.invalid@example.com",
                "otp_code": "000000" # wrong
            }),
            content_type="application/json"
        )

        # 3. Assert: 400 Bad Request
        assert response.status_code == 400
        data = response.get_json()
        assert data["error"] == "Invalid OTP code"

        # Verify DB status remains pending
        with app.app_context():
            db_user = User.query.filter_by(email="verify.invalid@example.com").first()
            assert db_user.status == "PENDING_VERIFICATION"
            assert db_user.otp_code == "123456"

    def test_verify_otp_expired_code(self, app, client):
        # 1. Arrange: Seed user with an already expired OTP
        past_expiry = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        with app.app_context():
            user = User(
                email="verify.expired@example.com",
                full_name="Expired Verify",
                phone_number="01275644550",
                status="PENDING_VERIFICATION",
                otp_code="777777",
                otp_expires_at=past_expiry
            )
            user.set_password("SecurePass1!")
            db.session.add(user)
            db.session.commit()

        # 2. Act: Send the expired OTP code
        response = client.post(
            VERIFY_OTP_URL,
            data=json.dumps({
                "email": "verify.expired@example.com",
                "otp_code": "777777"
            }),
            content_type="application/json"
        )

        # 3. Assert: 400 Bad Request
        assert response.status_code == 400
        data = response.get_json()
        assert data["error"] == "OTP has expired"

        # Verify user remains pending
        with app.app_context():
            db_user = User.query.filter_by(email="verify.expired@example.com").first()
            assert db_user.status == "PENDING_VERIFICATION"

    def test_verify_otp_missing_fields(self, client):
        # Act & Assert: missing email
        response = client.post(
            VERIFY_OTP_URL,
            data=json.dumps({"otp_code": "123456"}),
            content_type="application/json"
        )
        assert response.status_code == 422
        assert response.get_json()["error"] == "Email and OTP code are required"

        # Act & Assert: missing otp_code
        response = client.post(
            VERIFY_OTP_URL,
            data=json.dumps({"email": "test@example.com"}),
            content_type="application/json"
        )
        assert response.status_code == 422
        assert response.get_json()["error"] == "Email and OTP code are required"

    def test_verify_otp_user_not_found(self, client):
        # Act: Request for non-existent user
        response = client.post(
            VERIFY_OTP_URL,
            data=json.dumps({
                "email": "nonexistent@example.com",
                "otp_code": "123456"
            }),
            content_type="application/json"
        )
        # Assert: 404 Not Found
        assert response.status_code == 404
        assert response.get_json()["error"] == "User not found"

    def test_verify_otp_already_verified(self, app, client):
        # 1. Arrange: Seed an already active user
        with app.app_context():
            user = User(
                email="already.active@example.com",
                full_name="Active User",
                phone_number="01275644550",
                status="ACTIVE",
                otp_code=None,
                otp_expires_at=None
            )
            user.set_password("SecurePass1!")
            db.session.add(user)
            db.session.commit()

        # 2. Act: Try to verify again
        response = client.post(
            VERIFY_OTP_URL,
            data=json.dumps({
                "email": "already.active@example.com",
                "otp_code": "123456"
            }),
            content_type="application/json"
        )

        # 3. Assert: 200 OK with "already verified" message
        assert response.status_code == 200
        assert response.get_json()["message"] == "User is already verified"
