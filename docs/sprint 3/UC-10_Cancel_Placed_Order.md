# UC-10 — Cancel a Placed Order

## Overview

| Property | Value |
|---|---|
| Use Case | UC-10: Cancel a Placed Order |
| Requirements | REQ10 |
| Actor | Authenticated User who has just placed an order |
| Goal | Cancel an order within the allowed window to correct an accidental or mistaken order before it is prepared |

---

## Requirements

### REQ10 — Cancellation Time Window & Status Guard

The server enforces **two independent guards in sequence**. Both must pass for cancellation to proceed.

#### Guard 1 — Status Guard (evaluated first)

Cancellation proceeds only if `order.status = 'PENDING'`. Any other status triggers HTTP 409 with a status-specific error code:

| `order.status` | HTTP Status | Error Code |
|---|---|---|
| `ACCEPTED` | 409 | `ORDER_ALREADY_ACCEPTED` |
| `IN_PREPARATION` | 409 | `ORDER_NOT_CANCELLABLE` |
| `OUT_FOR_DELIVERY` | 409 | `ORDER_NOT_CANCELLABLE` |
| `DELIVERED` | 409 | `ORDER_NOT_CANCELLABLE` |
| `CANCELLED` | 409 | `ORDER_ALREADY_CANCELLED` |

#### Guard 2 — Time-Window Guard (evaluated only if status = PENDING)

The server evaluates `(server_utc_now() − order.created_at_utc) ≤ 180 seconds` **exclusively** using its own UTC clock. No client-supplied timestamp is read or accepted.

| Elapsed Time | HTTP Status | Error Code | Description |
|---|---|---|---|
| ≤ 179s | 200 | (success) | 1 second before boundary |
| = 180s | 200 | (success) | Exact boundary — still allowed (inclusive) |
| = 181s | 409 | `CANCELLATION_WINDOW_EXPIRED` | 1 second past window — denied |
| ≥ 300s | 409 | `CANCELLATION_WINDOW_EXPIRED` | Well past window |

#### Guard 3 — Atomicity Guard (Payment Gateway)

The refund call to the Payment Gateway and the database `UPDATE` to `'CANCELLED'` are wrapped in a **single atomic transaction**. If the Gateway returns a failure or is unreachable, the transaction is rolled back — `order.status` remains `'PENDING'` and HTTP 502 is returned. No partial state is committed.

**Additional rules:**
- `cancelled_at` is server-generated UTC; the client never supplies a cancellation timestamp.
- `refund.status` is `"INITIATED"` on success — final settlement arrives via a Gateway webhook. The client is never blocked waiting for settlement.
- The operation uses `POST /api/v1/orders/{id}/cancel` (not `DELETE`) because cancellation is a state transition, not resource removal. The order record persists with `status = 'CANCELLED'` for audit purposes.

---

## API Contract

### Endpoint

| Property | Value |
|---|---|
| Method & URL | `POST /api/v1/orders/{id}/cancel` |
| Authentication | Required — HTTP-only session cookie |
| Request Body | None required or accepted |

No request body is read. The server derives all required context — order ownership, current status, creation timestamp, and payment reference — from its own records.

### Success Response — HTTP 200 (Happy Path)

```json
{
  "order": {
    "order_id": "ORD-20260510-001",
    "status": "CANCELLED",
    "cancelled_at": "2026-05-10T14:34:47Z",
    "refund": {
      "refund_reference": "REF-GW-TXN-88312",
      "amount_egp": 150.00,
      "status": "INITIATED"
    }
  },
  "message": "Your order has been cancelled. A refund of 150.00 EGP has been initiated."
}
// REQ10 INVARIANT: cancelled_at is server-generated UTC. refund.status is
// "INITIATED" — final settlement arrives via Gateway webhook; the client
// is never blocked waiting for settlement confirmation.
```

### Error Response — HTTP 403 (Cross-User Authorization Guard)

```json
{
  "error": {
    "code": "ORDER_ACCESS_DENIED",
    "message": "You do not have permission to cancel this order."
  }
}
// Response is structurally identical whether the order belongs to another
// user or does not exist. Prevents order ID enumeration.
```

### Error Response — HTTP 409 (REQ10 Status Guard: Order Already Accepted)

```json
{
  "error": {
    "code": "ORDER_ALREADY_ACCEPTED",
    "message": "This order has already been accepted by the restaurant and cannot be cancelled."
  }
}
```

### Error Response — HTTP 409 (REQ10 Status Guard: Order Not Cancellable)

```json
{
  "error": {
    "code": "ORDER_NOT_CANCELLABLE",
    "message": "This order is no longer eligible for cancellation.",
    "details": {
      "current_status": "IN_PREPARATION"
    }
  }
}
```

### Error Response — HTTP 409 (REQ10 Status Guard: Already Cancelled)

```json
{
  "error": {
    "code": "ORDER_ALREADY_CANCELLED",
    "message": "This order has already been cancelled."
  }
}
```

### Error Response — HTTP 409 (REQ10 Time-Window Guard: Window Expired)

```json
{
  "error": {
    "code": "CANCELLATION_WINDOW_EXPIRED",
    "message": "The 3-minute cancellation window for this order has closed.",
    "details": {
      "created_at": "2026-05-10T14:32:00Z",
      "window_closed_at": "2026-05-10T14:35:00Z",
      "server_utc_time_at_request": "2026-05-10T14:35:22Z"
    }
  }
}
// REQ10 CONTRACT: window_closed_at = created_at + 180 seconds.
// server_utc_time_at_request is surfaced for debugging transparency only.
// It must never be used as input to any client-side re-computation.
```

### Error Response — HTTP 502 (Atomicity Guard: Payment Gateway Failure)

```json
{
  "error": {
    "code": "REFUND_FAILED",
    "message": "We could not process your cancellation at this time. Please try again.",
    "details": {
      "order_id": "ORD-20260510-001",
      "current_status": "PENDING"
    }
  }
}
// ATOMICITY INVARIANT: the order status transition to 'CANCELLED' is rolled back.
// order.status remains 'PENDING' in the database.
// No partial state is committed. The client should display a retry prompt.
```

### Server-Side Gate Evaluation Order

| Gate | Check | On Failure |
|---|---|---|
| **Gate 1 — Session & Ownership** | `session.user_id == order.user_id` | HTTP 403 `ORDER_ACCESS_DENIED` |
| **Gate 2 — REQ10 Status Guard** | `order.status == 'PENDING'` | HTTP 409 (status-specific code) |
| **Gate 3 — REQ10 Time-Window Guard** | `elapsed ≤ 180s` (server UTC only) | HTTP 409 `CANCELLATION_WINDOW_EXPIRED` |
| **Gate 4 — Atomicity Guard** | Payment Gateway refund succeeds | HTTP 502 `REFUND_FAILED`; rollback |
| **Happy Path** | All gates pass | HTTP 200; status → `CANCELLED`; refund `INITIATED` |

### Information Hiding Rationale

| Hidden Concern | What the Client Sees |
|---|---|
| Guard evaluation order (status before time-window) | Observable only via the specific HTTP 409 error code returned |
| Server UTC clock authority | `server_utc_time_at_request` in 409 body for debugging only; no client input accepted |
| Atomicity implementation (DB transaction wrapping Gateway call + status UPDATE) | One request in, one outcome out |
| Refund settlement flow (async Gateway webhook) | `refund.status: "INITIATED"`; settlement not visible to client |
| Raw Gateway decline code | Hidden behind uniform HTTP 502 envelope |

---

## Gherkin Scenarios

### Background

```gherkin
Given the Customer Ordering System is running and reachable
And the following order exists:
  | order_id         | user_id   | status  | created_at_utc           | total_egp |
  | ORD-20260510-001 | USR-00001 | PENDING | 2026-05-10T14:32:00Z     | 150.00    |
And the configurable cancellation window is set to exactly 3 minutes (180 seconds)
And the Payment Gateway is operational and ready to process refunds
And the user "USR-00001" is authenticated via a valid HTTP-only session cookie
```

### Scenario 1 — REQ10: Successfully cancel a PENDING order within the 3-minute window

```gherkin
# Covers: REQ10
Scenario: Successfully cancel a PENDING order within the 3-minute window
  Given the server UTC time is 179 seconds after order "ORD-20260510-001" was created
  And the order status is "PENDING"
  When the user sends POST "/api/v1/orders/ORD-20260510-001/cancel"
  Then the server shall respond with HTTP 200 OK
  And the order status in the database shall transition to "CANCELLED"
  And the Payment Gateway shall receive exactly one refund initiation request
    for the amount 150.00 EGP referencing "ORD-20260510-001"
  And the response shall include a refund_reference field from the Gateway
  And the UI shall display: "Your order has been cancelled. A refund has been initiated."
```

### Scenario 2 — REQ10: Cancellation window boundary enforcement (Scenario Outline)

```gherkin
# Covers: REQ10
Scenario Outline: Cancellation window guard enforced at exact time boundaries
  Given the order "ORD-20260510-001" has status "PENDING"
  And the server UTC time is <elapsed_seconds> seconds after order creation
  When the user sends POST "/api/v1/orders/ORD-20260510-001/cancel"
  Then the server shall respond with HTTP <expected_status>
  And the response error code shall be "<expected_code>"
  And the order status in the database shall be "<expected_db_status>"
  And a refund request shall be sent to the Payment Gateway only if <refund_dispatched> is true

  Examples:
    | elapsed_seconds | expected_status | expected_code               | expected_db_status | refund_dispatched |
    | 179             | 200             | (success)                   | CANCELLED          | true              |
    | 180             | 200             | (success)                   | CANCELLED          | true              |
    | 181             | 409             | CANCELLATION_WINDOW_EXPIRED | PENDING            | false             |
    | 300             | 409             | CANCELLATION_WINDOW_EXPIRED | PENDING            | false             |
```

### Scenario 3 — REQ10: Cancellation rejected when status is ACCEPTED regardless of elapsed time

```gherkin
# Covers: REQ10
Scenario: Cancellation rejected when order status is ACCEPTED regardless of elapsed time
  Given the order "ORD-20260510-001" has been updated to status "ACCEPTED"
  And the server UTC time is 60 seconds after order creation
  When the user sends POST "/api/v1/orders/ORD-20260510-001/cancel"
  Then the server shall respond with HTTP 409 Conflict
  And the response error code shall be "ORDER_ALREADY_ACCEPTED"
  And the order status in the database shall remain "ACCEPTED"
  And no refund request shall be dispatched to the Payment Gateway
```

### Scenario 4 — REQ10: All non-PENDING statuses block cancellation (Scenario Outline)

```gherkin
# Covers: REQ10
Scenario Outline: All non-PENDING terminal statuses block cancellation
  Given the order "ORD-20260510-001" has status "<current_status>"
  And the server UTC time is 60 seconds after order creation
  When the user sends POST "/api/v1/orders/ORD-20260510-001/cancel"
  Then the server shall respond with HTTP 409 Conflict
  And the response error code shall be "<expected_code>"
  And the order status in the database shall remain "<current_status>"
  And no refund request shall be dispatched to the Payment Gateway

  Examples:
    | current_status   | expected_code            |
    | ACCEPTED         | ORDER_ALREADY_ACCEPTED   |
    | IN_PREPARATION   | ORDER_NOT_CANCELLABLE    |
    | OUT_FOR_DELIVERY | ORDER_NOT_CANCELLABLE    |
    | DELIVERED        | ORDER_NOT_CANCELLABLE    |
    | CANCELLED        | ORDER_ALREADY_CANCELLED  |
```

### Scenario 5 — REQ10: Payment Gateway failure rolls back status (Atomicity Guard)

```gherkin
# Covers: REQ10
Scenario: Payment Gateway failure during refund does not leave order in inconsistent state
  Given the order "ORD-20260510-001" has status "PENDING"
  And the server UTC time is 60 seconds after order creation
  And the Payment Gateway is configured to return a refund failure response
  When the user sends POST "/api/v1/orders/ORD-20260510-001/cancel"
  Then the server shall respond with HTTP 502 Bad Gateway
  And the response error code shall be "REFUND_FAILED"
  And the order status in the database shall remain "PENDING"
    (no partial state transition shall be committed)
  And the UI shall display:
    "We could not process your cancellation at this time. Please try again."
```
