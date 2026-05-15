# UC-1 — Browse Restaurant Catalog

## Overview

| Property | Value |
|---|---|
| Use Case | UC-1: Browse Restaurant Catalog |
| Requirements | REQ1, REQ19 |
| Actor | Authenticated or Guest User |
| Goal | View a list of all active restaurants with their details to select a restaurant and begin building an order |

---

## Requirements

### REQ1 — Restaurant Catalog Metadata Display

Each restaurant entry returned by the catalog API must expose all six mandatory fields:

| Field | Description |
|---|---|
| `name` | Restaurant display name |
| `cuisine_category` | Cuisine type (e.g., American, Italian) |
| `avg_rating` | Pre-computed aggregate rating (1 decimal place, 0.0–5.0) |
| `est_delivery_min` | Estimated delivery time in minutes |
| `delivery_fee_egp` | Delivery fee in EGP (2 decimal places) |
| `open_closed_status` | Current open/closed status label |

- Open restaurants render as **interactive** (clickable cards).
- Closed restaurants render as **non-interactive** with the exact label `"Currently Closed"` and zero HTTP requests fire on click.
- Page renders **without a full page reload** (no `DOMContentLoaded` event fires during fetch).

### REQ19 — Server-Time Operating-Hours Validation

- The server evaluates `open_time_utc <= server_utc_now() < close_time_utc` **exclusively** using its own UTC clock.
- Client-supplied or browser-side time is **never** accepted or used.
- Cross-midnight restaurants (e.g., 20:00–04:00) use: `server_utc_now >= open_time_utc OR server_utc_now < close_time_utc`.
- `server_utc_time_at_request` is returned for debugging only and must never drive client-side logic.

**Boundary Table (REQ19):**

| Server UTC | `is_open` | Status Label | Description |
|---|---|---|---|
| 09:59 | `false` | Currently Closed | 1 minute before opening |
| 10:00 | `true` | Open | Exact opening boundary |
| 21:59 | `true` | Open | Last valid minute |
| 22:00 | `false` | Currently Closed | Exact closing boundary |
| 03:00 | `false` | Currently Closed | Middle of the night |

---

## API Contract

### Endpoint

| Property | Value |
|---|---|
| Method & URL | `GET /api/v1/restaurants` |
| Authentication | Not required (public endpoint) |
| Base URL | `/api/v1` |
| Content-Type | `application/json` |

No request body or query parameters required.

### Success Response — HTTP 200

```json
{
  "restaurants": [
    {
      "restaurant_id": "R001",
      "name": "Burger Palace",
      "cuisine_category": "American",
      "avg_rating": 4.5,
      "est_delivery_min": 25,
      "delivery_fee_egp": 15.00,
      "is_open": true,
      "status_label": "Open",
      "operating_hours_display": "10:00 AM - 10:00 PM"
    },
    {
      "restaurant_id": "R002",
      "name": "Pizza Kingdom",
      "cuisine_category": "Italian",
      "avg_rating": 4.2,
      "est_delivery_min": 35,
      "delivery_fee_egp": 20.00,
      "is_open": false,
      "status_label": "Currently Closed",
      "operating_hours_display": "11:00 AM - 11:00 PM"
    }
  ],
  "total_count": 2,
  "server_utc_time_at_request": "2026-05-10T03:00:00Z"
}
```

### Error Response — HTTP 503

```json
{
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "The restaurant catalog is temporarily unavailable. Please try again."
  }
}
```

### Information Hiding Rationale

| Hidden Concern | What the Client Sees |
|---|---|
| Operating-hours UTC computation (incl. cross-midnight logic) | One boolean: `is_open` |
| Database schema, table names, index structure | Not exposed |
| Rating aggregation method (on-the-fly vs. cached) | Pre-computed `avg_rating` value only |
| Raw `open_time_utc` / `close_time_utc` column values | Pre-formatted `operating_hours_display` string only |

---

## Gherkin Scenarios

### Background

```gherkin
Given the Customer Ordering System is running and reachable
And the database contains the following restaurant records:
  | restaurant_id | name          | cuisine  | avg_rating | est_delivery_min | delivery_fee_egp | open_utc | close_utc |
  | R001          | Burger Palace | American | 4.5        | 25               | 15.00            | 10:00    | 22:00     |
  | R002          | Pizza Kingdom | Italian  | 4.2        | 35               | 20.00            | 11:00    | 23:00     |
  | R003          | Sushi House   | Japanese | 4.8        | 45               | 25.00            | 12:00    | 21:00     |
  | R004          | Night Bites   | Street   | 3.9        | 20               | 10.00            | 20:00    | 04:00     |
And no user session cart exists yet
```

### Scenario 1 — REQ1: Display all open restaurants with required metadata fields

```gherkin
# Covers: REQ1
Scenario: Display all open restaurants with required metadata fields
  Given the server UTC time is "14:00"
  When the user navigates to the homepage at "/"
  Then the system shall return HTTP 200 for GET "/api/v1/restaurants"
  And each restaurant entry in the UI shall display all of the following fields:
    | field             |
    | name              |
    | cuisine_category  |
    | avg_rating        |
    | est_delivery_min  |
    | delivery_fee_egp  |
    | open_closed_status|
  And the page shall render without a full page reload
```

### Scenario 2 — REQ1 + REQ19: Open restaurants are interactive; closed are differentiated

```gherkin
# Covers: REQ1, REQ19
Scenario: Open restaurants are interactive; closed restaurants are visually differentiated
  Given the server UTC time is "14:00"
  When the user navigates to the homepage
  Then "Burger Palace" shall be displayed as interactive with status "Open"
  And "Night Bites" shall be displayed in a greyed-out non-interactive state with label "Currently Closed"
  And the "Night Bites" card shall not be clickable
```

### Scenario 3 — REQ19: Server clock governs even when client clock is spoofed

```gherkin
# Covers: REQ19
Scenario: Closed restaurant is non-interactive even when client clock shows open time
  Given "Burger Palace" has operating hours 10:00-22:00 server UTC
  And the server UTC time is "03:00"
  And the user's browser system clock is set to "14:00" (spoofed client time)
  When the user navigates to the homepage
  Then the server shall evaluate restaurant availability using its own UTC clock
  And "Burger Palace" shall appear greyed-out with label "Currently Closed"
  And clicking the "Burger Palace" card shall produce no navigation event and no HTTP request
```

### Scenario 4 — REQ19: Boundary enforcement (Scenario Outline)

```gherkin
# Covers: REQ19
Scenario Outline: Browse-stage operating-hours gate enforced at exact UTC boundaries
  Given "Burger Palace" has operating hours 10:00-22:00 server UTC
  And the server UTC time is "<server_time>"
  When the user loads the restaurant catalog
  Then the "Burger Palace" card interactive state shall be "<interactive>"
  And the displayed status label shall read "<label>"

  Examples:
    | server_time | interactive | label            | description              |
    | 09:59       | false       | Currently Closed | 1 minute before opening  |
    | 10:00       | true        | Open             | Exact opening boundary   |
    | 21:59       | true        | Open             | Last valid minute         |
    | 22:00       | false       | Currently Closed | Exact closing boundary   |
    | 03:00       | false       | Currently Closed | Middle of the night      |
```

### Scenario 5 — REQ19: Cross-midnight restaurant open at 23:00 UTC

```gherkin
# Covers: REQ19
Scenario: Cross-midnight restaurant (Night Bites 20:00-04:00) is open at 23:00 UTC
  Given "Night Bites" has operating hours 20:00-04:00 server UTC
  And the server UTC time is "23:00"
  When the user loads the restaurant catalog
  Then "Night Bites" shall be displayed as interactive with status "Open"
```

### Scenario 6 — REQ19: Cross-midnight restaurant closed at 05:00 UTC

```gherkin
# Covers: REQ19
Scenario: Cross-midnight restaurant is closed at 05:00 UTC
  Given "Night Bites" has operating hours 20:00-04:00 server UTC
  And the server UTC time is "05:00"
  When the user loads the restaurant catalog
  Then "Night Bites" shall be displayed as greyed-out with label "Currently Closed"
```
