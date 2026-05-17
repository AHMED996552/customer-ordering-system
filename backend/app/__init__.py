from flask import Flask


def create_app(testing: bool = False) -> Flask:
    app = Flask(__name__)

    if testing:
        app.config["TESTING"] = True

    from app.routes.restaurants import bp as restaurants_bp
    app.register_blueprint(restaurants_bp)

    return app
