from flask import Flask

def create_app(config_overrides=None):
    app = Flask(__name__)
    app.secret_key = 'super_secret_session_key'
    
    if config_overrides:
        app.config.update(config_overrides)
        
    from backend.routes.cart import cart_bp
    from backend.routes.orders import orders_bp
    
    app.register_blueprint(cart_bp)
    app.register_blueprint(orders_bp)
    
    return app
