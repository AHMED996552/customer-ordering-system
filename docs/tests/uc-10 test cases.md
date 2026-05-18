# Test Cases Document: Cancel a Placed Order (UC-10)

## 1. Feature Overview
This feature allows an authenticated user to cancel a placed order to correct a mistake before the order is prepared. The cancellation is subject to strict guards evaluated sequentially: 
1. **Ownership**: The user must be the authenticated owner of the order.
2. **Status Guard**: The order must be in the `PENDING` status.
3. **Time-Window Guard**: The cancellation must be requested within exactly 3 minutes (180 seconds) of the order's creation time (evaluated using the server's UTC clock).
4. **Atomicity Guard**: The refund process via the Payment Gateway must succeed to commit the cancellation. If the refund fails, the system rolls back to prevent a partial state.

## 2. BDD Scenarios (Gherkin Syntax)

```gherkin
Background:
  Given the Customer Ordering System is running and reachable
  And the user "USR-00001" is authenticated via a valid HTTP-only session cookie
  And the user has placed an order "ORD-001" which is in "PENDING" status
  And the configurable cancellation window is set to 3 minutes (180 seconds)

# Happy Path
Scenario: Successfully cancel a PENDING order within the time window
  Given the server UTC time is 179 seconds after order "ORD-001" was created
  And the order status is "PENDING"
  When the user requests to cancel order "ORD-001"
  Then the server shall respond with HTTP 200 OK
  And the order status in the database shall transition to "CANCELLED"
  And the Payment Gateway shall receive a refund initiation request
  And the response shall include a refund_reference

# Negative Case: Time Window Expired
Scenario: Cancellation window guard enforced immediately after boundary
  Given the server UTC time is 181 seconds after order creation
  When the user requests to cancel order "ORD-001"
  Then the server shall respond with HTTP 409 Conflict
  And the response error code shall be "CANCELLATION_WINDOW_EXPIRED"
  And the order status in the database shall remain "PENDING"
  And no refund request shall be sent to the Payment Gateway

# Negative Case: Invalid Status
Scenario: Cancellation rejected when order status is ACCEPTED
  Given the order "ORD-001" has been updated to status "ACCEPTED"
  And the server UTC time is within the 180 seconds window
  When the user requests to cancel order "ORD-001"
  Then the server shall respond with HTTP 409 Conflict
  And the response error code shall be "ORDER_ALREADY_ACCEPTED"
  And the order status shall remain "ACCEPTED"

# Security Case: Unauthorized Access
Scenario: Cancellation rejected for a different user's order
  Given the user "USR-00002" is authenticated
  When the user "USR-00002" requests to cancel order "ORD-001"
  Then the server shall respond with HTTP 403 Forbidden
  And the response error code shall be "ORDER_ACCESS_DENIED"
  And the order status shall remain "PENDING"

# Edge Case: Payment Failure Atomicity
Scenario: Payment Gateway failure rolls back status transition
  Given the order status is "PENDING" within the time window
  And the Payment Gateway is configured to return a failure
  When the user requests to cancel order "ORD-001"
  Then the server shall respond with HTTP 502 Bad Gateway
  And the response error code shall be "REFUND_FAILED"
  And the order status shall remain "PENDING"
  And no partial state transition shall be committed
```

## 3. Detailed Test Cases

| Test Case ID | Scenario Title | Test Type | Preconditions | Action / Steps | Expected Result |
|---|---|---|---|---|---|
| **TC-001** | Successful cancellation within time window | Positive (Happy Path) | User is authenticated. Order `status=PENDING`. Elapsed time `< 180s`. Payment gateway is operational. | 1. Authenticate as order owner.<br>2. Send `POST /api/v1/orders/{id}/cancel`. | HTTP 200 OK. Order status becomes `CANCELLED`. Refund is initiated and `refund_reference` returned. |
| **TC-002** | Cancellation on exact window boundary (180s) | Edge Case | User is authenticated. Order `status=PENDING`. Elapsed time `== 180s` (exact). Payment gateway is operational. | 1. Authenticate as order owner.<br>2. Send `POST /api/v1/orders/{id}/cancel` exactly 180s after creation. | HTTP 200 OK. Order status becomes `CANCELLED`. Refund is initiated. |
| **TC-003** | Cancellation immediately after boundary (181s) | Boundary / Negative | User is authenticated. Order `status=PENDING`. Elapsed time `== 181s`. | 1. Authenticate as order owner.<br>2. Send `POST /api/v1/orders/{id}/cancel`. | HTTP 409 Conflict. Error `CANCELLATION_WINDOW_EXPIRED`. Order remains `PENDING`. |
| **TC-004** | Cancellation when order is `ACCEPTED` | Negative | User is authenticated. Order `status=ACCEPTED`. Elapsed time `< 180s`. | 1. Authenticate as order owner.<br>2. Send `POST /api/v1/orders/{id}/cancel`. | HTTP 409 Conflict. Error `ORDER_ALREADY_ACCEPTED`. Order remains `ACCEPTED`. |
| **TC-005** | Cancellation when order is `IN_PREPARATION` | Negative | User is authenticated. Order `status=IN_PREPARATION`. | 1. Authenticate as order owner.<br>2. Send `POST /api/v1/orders/{id}/cancel`. | HTTP 409 Conflict. Error `ORDER_NOT_CANCELLABLE`. Order remains `IN_PREPARATION`. |
| **TC-006** | Cancellation when order is `CANCELLED` | Negative | User is authenticated. Order `status=CANCELLED`. | 1. Authenticate as order owner.<br>2. Send `POST /api/v1/orders/{id}/cancel`. | HTTP 409 Conflict. Error `ORDER_ALREADY_CANCELLED`. Order remains `CANCELLED`. |
| **TC-007** | Cancel another user's order | Security / Negative | User B is authenticated. Order belongs to User A. | 1. Authenticate as User B.<br>2. Send `POST /api/v1/orders/{id}/cancel` using User A's order ID. | HTTP 403 Forbidden. Error `ORDER_ACCESS_DENIED`. Order remains unchanged. |
| **TC-008** | Cancel a non-existent order | Security / Negative | User is authenticated. No such order ID exists. | 1. Authenticate as a valid user.<br>2. Send `POST /api/v1/orders/INVALID_ID/cancel`. | HTTP 403 Forbidden. Error `ORDER_ACCESS_DENIED`. (Structurally identical to TC-007 to prevent ID enumeration). |
| **TC-009** | Payment gateway failure | Negative / Edge Case | User is authenticated. Order `status=PENDING`. Elapsed time `< 180s`. Payment gateway returns an error. | 1. Authenticate as order owner.<br>2. Send `POST /api/v1/orders/{id}/cancel`. | HTTP 502 Bad Gateway. Error `REFUND_FAILED`. DB transaction is rolled back; order remains `PENDING`. |
| **TC-010** | Unauthenticated cancellation request | Security / Negative | User is NOT authenticated (no valid cookie). | 1. Send `POST /api/v1/orders/{id}/cancel` without session cookie. | HTTP 401 Unauthorized. Request is blocked before hitting application logic. |
