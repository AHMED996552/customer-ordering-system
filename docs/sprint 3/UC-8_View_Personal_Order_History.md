# UC-8 — View Personal Order History

## Overview

| Property | Value |
|---|---|
| Use Case | UC-8: View Personal Order History |
| Requirements | REQ8 |
| Actor | Authenticated User |
| Goal | View a paginated list of all past orders sorted by date descending to review order history, track spending, and reorder previously placed items |

---

## Requirements

### REQ8 — Personal Order History Display

The order history endpoint must:

1. Return only orders belonging to the **authenticated user** — identity is resolved exclusively from the server-side session bound to the HTTP-only cookie. No `user_id` query parameter is accepted.
2. Sort results by `created_at` **descending** (most recent first).
3. Support **pagination** with `page` and `limit` query parameters.
4. Each order entry must expose all six mandatory fields:

| Field | Description |
|---|---|
| `order_id` | Unique order identifier |
| `restaurant_name` | Name of the restaurant |
| `created_at` | Order placement timestamp (ISO 8601 UTC) |
| `item_summary` | Pre-formatted string aggregate of ordered items |
| `total_egp` | Order total in EGP (2 decimal places) |
| `status` | Current order status |

**Authorization rules:**
- Unauthenticated requests return **HTTP 401** with `code: "UNAUTHENTICATED"` and no order data.
- Cross-user access attempts (manipulated session) still return only the session owner's orders — the server never queries beyond `session.user_id`.
- Direct lookup of another user's order by ID returns **HTTP 403** with `code: "ORDER_ACCESS_DENIED"`.

**Pagination rules:**

| Parameter | Type | Required | Default | Constraints |
|---|---|---|---|---|
| `page` | integer | No | 1 | Positive integer ≥ 1 |
| `limit` | integer | No | 10 | Positive integer, range 1–50 |

---

## API Contract

### Endpoint

| Property | Value |
|---|---|
| Method & URL | `GET /api/v1/orders` |
| Authentication | Required — HTTP-only session cookie |
| Content-Type | `application/json` |

### Success Response — HTTP 200

```json
{
  "orders": [
    {
      "order_id": "ORD-20260510-001",
      "restaurant_id": "R001",
      "restaurant_name": "Burger Palace",
      "created_at": "2026-05-10T14:32:00Z",
      "item_summary": "Classic Burger x2",
      "total_egp": 150.00,
      "status": "DELIVERED",
      "cancellable": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total_count": 3,
    "total_pages": 1
  }
}
```

### Error Response — HTTP 401 (Unauthenticated)

```json
{
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "You must be logged in to view your order history."
  }
}
```

### Error Response — HTTP 422 (Invalid Pagination Parameters)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request parameters failed validation.",
    "fields": {
      "page": "Must be a positive integer greater than or equal to 1.",
      "limit": "Must be a positive integer between 1 and 50."
    }
  }
}
```

### Error Response — HTTP 403 (Cross-User Order Access)

```json
{
  "error": {
    "code": "ORDER_ACCESS_DENIED",
    "message": "You do not have permission to access this order."
  }
}
```

### Information Hiding Rationale

| Hidden Concern | What the Client Sees |
|---|---|
| Identity resolution mechanism | No `user_id` parameter exists; server derives it from session exclusively |
| `cancellable` dual-condition evaluation (`status = 'PENDING'` AND `elapsed ≤ 180s`) | One boolean field |
| Pagination implementation (SQL LIMIT/OFFSET, cursor, cache) | `page`, `limit`, `total_count`, `total_pages` only |
| Raw line-item records | Pre-formatted `item_summary` string only |

---

## Gherkin Scenarios

### Background

```gherkin
Given the Customer Ordering System is running and reachable
And the following verified user accounts exist:
  | user_id   | email                        | status         |
  | USR-00001 | verified.user@example.com    | EMAIL_VERIFIED |
  | USR-00002 | other.user@example.com       | EMAIL_VERIFIED |
And the following completed order records exist in the database:
  | order_id           | user_id   | restaurant_name | created_at_utc           | total_egp | status    |
  | ORD-20260510-001   | USR-00001 | Burger Palace   | 2026-05-10T14:32:00Z     | 150.00    | DELIVERED |
  | ORD-20260509-002   | USR-00001 | Pizza Kingdom   | 2026-05-09T20:15:00Z     | 110.00    | DELIVERED |
  | ORD-20260508-003   | USR-00001 | Sushi House     | 2026-05-08T13:00:00Z     | 210.00    | CANCELLED |
  | ORD-20260510-004   | USR-00002 | Night Bites     | 2026-05-10T22:00:00Z     | 65.00     | DELIVERED |
And the user "USR-00001" is authenticated via a valid HTTP-only session cookie
```

### Scenario 1 — REQ8: Successfully retrieve paginated order history sorted by date descending

```gherkin
# Covers: REQ8
Scenario: Successfully retrieve paginated order history sorted by date descending
  Given the user is authenticated as "USR-00001"
  When the user navigates to "/my-orders"
  Then the system shall call GET "/api/v1/orders?page=1&limit=10"
  And the server shall respond with HTTP 200 OK
  And the response shall contain exactly 3 order records belonging to "USR-00001"
  And the orders shall be sorted by created_at descending:
    | position | order_id         | created_at_utc           |
    | 1        | ORD-20260510-001 | 2026-05-10T14:32:00Z     |
    | 2        | ORD-20260509-002 | 2026-05-09T20:15:00Z     |
    | 3        | ORD-20260508-003 | 2026-05-08T13:00:00Z     |
  And each order entry in the UI shall display all of the following fields:
    | field           |
    | order_id        |
    | restaurant_name |
    | created_at      |
    | item_summary    |
    | total_egp       |
    | status          |
```

### Scenario 2 — REQ8: Pagination returns the correct page of results (Scenario Outline)

```gherkin
# Covers: REQ8
Scenario Outline: Order history pagination returns the correct page of results
  Given the user "USR-00001" has 25 completed orders in the database
  When the user requests GET "/api/v1/orders?page=<page>&limit=10"
  Then the server shall respond with HTTP 200 OK
  And the response shall contain exactly <count> order records
  And the response metadata shall include total_count = 25 and total_pages = 3

  Examples:
    | page | count | description        |
    | 1    | 10    | first full page    |
    | 2    | 10    | second full page   |
    | 3    | 5     | last partial page  |
```

### Scenario 3 — REQ8: Unauthenticated user is redirected to login

```gherkin
# Covers: REQ8
Scenario: Unauthenticated user is redirected to login when accessing order history
  Given no valid session cookie is present in the request
  When a GET request is made to "/api/v1/orders"
  Then the server shall respond with HTTP 401 Unauthorized
  And the response error code shall be "UNAUTHENTICATED"
  And the UI shall redirect the user to "/login"
  And no order data shall be included in the response
```

### Scenario 4 — REQ8: Authorization guard — cross-user order list attempt

```gherkin
# Covers: REQ8
Scenario: Authorization guard — user cannot retrieve another user's order history
  Given the user "USR-00001" is authenticated via a valid session cookie
  When the user sends GET "/api/v1/orders" with a manipulated session
    attempting to impersonate "USR-00002"
  Then the server shall resolve the requesting identity exclusively from
    the server-side session bound to the HTTP-only cookie
  And the server shall respond with HTTP 200 OK
  And the response shall contain only orders belonging to "USR-00001"
  And no orders belonging to "USR-00002" shall appear in the response
```

### Scenario 5 — REQ8: Authorization guard — direct order ID lookup scoped to session owner

```gherkin
# Covers: REQ8
Scenario: Authorization guard — direct order ID lookup is scoped to session owner
  Given the user "USR-00001" is authenticated
  When the user sends GET "/api/v1/orders/ORD-20260510-004"
  Then the server shall respond with HTTP 403 Forbidden
  And the response error code shall be "ORDER_ACCESS_DENIED"
  And no order data for "ORD-20260510-004" shall be returned
```
