# UC-9 — Track Live Order Status

## Overview

| Property | Value |
|---|---|
| Use Case | UC-9: Track Live Order Status |
| Requirements | REQ11 |
| Actor | Authenticated User who has placed an order |
| Goal | Receive near-real-time status updates on an active order to know where it is in the fulfilment pipeline at all times |

---

## Requirements

### REQ11 — Real-Time Status Updates

The server must push a status transition event to the client within **≤ 30 seconds** of the status update being committed to the database.

| Rule | Value |
|---|---|
| Maximum push latency | 30 seconds |
| Measurement start | Database `UPDATE` commit timestamp |
| Measurement end | Client DOM reflects the new status label |
| Reload required | No — update must arrive without full page reload or manual refresh |
| Mechanism | Server-Sent Events (SSE) via `GET /api/v1/orders/{id}/status-stream` |

**Order status stages (in sequence):**

| Stage | Description |
|---|---|
| `PENDING` | Order placed, awaiting restaurant acceptance |
| `ACCEPTED` | Restaurant has accepted the order |
| `IN_PREPARATION` | Order is being prepared |
| `OUT_FOR_DELIVERY` | Order is with the delivery driver |
| `DELIVERED` | Order delivered — terminal state |

**Terminal state handling:**
- For orders with status `DELIVERED` or `CANCELLED`, the response includes `stream_endpoint: null`.
- The client must **not** open an SSE connection when `stream_endpoint` is `null`.

**Authorization rules:**
- Identity is resolved exclusively from the server-side session (HTTP-only cookie). No `user_id` is accepted in the request.
- Cross-user access returns **HTTP 403** with `code: "ORDER_ACCESS_DENIED"` — structurally identical to a not-found response, preventing order ID enumeration.

---

## API Contract

### Endpoint

| Property | Value |
|---|---|
| Method & URL | `GET /api/v1/orders/{id}` |
| Authentication | Required — HTTP-only session cookie |
| Path Parameter | `id` — the order identifier |

### Success Response — HTTP 200 (Active Order)

```json
{
  "order": {
    "order_id": "ORD-20260510-001",
    "status": "IN_PREPARATION",
    "restaurant_id": "R001",
    "restaurant_name": "Burger Palace",
    "items": [
      {
        "item_id": "I001",
        "name": "Classic Burger",
        "quantity": 2,
        "unit_price_egp": 75.00,
        "line_total_egp": 150.00
      }
    ],
    "server_computed_total_egp": 150.00,
    "delivery_address": {
      "street": "15 El-Geish Street",
      "city": "Alexandria",
      "notes": "Ring doorbell twice."
    },
    "special_instructions": "No onions, please.",
    "payment_reference": "PAY-GW-TXN-77241",
    "created_at": "2026-05-10T14:32:00Z",
    "cancellable": false,
    "status_timeline": [
      { "stage": "PENDING",           "completed": true,  "timestamp": "2026-05-10T14:32:00Z" },
      { "stage": "ACCEPTED",          "completed": true,  "timestamp": "2026-05-10T14:34:10Z" },
      { "stage": "IN_PREPARATION",    "completed": false, "timestamp": null },
      { "stage": "OUT_FOR_DELIVERY",  "completed": false, "timestamp": null },
      { "stage": "DELIVERED",         "completed": false, "timestamp": null }
    ],
    "stream_endpoint": "/api/v1/orders/ORD-20260510-001/status-stream"
  }
}
```

### Success Response — HTTP 200 (Terminal-State Order)

Same structure as above, but:
```json
{
  "stream_endpoint": null
}
```
The client must not open an SSE connection when `stream_endpoint` is `null`.

### Error Response — HTTP 403 (Cross-User Authorization Guard)

```json
{
  "error": {
    "code": "ORDER_ACCESS_DENIED",
    "message": "You do not have permission to access this order."
  }
}
// SECURITY: Response is structurally identical whether the order belongs
// to another user or does not exist. Divergent responses enable order
// ID enumeration. HTTP 404 is never returned for a cross-user mismatch.
```

### SSE Stream Endpoint

| Property | Value |
|---|---|
| Method & URL | `GET /api/v1/orders/{id}/status-stream` |
| Protocol | Server-Sent Events (SSE) |
| Authentication | Required — HTTP-only session cookie |

**SSE push event payload:**
```json
{
  "new_status": "ACCEPTED",
  "timestamp": "2026-05-10T14:34:10Z"
}
```

### Information Hiding Rationale

| Hidden Concern | What the Client Sees |
|---|---|
| Authorization branching (not found vs. wrong user) | Uniform HTTP 403 with `ORDER_ACCESS_DENIED` |
| SSE backing mechanism (Redis Pub/Sub, polling loop, message broker) | `stream_endpoint` URL; client connects and receives events |
| `status_timeline` state-machine definition and stage ordering | Pre-assembled array in received order; client renders as-is |
| `cancellable` dual-condition evaluation | One boolean field |

---

## Gherkin Scenarios

### Background

```gherkin
Given the Customer Ordering System is running and reachable
And the following active order exists:
  | order_id         | user_id   | restaurant_name | current_status |
  | ORD-20260510-001 | USR-00001 | Burger Palace   | PENDING        |
And the user "USR-00001" is authenticated via a valid HTTP-only session cookie
```

### Scenario 1 — REQ11: Successfully open order tracking page and receive current status

```gherkin
# Covers: REQ11
Scenario: Successfully open order tracking page and receive current order status
  Given the user "USR-00001" is authenticated
  When the user navigates to "/orders/ORD-20260510-001/track"
  Then the system shall call GET "/api/v1/orders/ORD-20260510-001"
  And the server shall respond with HTTP 200 OK
  And the response shall include the current status "PENDING"
  And the UI shall display the order status timeline with all defined stages:
    | stage            | state    |
    | PENDING          | active   |
    | ACCEPTED         | upcoming |
    | IN_PREPARATION   | upcoming |
    | OUT_FOR_DELIVERY | upcoming |
    | DELIVERED        | upcoming |
```

### Scenario 2 — REQ11: Status update pushed to client within 30 seconds (Scenario Outline)

```gherkin
# Covers: REQ11
Scenario Outline: Status update pushed to client within 30 seconds of restaurant action
  Given the user "USR-00001" has an active tracking session open for "ORD-20260510-001"
  And the current order status is "<from_status>"
  When the restaurant staff updates the order status to "<to_status>"
  Then the client shall receive a push notification of the status change
    within <max_seconds> seconds of the update being committed to the database
  And the UI status timeline shall reflect "<to_status>" as the active stage
    without requiring a full page reload or manual refresh

  Examples:
    | from_status      | to_status        | max_seconds |
    | PENDING          | ACCEPTED         | 30          |
    | ACCEPTED         | IN_PREPARATION   | 30          |
    | IN_PREPARATION   | OUT_FOR_DELIVERY | 30          |
    | OUT_FOR_DELIVERY | DELIVERED        | 30          |
```

### Scenario 3 — REQ11: Authorization guard — user cannot track another user's order

```gherkin
# Covers: REQ11
Scenario: Authorization guard — user cannot track an order belonging to another user
  Given the user "USR-00001" is authenticated
  When the user sends GET "/api/v1/orders/ORD-20260510-004"
    where "ORD-20260510-004" belongs to "USR-00002"
  Then the server shall respond with HTTP 403 Forbidden
  And the response error code shall be "ORDER_ACCESS_DENIED"
  And no status data for "ORD-20260510-004" shall be returned
```

### Scenario 4 — REQ11: Tracking a terminal-state order returns final status with no active push

```gherkin
# Covers: REQ11
Scenario: Tracking a terminal-state order returns final status with no active push
  Given the order "ORD-20260510-001" has reached the terminal status "DELIVERED"
  When the user navigates to "/orders/ORD-20260510-001/track"
  Then the server shall respond with HTTP 200 OK
  And the response shall include status "DELIVERED"
  And stream_endpoint in the response shall be null
  And no active SSE connection shall be established for a terminal-state order
```
