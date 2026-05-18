from flask import Blueprint, request, jsonify
from backend.extensions import db
from backend.models.user import User
from backend.utils.validators import validate_password, is_valid_email, validate_phone_number
from backend.utils.generators import generate_user_id
import backend.services.email as email_service
from datetime import datetime, timezone, timedelta
import random

auth_bp = Blueprint('auth', __name__, url_prefix='/api/v1/auth')

@auth_bp.route('/register', methods=['POST'])
def register():
    if not request.is_json:
        return jsonify({"error_code": "INVALID_CONTENT_TYPE"}), 415

    data = request.get_json()
    if not data:
        return jsonify({"error_code": "INVALID_PAYLOAD"}), 422

    required_fields = ["full_name", "email", "password", "phone_number"]
    missing_fields = [f for f in required_fields if f not in data]
    if missing_fields:
        return jsonify({"error_code": "MISSING_FIELDS", "fields": missing_fields}), 422

    email = data["email"]
    password = data["password"]
    full_name = data["full_name"]
    phone_number = data["phone_number"]

    if not is_valid_email(email):
        return jsonify({"error_code": "VALIDATION_ERROR", "fields": {"email": ["Invalid email format"]}}), 422

    fields_errors = {}
    
    password_errors = validate_password(password)
    if password_errors:
        fields_errors["password"] = password_errors
        
    phone_errors = validate_phone_number(phone_number)
    if phone_errors:
        fields_errors["phone_number"] = phone_errors
        
    if fields_errors:
        return jsonify({
            "error_code": "VALIDATION_ERROR",
            "fields": fields_errors
        }), 422

    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        return jsonify({"error_code": "EMAIL_ALREADY_EXISTS"}), 409

    user_id = generate_user_id()
    
    # Generate 6-digit OTP
    otp_code = f"{random.randint(0, 999999):06d}"
    otp_expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    
    # ISO 8601 creation timestamp
    created_at = datetime.now(timezone.utc).isoformat()
    
    new_user = User(
        user_id=user_id,
        email=email,
        full_name=full_name,
        phone_number=phone_number,
        status="PENDING_VERIFICATION",
        created_at=created_at,
        otp_code=otp_code,
        otp_expires_at=otp_expires_at
    )
    new_user.set_password(password)

    db.session.add(new_user)
    db.session.commit()

    # Send actual email
    email_service.send_verification_email(email=email, user_id=user_id, otp_code=otp_code)

    return jsonify({
        "message": "Please check your email to verify your account.",
        "user": new_user.to_dict()
    }), 201

@auth_bp.route('/verify-otp', methods=['POST'])
def verify_otp():
    if not request.is_json:
        return jsonify({"error": "Invalid content type"}), 415

    data = request.get_json()
    email = data.get("email")
    otp_code = data.get("otp_code")

    if not email or not otp_code:
        return jsonify({"error": "Email and OTP code are required"}), 422

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    if user.status == "ACTIVE":
        return jsonify({"message": "User is already verified"}), 200

    if user.otp_code != otp_code:
        return jsonify({"error": "Invalid OTP code"}), 400

    # Check expiration
    if user.otp_expires_at:
        try:
            expires_at = datetime.fromisoformat(user.otp_expires_at)
            if datetime.now(timezone.utc) > expires_at:
                return jsonify({"error": "OTP has expired"}), 400
        except ValueError:
            pass # fallback if parsing fails

    # Verify successfully
    user.status = "ACTIVE"
    user.otp_code = None
    user.otp_expires_at = None
    db.session.commit()

    return jsonify({
        "message": "Account verified successfully",
        "user": user.to_dict()
    }), 200



@auth_bp.route('/resend-otp', methods=['POST'])
def resend_otp():
    if not request.is_json:
        return jsonify({"error": "Invalid content type"}), 415

    data = request.get_json()

    if not data:
        return jsonify({"error": "Invalid payload"}), 422

    email = data.get("email")

    if not email:
        return jsonify({"error": "Email is required"}), 422

    user = User.query.filter_by(email=email).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    if user.status == "ACTIVE":
        return jsonify({
            "message": "User is already verified"
        }), 200

    # Generate new OTP
    otp_code = f"{random.randint(0, 999999):06d}"

    # Expire in 10 minutes
    otp_expires_at = (
        datetime.now(timezone.utc) + timedelta(minutes=10)
    ).isoformat()

    # Save new OTP
    user.otp_code = otp_code
    user.otp_expires_at = otp_expires_at

    db.session.commit()

    # Send email
    email_service.send_verification_email(
        email=email,
        user_id=user.user_id,
        otp_code=otp_code
    )

    return jsonify({
        "message": "Verification code resent successfully"
    }), 200