import sys
import backend

# Monkeypatch setup to satisfy tests that look for `myapp`
sys.modules['myapp'] = backend
try:
    import backend.services.email
    import backend.models
    import backend.models.user
    sys.modules['myapp.services'] = backend.services
    sys.modules['myapp.services.email'] = backend.services.email
    sys.modules['myapp.models'] = backend.models
    sys.modules['myapp.models.user'] = backend.models.user
except ImportError:
    pass

from flask import Flask
from backend.extensions import db
from backend.routes.auth import auth_bp
from backend.config import Config

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    
    with app.app_context():
        db.create_all()

    app.register_blueprint(auth_bp)

    return app
