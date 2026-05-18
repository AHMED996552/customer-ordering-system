import os
from flask import Flask
from flask_cors import CORS


def create_app(testing: bool = False) -> Flask:
    app = Flask(__name__)

    if testing:
        app.config["TESTING"] = True

    _allowed_origins = [
        o.strip()
        for o in os.environ.get(
            "ALLOWED_ORIGINS",
            "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001",
        ).split(",")
        if o.strip()
    ]
    CORS(app, origins=_allowed_origins)

    from app.routes.restaurants import bp as restaurants_bp
    app.register_blueprint(restaurants_bp)

    return app
