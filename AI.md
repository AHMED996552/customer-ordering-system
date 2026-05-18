# Customer Ordering System (LuxeEats) - AI Overview

## Project Architecture

This is a full-stack web application designed for a food ordering platform (LuxeEats). The project follows a modular structure separated into a Python/Flask backend and a web frontend.

### Tech Stack
- **Backend**: Python, Flask, SQLite3
- **Frontend**: Web Frontend (Node/React as indicated by `package.json` and CORS settings for localhost:3000)
- **Database**: SQLite3 (`customer_ordering_system.db`)
- **Testing**: PyTest

## Directory Structure

```text
customer-ordering system/
├── backend/                  # Flask application logic
│   ├── routes/               # API endpoints (e.g., auth, etc.)
│   ├── services/             # Core business logic
│   ├── utils/                # Helper functions
│   ├── models/               # Application-level data structures
│   ├── tests/                # Backend specific tests
│   └── config.py             # Configuration settings
├── database/                 # Database configuration
│   └── schema.py             # SQLite3 schema definition & guard logic
├── frontend/                 # Frontend UI components (Node.js/React environment)
│   ├── package.json          # Frontend dependencies (e.g., lucide-react)
│   └── ...                   # UI components and pages
├── docs/                     # Project documentation
│   ├── LuxeEats_Documentation.md # Main documentation file
│   ├── sprint 1, 2, 3/       # Agile sprint tracking
│   └── tests/                # Test case documentation (e.g., uc-10 test cases)
├── tests/                    # Global/Integration testing suite
│   ├── integration/          # Integration tests
│   ├── unit/                 # Unit tests
│   ├── test_register.py      # Registration testing
│   ├── test_verify_otp.py    # OTP flow testing
│   └── test_cancellation_routes.py # Order cancellation testing
├── main.py                   # Flask Application Factory entry point
└── requirements.txt          # Python dependencies
```

## Main Details & Core Features

### 1. Application Factory (`main.py`)
- Initializes the Flask app, CORS setup, and loads configurations.
- Connects to `customer_ordering_system.db` via `OrderingSystemDB` in `database/schema.py`.
- Registers blueprints such as `auth_bp` and `auth_login_bp`.

### 2. Database Schema & Guard Logic (`database/schema.py`)
The database implements several critical constraints (Guards) at the schema and function level:
- **Restaurants & Menu Items**: Items are linked to specific restaurants and tracked for availability (REQ20).
- **Carts & CartItems**: 
  - Validates quantities are positive integers (REQ12/13).
  - Cross-Restaurant Pollution Guard: Ensures a user cannot add items from different restaurants to the same cart (REQ14).
  - Uses server-side price fetching to prevent price manipulation.
- **Orders**: Tracks confirmed orders with idempotency guarantees using a unique `payment_reference`.
- **Users**: Comprehensive user table supporting OTP verification, failed attempt tracking, and account lockouts for security.

### 3. Testing Suite
- Built systematically to cover unit and integration requirements.
- Uses `conftest.py` for global Pytest fixtures.
- Validates crucial flows: user registration, OTP verification, and order cancellations.
