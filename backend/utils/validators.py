import re

def validate_password(password: str) -> list:
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

def is_valid_email(email: str) -> bool:
    return re.match(r"[^@]+@[^@]+\.[^@]+", email) is not None

def validate_phone_number(phone_number: str) -> list:
    errors = []
    # Extract only digits to check the actual digit count
    digits = [ch for ch in phone_number if ch.isdigit()]
    if len(digits) > 11:
        errors.append("Phone number must not exceed 11 digits")
    return errors
