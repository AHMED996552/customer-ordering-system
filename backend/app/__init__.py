from flask import Flask
from flask_cors import CORS


def create_app(testing: bool = False) -> Flask:
    app = Flask(__name__)

    if testing:
        app.config["TESTING"] = True

    CORS(app, origins=["http://localhost:3000", "http://localhost:3001"])

    from app.routes.restaurants import bp as restaurants_bp
    app.register_blueprint(restaurants_bp)

    return app
