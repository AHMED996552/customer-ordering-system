# UC-7 — Authenticate User Identity

## Overview

| Property | Value |
|---|---|
| Use Case | UC-7: Authenticate User Identity |
| Requirements | REQ6 |
| Actor | Registered User |
| Goal | Log in with email and password to access the account, order history, and place orders |

---

## Requirements

### REQ6 — Rate-Limiting and Brute-Force Guard

After exactly **5 consecutive failed login attempts** for a single account within a **rolling 10-minute window**, all further requests for that account return **HTTP 429** until the window elapses — including requests containing the correct password.

| Rule | Value |
|---|---|
| Lockout threshold | 5 consecutive failures |
| Time window | 10-minute rolling window |
| Counter scope | Per-account (not per-IP) |
| Lockout response | HTTP 429 with `code: "ACCOUNT_LOCKED"` |
| Reset condition | Successful login resets counter to `0` |
| Window expiry behaviour | Counter resets; next failure returns HTTP 401, not 429 |

**Boundary table:**

| Prior Failures | New Attempt | HTTP Status | Error Code | Description |
|---|---|---|---|---|
| 0 | Failed | 401 | `INVALID_CREDENTIALS` | First failure — no lockout |
| 1 | Failed | 401 | `INVALID_CREDENTIALS` | Second failure — no lockout |
| 3 | Failed | 401 | `INVALID_CREDENTIALS` | Fourth failure — no lockout |
| 4 | Failed | 429 | `ACCOUNT_LOCKED` | Fifth failure — lockout triggers |
| 5 | Failed | 429 | `ACCOUNT_LOCKED` | Already locked — remains locked |

**Additional rules:**
- JWT is delivered **only** via HTTP-only `Set-Cookie` header — never in the JSON response body.
- Non-existent email returns the **same HTTP 401** as a wrong password to prevent user enumeration.
- Accounts with status `PENDING_VERIFICATION` return HTTP 403 before password comparison.

---

## API Contract

### Endpoint

| Property | Value |
|---|---|
| Method & URL | `POST /api/v1/auth/login` |
| Authentication | Not required (this endpoint establishes authentication) |
| Content-Type | `application/json` |

### Request Payload

```json
{
  "email": "string",    // Required. Non-empty. No format validation
                        // (intentionally generic to prevent user enumeration).
  "password": "string"  // Required. Non-empty. No complexity check at login
                        // stage — credential matching only.
}
```

### Success Response — HTTP 200

```json
{
  "user": {
    "user_id": "USR-20260510-00192",
    "email": "verified.user@example.com",
    "full_name": "Ahmed Mohamed Rashed"
  },
  "token": {
    "expires_at": "2026-05-11T14:32:00Z"
  }
}
// NOTE: The JWT is delivered ONLY via HTTP-only Set-Cookie header.
// It is never present in the JSON response body.
// expires_at is for UI display only; authoritative expiry is in the signed token.
```

### Error Response — HTTP 401 (Invalid Credentials)

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password."
  }
}
// SECURITY: Response is structurally identical whether the email does not exist
// or the password is incorrect. Divergent responses enable user enumeration.
```

### Error Response — HTTP 429 (Account Locked — REQ6)

```json
{
  "error": {
    "code": "ACCOUNT_LOCKED",
    "message": "Too many failed attempts. Please try again later.",
    "details": {
      "lockout_expires_at": "2026-05-10T14:42:00Z"
    }
  }
}
// REQ6 INVARIANT: HTTP 429 is returned for ALL requests against a locked account,
// including requests with the correct password, until lockout_expires_at is reached.
```

### Error Response — HTTP 403 (Email Not Verified)

```json
{
  "error": {
    "code": "EMAIL_NOT_VERIFIED",
    "message": "Please verify your email address before logging in."
  }
}
```

### Server-Side Execution Order (Gate Chain)

The server evaluates these four gates **in sequence**. An earlier gate short-circuits all later ones:

| Gate | Check | Failure Response |
|---|---|---|
| **Gate 1 — REQ6** | `failed_attempts >= 5` within current 10-min window | HTTP 429 `ACCOUNT_LOCKED` |
| **Gate 2** | Account lookup by email | HTTP 401 `INVALID_CREDENTIALS` (same as wrong password) |
| **Gate 3** | Email verification status = `ACTIVE` | HTTP 403 `EMAIL_NOT_VERIFIED` |
| **Gate 4** | Password hash comparison | HTTP 401 `INVALID_CREDENTIALS`; increments counter |
| **Happy path** | All gates pass | HTTP 200; counter reset to 0; JWT via Set-Cookie |

### Information Hiding Rationale

| Hidden Concern | What the Client Sees |
|---|---|
| JWT signing algorithm, secret key, token rotation strategy | Interface: valid credentials in → session cookie out |
| Password hash comparison algorithm | HTTP 401 is the only observable outcome of a mismatch |
| Rate-limit counter storage (Redis, in-memory, DB row) | Scope (per-account) observable only through HTTP 429 |
| Lockout window computation | `lockout_expires_at` is server-computed; client displays, never calculates |
| Internal branching (email not found vs. wrong password) | Uniform HTTP 401 response — no divergent body |

---

## Gherkin Scenarios

### Background

```gherkin
Given the Customer Ordering System is running and reachable
And a verified user account exists with email "verified.user@example.com"
  and password "CorrectPass1" (hashed) and status EMAIL_VERIFIED
And no prior failed login attempts exist in the current 10-minute window
```

### Scenario 1 — REQ6: Successfully authenticate with correct credentials

```gherkin
# Covers: REQ6
Scenario: Successfully authenticate with correct credentials
  Given the user is on the login page at "/login"
  When the user enters email "verified.user@example.com" and password "CorrectPass1"
  And the user clicks "Log In"
  Then the server shall respond with HTTP 200 OK
  And the response shall include a signed JWT delivered via HTTP-only Set-Cookie header
  And the JWT token shall have a configurable expiry present in its payload
  And the user shall be redirected to the homepage at "/"
```

### Scenario 2 — REQ6: Account locked after 5 consecutive failed attempts

```gherkin
# Covers: REQ6
Scenario: Account locked after 5 consecutive failed attempts within 10 minutes
  Given the account has 4 consecutive failed attempts in the current 10-minute window
  When the user submits a 5th failed attempt with password "WrongPassword9"
  Then the server shall respond with HTTP 429 Too Many Requests
  And the response error code shall be "ACCOUNT_LOCKED"
  And the message shall read "Too many failed attempts. Please try again later."
  And no JWT token shall be issued
```

### Scenario 3 — REQ6: Locked account rejects even the correct password

```gherkin
# Covers: REQ6
Scenario: Locked account rejects even the correct password during the lockout window
  Given the account has been locked due to 5 consecutive failures
  And the 10-minute lockout window has NOT yet elapsed
  When the user submits the correct password "CorrectPass1"
  Then the server shall respond with HTTP 429 Too Many Requests
  And no JWT token shall be issued
```

### Scenario 4 — REQ6: Successful login resets the failure counter

```gherkin
# Covers: REQ6
Scenario: Successful login resets the consecutive failure counter to zero
  Given the account has 3 consecutive failed login attempts
  When the user submits a successful login with password "CorrectPass1"
  Then the server shall respond with HTTP 200 OK
  And the consecutive failed attempt counter shall be reset to 0
  And a valid JWT session token shall be issued
```

### Scenario 5 — REQ6: Rate-limiting boundary enforcement (Scenario Outline)

```gherkin
# Covers: REQ6
Scenario Outline: Rate-limiting lockout boundary enforced at exactly 5 attempts
  Given the account has <prior_failures> consecutive failures in the current window
  When the user submits another failed attempt with password "WrongPassword9"
  Then the server shall respond with HTTP <expected_status>
  And the response error code shall be "<expected_code>"

  Examples:
    | prior_failures | expected_status | expected_code       | description                       |
    | 0              | 401             | INVALID_CREDENTIALS | First failure — no lockout        |
    | 1              | 401             | INVALID_CREDENTIALS | Second failure — no lockout       |
    | 3              | 401             | INVALID_CREDENTIALS | Fourth failure — no lockout       |
    | 4              | 429             | ACCOUNT_LOCKED      | Fifth failure — lockout triggers  |
    | 5              | 429             | ACCOUNT_LOCKED      | Already locked — remains locked   |
```

### Scenario 6 — REQ6: Non-existent email returns same HTTP 401 as wrong password

```gherkin
# Covers: REQ6
Scenario: Non-existent email returns same HTTP 401 as wrong password
  When a POST is sent to "/api/v1/auth/login" with email "ghost@nowhere.com" and password "AnyPass1"
  Then the server shall respond with HTTP 401 Unauthorized
  And the response error code shall be "INVALID_CREDENTIALS"
  And no account-specific information shall be revealed in the response
```
