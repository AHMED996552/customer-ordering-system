"""
auth_routes.py — UC-7: Authenticate User Identity
Exposes: POST /api/v1/auth/login
Security rules:
  - JWT is NEVER placed in the JSON response body
  - Token is set as an HTTP-only, SameSite=Lax cookie
  - Response body only carries non-sensitive user metadata
"""

import os
import datetime
import jwt
from flask import Blueprint, request, jsonify, make_response, current_app

from backend.services.auth_service import authenticate_user, _AuthServiceError

auth_login_bp = Blueprint("auth_login", __name__, url_prefix="/api/v1/auth")

_JWT_ALGORITHM = "HS256"
_TOKEN_TTL_HOURS = 8


@auth_login_bp.route("/login", methods=["POST"])
def login():
    """
    POST /api/v1/auth/login
    Body: { "email": str, "password": str }

    Success (200):
        - HTTP-only cookie  →  auth_token=<JWT>
        - JSON body         →  { "user": { user_id, email, full_name } }

    Errors: 400, 401, 403, 429
    """
    body = request.get_json(silent=True) or {}
    email: str = body.get("email", "").strip()
    password: str = body.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    db_path: str = current_app.config.get("DATABASE_PATH")

    try:
        user = authenticate_user(db_path, email, password)
    except _AuthServiceError as exc:
        return jsonify({"error": str(exc)}), exc.status_code

    # ── Build JWT (stored in cookie, NOT in body) ─────────────────────────────
    secret_key: str = current_app.config.get("JWT_SECRET_KEY")
    token_payload = {
        "sub": user["id"],          # internal integer PK — never exposed to client
        "uid": user["user_id"],     # TEXT UUID — safe to embed in token claims
        "email": user["email"],
        "iat": datetime.datetime.now(datetime.timezone.utc),
        "exp": datetime.datetime.now(datetime.timezone.utc)
        + datetime.timedelta(hours=_TOKEN_TTL_HOURS),
    }
    token: str = jwt.encode(token_payload, secret_key, algorithm=_JWT_ALGORITHM)

    # ── Craft response ────────────────────────────────────────────────────────
    response = make_response(
        jsonify(
            {
                "message": "Login successful.",
                "user": {
                    "user_id": user["user_id"],  # TEXT UUID exposed to frontend
                    "email": user["email"],
                    "full_name": user["full_name"],
                },
            }
        ),
        200,
    )

    is_secure = current_app.config.get("ENV", "development") == "production"
    response.set_cookie(
        "auth_token",
        value=token,
        httponly=True,          # JS cannot access this cookie
        samesite="Lax",         # CSRF protection
        secure=is_secure,       # HTTPS-only in production
        max_age=_TOKEN_TTL_HOURS * 3600,
        path="/",
    )

    return response
