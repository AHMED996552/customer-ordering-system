# conftest.py — root-level pytest configuration
# Adds the project root to sys.path so imports like
# `from backend.services.auth_service import ...` work without install.

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
