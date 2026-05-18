# Project Structure: LuxeEats (Customer Ordering System)

This document provides a comprehensive overview of the customer-ordering system project's structure, architecture, and core components. It serves as a guide to understanding where different parts of the application reside.

---

## 🏗️ High-Level Architecture

The project follows a modern full-stack application structure, conceptually divided into the following key areas:

- **Frontend (Client-Side):** Built with React, handling the user interface and interactions.
- **Backend (Server-Side):** Python-based application using a strict 3-tier architecture (Routes, Services, Models).
- **Database:** Handles data schema definitions and persistence.
- **Documentation:** Contains product specifications, design docs, and sprint-related materials.
- **Testing:** Includes tests for ensuring functionality across the application.

---

## 📁 Directory Layout

```
customer-ordering-system/
├── backend/                   # Backend API logic and 3-tier architecture
│   ├── models/                # Data models and database interaction layers (e.g., cart_model.py)
│   ├── routes/                # API endpoint definitions and controllers (e.g., cart_routes.py)
│   └── services/              # Core business logic and validation (e.g., cart_service.py)
├── database/                  # Database scripts and schemas
│   └── schema.py              # Defines the overall database schema and relations
├── docs/                      # Project documentation and specifications
│   ├── LuxeEats_Documentation.md # Detailed product spec for the high-end culinary marketplace
│   ├── sprint 1/              # Documentation/assets related to Sprint 1
│   ├── sprint 2/              # Documentation/assets related to Sprint 2
│   ├── sprint 3/              # Documentation related to Sprint 3 (e.g., UC-8, UC-9, UC-10)
│   └── tests/                 # Test specifications and documentation (e.g., uc-8.md)
├── frontend/                  # Client-side user interface code
│   └── customer-ordering-sys/ # React application root
│       ├── public/            # Static assets (index.html, manifest.json, etc.)
│       ├── src/               # React source code
│       │   ├── assets/        # Images, fonts, and media
│       │   ├── components/    # Reusable UI components
│       │   ├── layouts/       # Page layout structures
│       │   ├── pages/         # Full page views (Landing Page, Restaurant Page, Cart, Profile)
│       │   └── utils/         # Helper functions and utilities
│       ├── package.json       # Node.js dependencies and scripts
│       └── package-lock.json
├── tests/                     # Unit and integration test suites
│   ├── integration/           # Integration tests (e.g., test_order_routes.py for UC-8)
│   └── unit/                  # Unit tests (e.g., test_order_service.py for UC-8)
├── .env                       # Environment variables (Ignored in Git)
├── .gitignore                 # Git ignore rules
├── main.py                    # Main entry point for the backend application
└── LICENSE                    # Project license file
```

---

## 🧩 Detailed Component Breakdown

### 1. Backend (`/backend`)

The backend is designed using a robust 3-tier architecture to maintain clear separation of concerns:

- **Routes Layer** (`backend/routes/`): Acts as the controller. It receives HTTP requests, delegates them to the appropriate service, and formats the response (often using standardized error envelopes).
- **Service Layer** (`backend/services/`): The heart of the application. Contains all the business logic, constraints checking, and transaction orchestration.
- **Model Layer** (`backend/models/`): Manages the direct interaction with the database or data layer, executing queries and returning data objects.

### 2. Frontend (`/frontend/customer-ordering-sys`)

The frontend is a React application built to provide a high-end, premium user experience as specified in the `LuxeEats_Documentation.md`.

- Core pages include the Landing Page, Restaurant Page, Item Details, Cart & Checkout, and User Profile.
- The structure inside `src` (`components`, `layouts`, `pages`, `utils`) ensures scalable UI development.

### 3. Database (`/database`)

Currently housing `schema.py`, this directory is responsible for defining how data such as Users, Restaurants, Menu Items, and Orders are structured and persisted.

### 4. Documentation (`/docs`)

The single source of truth for project requirements. The flagship document, `LuxeEats_Documentation.md`, details the product's identity as a prestige culinary marketplace, complete with user flows, brand aesthetics, and key features like "Elite Rewards", "Live Order Tracking", and "Connoisseur Curations".

### 5. Testing (`/tests`)

Contains test suites, utilizing tools like `pytest`, to ensure the 3-tier backend and overall application behave according to requirements (e.g., verifying that adding items to the cart satisfies all business constraints, and validating UC-8 order history pagination/IDOR protection). Tests are categorized into `unit` (testing service logic) and `integration` (testing route endpoints).

---

## 🚀 Getting Started (Development)

### Backend

1. Navigate to the project root.
2. Activate your virtual environment (`.venv`).
3. Run the application via `main.py` or your configured ASGI/WSGI server.

### Frontend

1. Navigate to `frontend/customer-ordering-sys`
2. Install dependencies: `npm install`
3. Start the development server: `npm start`
4. Run the test suite: `npm test`

---

## 🧪 UC-8 — View Personal Order History (Frontend Implementation)

### Overview

UC-8 delivers the **Order History** page (`/my-orders`) where authenticated users review past orders, track spending, and reorder. Identity is resolved exclusively from the HTTP-only session cookie — no `user_id` is ever passed as a query parameter.

### New/Modified Files

| File | Role |
|---|---|
| `src/utils/orderHistory.utils.ts` | Pure formatting utilities (`formatOrderDate`, `formatCurrency`, `getStatusColor`) |
| `src/hooks/useOrderHistory.ts` | Custom hook encapsulating `GET /api/v1/orders` with pagination, error mapping, and cookie credentials |
| `src/pages/OrderHistory.tsx` | Full page component — Featured Card, Insights sidebar, History Grid, Pagination, Error & Empty states |
| `src/utils/orderHistory.utils.test.ts` | Jest unit tests for the three utility functions |
| `src/pages/__tests__/OrderHistory.test.tsx` | RTL integration tests with MSW mocks for all UC-8 scenarios |

### API Integration

- **Endpoint:** `GET /api/v1/orders?page=<n>&limit=10`
- **Auth:** `credentials: 'include'` — session cookie forwarded automatically
- **Pagination defaults:** `page=1`, `limit=10`
- **Sort:** Backend returns results `created_at DESC`; UI renders them in received order

### Error Handling Contract

| HTTP Status | Code | UI Behaviour |
|---|---|---|
| 401 | `UNAUTHENTICATED` | Shows message + **Login** button |
| 403 | `ORDER_ACCESS_DENIED` | Shows IDOR-denied message |
| 422 | `VALIDATION_ERROR` | Shows validation message |
| Network | `NETWORK_ERROR` | Generic fallback alert |

### Test Coverage (UC-8 Gherkin → Test Mapping)

| Scenario | Test |
|---|---|
| SC-1: Successful paginated list | `displays order data with all 6 mandatory fields` |
| SC-2: Pagination page change | `handles pagination controls and dispatches new requests` |
| SC-3: Unauthenticated redirect | `displays HTTP 401 Unauthenticated error and prompts login` |
| SC-4: Cross-user list guard | `displays HTTP 403 Order Access Denied error` |
| SC-5: Direct order IDOR | `displays HTTP 403 Order Access Denied error` |
| Empty state | `handles empty state correctly` |
| a11y | `meets accessibility (a11y) standards for images and interactive elements` |
