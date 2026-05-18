from flask import Flask
from backend.routes.menu import menu_bp

def create_app():
    """
    App factory pattern for the Flask application.
    """
    app = Flask(__name__)
    
    # Register blueprints
    app.register_blueprint(menu_bp)
    
    return app
