from flask import Flask
from backend.utils.errors import register_error_handlers
from backend.routes.orders import orders_bp

def create_app(config_name='default'):
    app = Flask(__name__)
    app.secret_key = 'super_secret_session_key'

    # Register central error handlers
    register_error_handlers(app)

    # Register blueprints
    app.register_blueprint(orders_bp, url_prefix='/api/v1/orders')

    return app
