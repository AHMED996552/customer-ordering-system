# UC-6 — Register New Account

## Overview

| Property | Value |
|---|---|
| Use Case | UC-6: Register New Account |
| Requirements | REQ5 |
| Actor | New Visitor |
| Goal | Create an account using email, password, and full name to place orders and access order history |

---

## Requirements

### REQ5 — Password Complexity Guard

A password must satisfy **both** conditions simultaneously:

| Rule | Constraint |
|---|---|
| Minimum length | ≥ 8 characters |
| Numeric digit | At least one digit from `{0…9}` |

**UI Layer enforcement:**
- The submit button transitions to `disabled=true` the moment either condition is unmet.
- A descriptive inline message is displayed immediately below the password field.

**API Layer enforcement:**
- Any violation returns **HTTP 422** with `code: "VALIDATION_ERROR"` and the exact `fields.password` message.
- No user record is created and no verification email is dispatched on failure.

**Additional rules:**
- On successful registration, a verification email is dispatched.
- **No JWT session token** is issued until email verification is complete — the account status is `PENDING_VERIFICATION`.
- Duplicate email registration returns **HTTP 409** with `code: "EMAIL_ALREADY_EXISTS"`.

---

## API Contract

### Endpoint

| Property | Value |
|---|---|
| Method & URL | `POST /api/v1/auth/register` |
| Authentication | Not required |
| Content-Type | `application/json` |

### Request Payload

```json
{
  "full_name": "string",   // Required. 1-100 characters.
  "email": "string",       // Required. Valid RFC 5322 format. Must be unique.
  "password": "string"     // Required. REQ5: min 8 chars, >= 1 numeric digit.
                           // Immediately hashed server-side. Never stored/logged
                           // in plaintext. Never returned in any response.
}
```

### Success Response — HTTP 201

```json
{
  "user": {
    "user_id": "USR-20260510-00192",
    "email": "new.user@example.com",
    "full_name": "Ahmed Mohamed Rashed",
    "status": "PENDING_VERIFICATION",
    "created_at": "2026-05-10T14:32:00Z"
  },
  "message": "Please check your email to verify your account."
}
```

### Error Response — HTTP 409 (Duplicate Email)

```json
{
  "error": {
    "code": "EMAIL_ALREADY_EXISTS",
    "message": "An account with this email address already exists."
  }
}
```

### Error Response — HTTP 422 (Password Complexity Failure — REQ5)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request payload failed validation.",
    "fields": {
      "password": "Password must be at least 8 characters and contain at least one number."
    }
  }
}
```

### Error Response — HTTP 422 (Multiple Field Failures)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request payload failed validation.",
    "fields": {
      "email": "Must be a valid email address.",
      "password": "Password must be at least 8 characters and contain at least one number."
    }
  }
}
```

### Information Hiding Rationale

| Hidden Concern | What the Client Sees |
|---|---|
| Hashing algorithm, salt rounds, and pepper | Interface boundary: plaintext in, nothing out |
| Email verification token format, expiry, and retry logic | Opaque to client; only the dispatch outcome is observable |
| User ID generation strategy | Server-generated; client cannot predict or supply it |
| Duplicate detection query and case-sensitivity normalisation | HTTP 409 communicates outcome only |

---

## Gherkin Scenarios

### Background

```gherkin
Given the Customer Ordering System is running and reachable
And the email "existing.user@example.com" already exists in the user database
And the SMS/Email Provider is operational and ready to dispatch emails
```

### Scenario 1 — REQ5: Successfully register a new account with valid credentials

```gherkin
# Covers: REQ5
Scenario: Successfully register a new account with valid credentials
  Given the user is on the registration page at "/register"
  When the user enters:
    | field     | value                |
    | full_name | Ahmed Mohamed Rashed |
    | email     | new.user@example.com |
    | password  | SecurePass1          |
  And the user clicks "Create Account"
  Then the server shall respond with HTTP 201 Created
  And a new user record shall be created in the database
  And the SMS/Email Provider shall receive exactly one dispatch request
  And the UI shall display: "Please check your email to verify your account."
  And no JWT session token shall be issued until email is verified
```

### Scenario 2 — REQ5: UI disables submit while password is fewer than 8 characters

```gherkin
# Covers: REQ5
Scenario: UI disables submit while password is fewer than 8 characters
  Given the user is on the registration page
  When the user enters "Short1" into the password field (6 characters)
  Then the "Create Account" button shall be disabled
  And a UI message shall read "Password must be at least 8 characters"
  And no HTTP request shall be dispatched to "/api/v1/auth/register"
```

### Scenario 3 — REQ5: UI disables submit while password contains no numeral

```gherkin
# Covers: REQ5
Scenario: UI disables submit while password contains no numeral
  Given the user is on the registration page
  When the user enters "NoNumbersHere" into the password field
  Then the "Create Account" button shall be disabled
  And a UI message shall read "Password must contain at least one number"
  And no HTTP request shall be dispatched to "/api/v1/auth/register"
```

### Scenario 4 — REQ5: Server rejects non-compliant passwords (Scenario Outline)

```gherkin
# Covers: REQ5
Scenario Outline: Server rejects non-compliant passwords with HTTP 422
  Given a client bypasses the UI and sends POST to "/api/v1/auth/register"
  When the request body contains email "test@test.com" and password "<password>"
  Then the server shall respond with HTTP 422 Unprocessable Entity
  And the response error code shall be "VALIDATION_ERROR"
  And the response fields.password shall equal "<error_message>"
  And no user record shall be created in the database
  And no verification email shall be dispatched

  Examples:
    | password       | error_message                              |
    | short1         | Password must be at least 8 characters     |
    | Short          | Password must be at least 8 characters     |
    | nonumeralpass  | Password must contain at least one number  |
    | NONUMERALUPPER | Password must contain at least one number  |
    | 1234567        | Password must be at least 8 characters     |
```

### Scenario 5 — REQ5: Server rejects registration with duplicate email

```gherkin
# Covers: REQ5
Scenario: Server rejects registration with a duplicate email address
  When a POST is sent to "/api/v1/auth/register" with email "existing.user@example.com" and password "ValidPass9"
  Then the server shall respond with HTTP 409 Conflict
  And the response error code shall be "EMAIL_ALREADY_EXISTS"
  And no new user record shall be created and no email shall be dispatched
```
