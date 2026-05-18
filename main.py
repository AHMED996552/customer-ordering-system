import sys
import os

# Ensure backend directory is in sys.path so modules can be imported directly as routes, services, models
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend'))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from flask import Flask
from routes.order_routes import order_bp

app = Flask(__name__)
app.config['SECRET_KEY'] = 'luxeeats_production_secret_key'

# Register the order routes blueprint
app.register_blueprint(order_bp, url_prefix='/api/v1')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
