import sys
import backend
import backend.models
import backend.models.user
import backend.services
import backend.services.email

# Map 'myapp' modules to 'backend' for pytest execution
sys.modules['myapp'] = backend
sys.modules['myapp.models'] = backend.models
sys.modules['myapp.models.user'] = backend.models.user
sys.modules['myapp.services'] = backend.services
sys.modules['myapp.services.email'] = backend.services.email
