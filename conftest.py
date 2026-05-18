import sys
import backend
import backend.models
import backend.models.user
import backend.services
import backend.services.email

import backend.routes.restaurants
import backend.services.restaurant_service

# Map 'myapp' modules to 'backend' for pytest execution
sys.modules['myapp'] = backend
sys.modules['myapp.models'] = backend.models
sys.modules['myapp.models.user'] = backend.models.user
sys.modules['myapp.services'] = backend.services
sys.modules['myapp.services.email'] = backend.services.email

# Map 'app' modules to 'backend' to satisfy legacy patches in catalog test suites
sys.modules['app'] = backend
sys.modules['app.routes'] = backend.routes
sys.modules['app.routes.restaurants'] = backend.routes.restaurants
sys.modules['app.services'] = backend.services
sys.modules['app.services.restaurant_service'] = backend.services.restaurant_service
