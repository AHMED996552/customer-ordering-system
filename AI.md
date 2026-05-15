# Customer Ordering System Project Structure

This document outlines the file and folder structure of the Customer Ordering System project.

## Directory Tree

# Customer Ordering System Project Structure

This document outlines the file and folder structure of the Customer Ordering System project.

## Directory Tree

```text
customer-ordering system/
├── backend/                  # Backend application code (Python)
│   ├── models/               # Data models and business entities
│   │   ├── __init__.py
│   │   └── cart_model.py     # Cart data model and validation
│   ├── routes/               # API endpoints and route definitions
│   │   ├── __init__.py
│   │   └── cart_routes.py    # API endpoints for cart operations
│   └── services/             # Core business logic and external integrations
│       ├── __init__.py
│       └── cart_service.py   # Business logic for cart operations
├── database/                 # Database configurations and schemas
│   └── schema.py             # SQLite database schema, guards, and DB setup
├── docs/                     # Project documentation
│   ├── LuxeEats_Documentation.md
│   ├── docs.md
│   ├── Tests/                # Test cases documentation documents
│   │   └── test_cases_uc3.md # Test cases matrix for Use Case 3
│   └── ٍsprint 1/            # Sprint-specific use cases and requirements
│       ├── UC-3.md
│       ├── UC-4.md
│       └── UC-5.md
├── frontend/                 # Frontend web application (Node.js/React based)
│   └── customer-ordering-sys/# Main frontend workspace
│       ├── public/           # Static web assets
│       ├── src/              # Frontend source code (UI, hooks, services)
│       │   ├── components/   # Reusable UI components (e.g., MenuItemCard, QuantitySelector)
│       │   ├── pages/        # Application pages (e.g., MenuPage)
│       │   └── services/     # API integration (e.g., cartApi.ts)
│       ├── package.json      # Node.js package configurations and scripts
│       ├── package-lock.json
│       ├── .gitignore
│       └── README.md
├── tests/                    # Automated testing suite (Python/Pytest)
│   ├── conftest.py           # Pytest fixtures and configurations
│   └── test_uc3_add_to_cart.py # Tests for Use Case 3 (Add to Cart logic)
├── .env                      # Environment variables 
├── .gitignore                # Git ignore rules
├── LICENSE                   # Project license file
└── main.py                   # Main entry point for the application

## Key Components

### Backend
The application logic is decoupled into a traditional 3-tier architecture inside the `backend/` directory (`routes` for HTTP handling, `services` for business logic, and `models` for data representation).

### Database
The `database/schema.py` defines an SQLite database built with strict application and database-level constraints (guards) focusing on data integrity (e.g., verifying quantities, prices, and preventing cross-restaurant carts).

### Frontend
Located in `frontend/customer-ordering-sys/`, containing standard frontend configurations utilizing `npm` (`package.json`).

### Documentation
The `docs/` folder contains overarching project outlines (`LuxeEats_Documentation.md`) and sprint-specific use cases (like `UC-3.md`, `UC-4.md`, `UC-5.md` in `ٍsprint 1/`).
