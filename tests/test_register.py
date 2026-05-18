import pytest
import json
from unittest.mock import patch, MagicMock
from flask import Flask
from flask_sqlalchemy import SQLAlchemy

# ---------------------------------------------------------------------------
# App / DB / Model imports — adjust to your actual project layout
# ---------------------------------------------------------------------------
from myapp import create_app, db
from myapp.models.user import User
from myapp.services.email import send_verification_email

# ---------------------------------------------------------------------------
# Helpers / constants
# ---------------------------------------------------------------------------

REGISTER_URL = "/api/v1/auth/register"

VALID_PAYLOAD = {
    "full_name": "Ahmed Mohamed Rashed",
    "email": "new.user@example.com",
    "password": "SecurePass1!",
    "phone_number": "01275644550",
}

EXISTING_EMAIL = "existing.user@example.com"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


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
        db.session.remove()
        db.drop_all()
        db.create_all()
        yield
        db.session.remove()


@pytest.fixture()
def existing_user(app):
    """Pre-seed a user with the duplicate e-mail address."""
    with app.app_context():
        user = User(
            email=EXISTING_EMAIL,
            full_name="Existing User",
            phone_number="+201000000000",
            status="PENDING_VERIFICATION",
        )
        user.set_password("ExistingPass9")
        db.session.add(user)
        db.session.commit()
        yield user


@pytest.fixture()
def mock_email(monkeypatch):
    """Patch send_verification_email so no real e-mail is sent."""
    mock = MagicMock(return_value=None)
    monkeypatch.setattr(
        "myapp.services.email.send_verification_email", mock
    )
    return mock


# ---------------------------------------------------------------------------
# Helper assertions
# ---------------------------------------------------------------------------


def assert_json_content_type(response):
    """Response must declare JSON content type."""
    assert "application/json" in response.content_type, (
        f"Expected application/json, got {response.content_type}"
    )


def assert_no_plaintext_password(response_data: dict, plain_password: str):
    """The raw password string must never appear anywhere in the response."""
    serialized = json.dumps(response_data)
    assert plain_password not in serialized, (
        "Plain-text password found in API response."
    )


def assert_password_not_in_response(response_data: dict):
    """The key 'password' must be absent from the response body."""
    user_block = response_data.get("user", {})
    assert "password" not in user_block, (
        "'password' field must not be present in response user object."
    )


def assert_user_count(app, expected: int):
    """Assert the number of User rows in the database."""
    with app.app_context():
        count = User.query.count()
        assert count == expected, f"Expected {expected} user(s) in DB, found {count}."


def assert_user_password_hashed(app, email: str, plain_password: str):
    """Verify the stored password is hashed, not plaintext."""
    with app.app_context():
        user = User.query.filter_by(email=email).first()
        assert user is not None, f"User with email {email} not found in DB."
        assert user.password_hash != plain_password, (
            "Password is stored as plain text — this is a security violation."
        )
        assert user.check_password(plain_password), (
            "Stored hash does not match the original password."
        )


# ---------------------------------------------------------------------------
# UI-level validation helpers (pure logic, no HTTP)
# ---------------------------------------------------------------------------


class TestPasswordValidationRules:
    """
    Simulate front-end validation rules so we confirm the rules
    themselves are correctly specified, independently of the server.
    """

    @staticmethod
    def _validate_password(password: str) -> list[str]:
        errors = []
        if len(password) < 8:
            errors.append("Password must be at least 8 characters")
        if not any(ch.isdigit() for ch in password):
            errors.append("Password must contain at least one number")
        if not any(ch.isupper() for ch in password):
            errors.append("Password must contain at least one uppercase letter")
        if not any(not ch.isalnum() for ch in password):
            errors.append("Password must contain at least one special character")
        return errors

    def test_short_password_with_digit_triggers_length_error(self):
        # Arrange
        password = "Short1"
        # Act
        errors = self._validate_password(password)
        # Assert
        assert "Password must be at least 8 characters" in errors

    def test_long_password_without_digit_triggers_digit_error(self):
        # Arrange
        password = "NoNumbersHere"
        # Act
        errors = self._validate_password(password)
        # Assert
        assert "Password must contain at least one number" in errors

    def test_valid_password_produces_no_errors(self):
        # Arrange
        password = "SecurePass1!"
        # Act
        errors = self._validate_password(password)
        # Assert
        assert errors == []

    def test_invalid_password_would_disable_submit(self):
        """Simulate: submit button is disabled when errors exist."""
        password = "bad"
        errors = self._validate_password(password)
        submit_disabled = len(errors) > 0
        assert submit_disabled is True

    def test_valid_password_enables_submit(self):
        password = "GoodPass7!"
        errors = self._validate_password(password)
        submit_disabled = len(errors) > 0
        assert submit_disabled is False

    def test_no_request_sent_when_invalid(self):
        """
        No HTTP request should fire if client-side validation fails.
        Represented as: invalid inputs produce errors, blocking dispatch.
        """
        invalid_passwords = ["Short1", "NoNumbersHere", "short1", "1234567"]
        for pw in invalid_passwords:
            errors = self._validate_password(pw)
            assert len(errors) > 0, (
                f"Password '{pw}' should fail validation and block request."
            )


# ---------------------------------------------------------------------------
# Success scenario
# ---------------------------------------------------------------------------


class TestRegisterSuccess:

    def test_register_returns_201(self, client, mock_email):
        # Arrange
        payload = VALID_PAYLOAD.copy()
        # Act
        response = client.post(
            REGISTER_URL,
            data=json.dumps(payload),
            content_type="application/json",
        )
        # Assert
        assert response.status_code == 201

    def test_register_returns_json_content_type(self, client, mock_email):
        response = client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        assert_json_content_type(response)

    def test_register_creates_user_in_db(self, app, client, mock_email):
        # Arrange / Act
        client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        # Assert
        assert_user_count(app, 1)

    def test_register_response_message(self, client, mock_email):
        response = client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        data = response.get_json()
        assert data["message"] == "Please check your email to verify your account."

    def test_register_response_contains_user_object(self, client, mock_email):
        response = client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        data = response.get_json()
        assert "user" in data

    def test_register_response_user_has_required_fields(self, client, mock_email):
        response = client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        user = response.get_json()["user"]
        for field in ("user_id", "email", "full_name", "status", "created_at", "phone_number"):
            assert field in user, f"Field '{field}' missing from response user object."

    def test_register_response_email_matches_input(self, client, mock_email):
        response = client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        user = response.get_json()["user"]
        assert user["email"] == VALID_PAYLOAD["email"]

    def test_register_response_full_name_matches_input(self, client, mock_email):
        response = client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        user = response.get_json()["user"]
        assert user["full_name"] == VALID_PAYLOAD["full_name"]

    def test_register_response_phone_number_matches_input(self, client, mock_email):
        response = client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        user = response.get_json()["user"]
        assert user["phone_number"] == VALID_PAYLOAD["phone_number"]

    def test_register_user_status_is_pending_verification(self, client, mock_email):
        response = client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        user = response.get_json()["user"]
        assert user["status"] == "PENDING_VERIFICATION"

    def test_register_no_jwt_token_in_response(self, client, mock_email):
        response = client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        data = response.get_json()
        assert "access_token" not in data
        assert "token" not in data
        assert "jwt" not in data

    def test_register_password_not_in_response(self, client, mock_email):
        response = client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        data = response.get_json()
        assert_password_not_in_response(data)

    def test_register_no_plaintext_password_in_response(self, client, mock_email):
        response = client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        data = response.get_json()
        assert_no_plaintext_password(data, VALID_PAYLOAD["password"])

    def test_register_password_is_hashed_in_db(self, app, client, mock_email):
        client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        assert_user_password_hashed(app, VALID_PAYLOAD["email"], VALID_PAYLOAD["password"])

    def test_register_dispatches_verification_email_once(self, client, mock_email):
        client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        mock_email.assert_called_once()

    def test_register_email_sent_to_correct_address(self, client, mock_email):
        client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        call_args = mock_email.call_args
        # The email address must appear somewhere in the call args/kwargs
        all_args = str(call_args)
        assert VALID_PAYLOAD["email"] in all_args

    def test_register_user_id_format_in_response(self, client, mock_email):
        """user_id must follow the USR-YYYYMMDD-NNNNN pattern."""
        import re
        response = client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        user_id = response.get_json()["user"]["user_id"]
        assert re.match(r"^USR-\d{8}-\d{5}$", user_id), (
            f"user_id '{user_id}' does not match expected format USR-YYYYMMDD-NNNNN."
        )

    def test_register_created_at_is_iso8601(self, client, mock_email):
        """created_at must be a valid ISO 8601 datetime string."""
        from datetime import datetime
        response = client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        created_at = response.get_json()["user"]["created_at"]
        try:
            datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except ValueError:
            pytest.fail(f"created_at '{created_at}' is not valid ISO 8601.")

    def test_register_db_user_status_is_pending(self, app, client, mock_email):
        """Verify status stored in DB, not just in the response."""
        client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        with app.app_context():
            user = User.query.filter_by(email=VALID_PAYLOAD["email"]).first()
            assert user is not None
            assert user.status == "PENDING_VERIFICATION"


# ---------------------------------------------------------------------------
# Server-side password validation (HTTP 422)
# ---------------------------------------------------------------------------


INVALID_PASSWORD_CASES = [
    ("short1!",        "Password must be at least 8 characters"),
    ("Short!",         "Password must be at least 8 characters"),
    ("nonumeralpass!", "Password must contain at least one number"),
    ("NONUMERALUPPER!","Password must contain at least one number"),
    ("123456!",       "Password must be at least 8 characters"),
    ("lowercase1!",    "Password must contain at least one uppercase letter"),
    ("NoSpecial1",     "Password must contain at least one special character"),
]


class TestRegisterInvalidPasswords:

    @pytest.mark.parametrize("password,expected_message", INVALID_PASSWORD_CASES)
    def test_invalid_password_returns_422(self, client, mock_email, password, expected_message):
        # Arrange
        payload = {**VALID_PAYLOAD, "password": password}
        # Act
        response = client.post(
            REGISTER_URL,
            data=json.dumps(payload),
            content_type="application/json",
        )
        # Assert
        assert response.status_code == 422, (
            f"Expected 422 for password='{password}', got {response.status_code}."
        )

    @pytest.mark.parametrize("password,expected_message", INVALID_PASSWORD_CASES)
    def test_invalid_password_error_code_is_validation_error(
        self, client, mock_email, password, expected_message
    ):
        payload = {**VALID_PAYLOAD, "password": password}
        response = client.post(
            REGISTER_URL,
            data=json.dumps(payload),
            content_type="application/json",
        )
        data = response.get_json()
        assert data.get("error_code") == "VALIDATION_ERROR", (
            f"Expected error_code=VALIDATION_ERROR for password='{password}'."
        )

    @pytest.mark.parametrize("password,expected_message", INVALID_PASSWORD_CASES)
    def test_invalid_password_contains_exact_error_message(
        self, client, mock_email, password, expected_message
    ):
        payload = {**VALID_PAYLOAD, "password": password}
        response = client.post(
            REGISTER_URL,
            data=json.dumps(payload),
            content_type="application/json",
        )
        data = response.get_json()
        fields = data.get("fields", {})
        password_errors = fields.get("password", [])
        assert expected_message in password_errors, (
            f"Expected message '{expected_message}' in fields.password, got: {password_errors}"
        )

    @pytest.mark.parametrize("password,expected_message", INVALID_PASSWORD_CASES)
    def test_invalid_password_no_user_created(
        self, app, client, mock_email, password, expected_message
    ):
        payload = {**VALID_PAYLOAD, "password": password}
        client.post(
            REGISTER_URL,
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert_user_count(app, 0)

    @pytest.mark.parametrize("password,expected_message", INVALID_PASSWORD_CASES)
    def test_invalid_password_no_email_dispatched(
        self, client, mock_email, password, expected_message
    ):
        payload = {**VALID_PAYLOAD, "password": password}
        client.post(
            REGISTER_URL,
            data=json.dumps(payload),
            content_type="application/json",
        )
        mock_email.assert_not_called()

    @pytest.mark.parametrize("password,expected_message", INVALID_PASSWORD_CASES)
    def test_invalid_password_response_is_json(
        self, client, mock_email, password, expected_message
    ):
        payload = {**VALID_PAYLOAD, "password": password}
        response = client.post(
            REGISTER_URL,
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert_json_content_type(response)


# ---------------------------------------------------------------------------
# Duplicate e-mail (HTTP 409)
# ---------------------------------------------------------------------------


class TestRegisterDuplicateEmail:

    def test_duplicate_email_returns_409(self, client, mock_email, existing_user):
        # Arrange
        payload = {**VALID_PAYLOAD, "email": EXISTING_EMAIL}
        # Act
        response = client.post(
            REGISTER_URL,
            data=json.dumps(payload),
            content_type="application/json",
        )
        # Assert
        assert response.status_code == 409

    def test_duplicate_email_error_code(self, client, mock_email, existing_user):
        payload = {**VALID_PAYLOAD, "email": EXISTING_EMAIL}
        response = client.post(
            REGISTER_URL,
            data=json.dumps(payload),
            content_type="application/json",
        )
        data = response.get_json()
        assert data.get("error_code") == "EMAIL_ALREADY_EXISTS"

    def test_duplicate_email_no_new_user_created(self, app, client, mock_email, existing_user):
        payload = {**VALID_PAYLOAD, "email": EXISTING_EMAIL}
        client.post(
            REGISTER_URL,
            data=json.dumps(payload),
            content_type="application/json",
        )
        # Only the pre-seeded user should exist
        assert_user_count(app, 1)

    def test_duplicate_email_no_email_dispatched(self, client, mock_email, existing_user):
        payload = {**VALID_PAYLOAD, "email": EXISTING_EMAIL}
        client.post(
            REGISTER_URL,
            data=json.dumps(payload),
            content_type="application/json",
        )
        mock_email.assert_not_called()

    def test_duplicate_email_response_is_json(self, client, mock_email, existing_user):
        payload = {**VALID_PAYLOAD, "email": EXISTING_EMAIL}
        response = client.post(
            REGISTER_URL,
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert_json_content_type(response)


# ---------------------------------------------------------------------------
# Missing / malformed fields
# ---------------------------------------------------------------------------


class TestRegisterMissingFields:

    @pytest.mark.parametrize("missing_field", ["full_name", "email", "password", "phone_number"])
    def test_missing_required_field_returns_422(self, client, mock_email, missing_field):
        # Arrange
        payload = {k: v for k, v in VALID_PAYLOAD.items() if k != missing_field}
        # Act
        response = client.post(
            REGISTER_URL,
            data=json.dumps(payload),
            content_type="application/json",
        )
        # Assert
        assert response.status_code == 422

    @pytest.mark.parametrize("missing_field", ["full_name", "email", "password", "phone_number"])
    def test_missing_field_no_user_created(self, app, client, mock_email, missing_field):
        payload = {k: v for k, v in VALID_PAYLOAD.items() if k != missing_field}
        client.post(
            REGISTER_URL,
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert_user_count(app, 0)

    @pytest.mark.parametrize("missing_field", ["full_name", "email", "password", "phone_number"])
    def test_missing_field_no_email_dispatched(self, client, mock_email, missing_field):
        payload = {k: v for k, v in VALID_PAYLOAD.items() if k != missing_field}
        client.post(
            REGISTER_URL,
            data=json.dumps(payload),
            content_type="application/json",
        )
        mock_email.assert_not_called()

    def test_invalid_email_format_returns_422(self, client, mock_email):
        payload = {**VALID_PAYLOAD, "email": "not-an-email"}
        response = client.post(
            REGISTER_URL,
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert response.status_code == 422

    def test_empty_body_returns_422(self, client, mock_email):
        response = client.post(
            REGISTER_URL,
            data=json.dumps({}),
            content_type="application/json",
        )
        assert response.status_code == 422

    def test_non_json_body_returns_400_or_415(self, client, mock_email):
        response = client.post(
            REGISTER_URL,
            data="not json",
            content_type="text/plain",
        )
        assert response.status_code in (400, 415)

    def test_phone_number_exceeding_11_digits_returns_422(self, client, mock_email):
        payload = {**VALID_PAYLOAD, "phone_number": "012756445501"} # 12 digits
        response = client.post(
            REGISTER_URL,
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert response.status_code == 422
        data = response.get_json()
        assert data.get("error_code") == "VALIDATION_ERROR"
        assert "Phone number must not exceed 11 digits" in data.get("fields", {}).get("phone_number", [])


# ---------------------------------------------------------------------------
# JWT-related assertions
# ---------------------------------------------------------------------------


class TestRegisterJWTAbsence:
    """Verify no JWT is issued prior to e-mail verification."""

    def test_no_access_token_key_in_response(self, client, mock_email):
        response = client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        data = response.get_json()
        assert "access_token" not in data

    def test_no_refresh_token_key_in_response(self, client, mock_email):
        response = client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        data = response.get_json()
        assert "refresh_token" not in data

    def test_no_bearer_token_in_headers(self, client, mock_email):
        response = client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        assert "Authorization" not in response.headers

    def test_response_user_object_has_no_token_field(self, client, mock_email):
        response = client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        user = response.get_json().get("user", {})
        for token_key in ("token", "jwt", "access_token", "refresh_token"):
            assert token_key not in user, (
                f"Unexpected token field '{token_key}' found in user object."
            )


# ---------------------------------------------------------------------------
# Idempotency / repeated valid registration
# ---------------------------------------------------------------------------


class TestRegisterIdempotency:

    def test_two_registrations_with_same_email_second_returns_409(
        self, client, mock_email
    ):
        # Arrange: first registration succeeds
        client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        mock_email.reset_mock()

        # Act: second registration with identical payload
        response = client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        # Assert
        assert response.status_code == 409

    def test_two_registrations_with_same_email_second_dispatches_no_email(
        self, app, client, mock_email
    ):
        client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        mock_email.reset_mock()
        client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        mock_email.assert_not_called()

    def test_two_registrations_with_same_email_only_one_user_in_db(
        self, app, client, mock_email
    ):
        client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        client.post(
            REGISTER_URL,
            data=json.dumps(VALID_PAYLOAD),
            content_type="application/json",
        )
        assert_user_count(app, 1)

    def test_different_emails_can_both_register_successfully(
        self, app, client, mock_email
    ):
        payload_a = {**VALID_PAYLOAD, "email": "user.a@example.com"}
        payload_b = {**VALID_PAYLOAD, "email": "user.b@example.com"}

        response_a = client.post(
            REGISTER_URL,
            data=json.dumps(payload_a),
            content_type="application/json",
        )
        response_b = client.post(
            REGISTER_URL,
            data=json.dumps(payload_b),
            content_type="application/json",
        )

        assert response_a.status_code == 201
        assert response_b.status_code == 201
        assert_user_count(app, 2)
        assert mock_email.call_count == 2
