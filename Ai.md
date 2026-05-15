# Project Structure: LuxeEats (Customer Ordering System)

This document provides a comprehensive overview of the `customer-ordering system` project's structure, architecture, and core components. It serves as a guide to understanding where different parts of the application reside.

## 🏗️ High-Level Architecture

The project follows a modern full-stack application structure, conceptually divided into the following key areas:

1. **Frontend (Client-Side)**: Built with React, handling the user interface and interactions.
2. **Backend (Server-Side)**: Python-based application using a strict 3-tier architecture (Routes, Services, Models).
3. **Database**: Handles data schema definitions and persistence.
4. **Documentation**: Contains product specifications, design docs, and sprint-related materials.
5. **Testing**: Includes tests for ensuring functionality across the application.

---

## 📁 Directory Layout

```text
customer-ordering system/
├── backend/                   # Backend API logic and 3-tier architecture
│   ├── models/                # Data models and database interaction layers (e.g., cart_model.py)
│   ├── routes/                # API endpoint definitions and controllers (e.g., cart_routes.py)
│   └── services/              # Core business logic and validation (e.g., cart_service.py)
├── database/                  # Database scripts and schemas
│   └── schema.py              # Defines the overall database schema and relations
├── docs/                      # Project documentation and specifications
│   ├── LuxeEats_Documentation.md # Detailed product spec for the high-end culinary marketplace
│   ├── sprint 1/              # Documentation/assets related to Sprint 1
│   └── sprint 2/              # Documentation/assets related to Sprint 2
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
│   └── (Test files e.g., test_uc3_add_to_cart.py)
├── .env                       # Environment variables (Ignored in Git)
├── .gitignore                 # Git ignore rules
├── main.py                    # Main entry point for the backend application
└── LICENSE                    # Project license file
```

---

## 🧩 Detailed Component Breakdown

### 1. Backend (`/backend`)
The backend is designed using a robust 3-tier architecture to maintain clear separation of concerns:
* **Routes Layer (`backend/routes/`)**: Acts as the controller. It receives HTTP requests, delegates them to the appropriate service, and formats the response (often using standardized error envelopes).
* **Service Layer (`backend/services/`)**: The heart of the application. Contains all the business logic, constraints checking, and transaction orchestration.
* **Model Layer (`backend/models/`)**: Manages the direct interaction with the database or data layer, executing queries and returning data objects.

### 2. Frontend (`/frontend/customer-ordering-sys`)
The frontend is a React application built to provide a high-end, premium user experience as specified in the `LuxeEats_Documentation.md`.
* Core pages include the **Landing Page**, **Restaurant Page**, **Item Details**, **Cart & Checkout**, and **User Profile**.
* The structure inside `src` (components, layouts, pages, utils) ensures scalable UI development.

### 3. Database (`/database`)
Currently housing `schema.py`, this directory is responsible for defining how data such as Users, Restaurants, Menu Items, and Orders are structured and persisted.

### 4. Documentation (`/docs`)
The single source of truth for project requirements. The flagship document, `LuxeEats_Documentation.md`, details the product's identity as a prestige culinary marketplace, complete with user flows, brand aesthetics, and key features like "Elite Rewards", "Live Order Tracking", and "Connoisseur Curations".

### 5. Testing (`/tests`)
Contains test suites, utilizing tools like `pytest`, to ensure the 3-tier backend and overall application behave according to requirements (e.g., verifying that adding items to the cart satisfies all business constraints).

---

## 🚀 Getting Started (Development)

**Backend:**
1. Navigate to the project root.
2. Activate your virtual environment (`.venv`).
3. Run the application via `main.py` or your configured ASGI/WSGI server.

**Frontend:**
1. Navigate to `frontend/customer-ordering-sys`.
2. Install dependencies: `npm install`
3. Start the development server: `npm start`
