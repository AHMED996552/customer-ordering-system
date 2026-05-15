# UC-2 — Explore Menu Details

## Overview

| Property | Value |
|---|---|
| Use Case | UC-2: Explore Menu Details |
| Requirements | REQ2, REQ19 |
| Actor | Authenticated or Guest User |
| Goal | View the full menu of a selected restaurant with item details to make an informed choice before adding items to cart |

---

## Requirements

### REQ2 — Unavailable Menu Item State

Any item with `available = false` must:
1. Render with `aria-disabled="true"` or `disabled=true` on the tile.
2. Have **no** active "Add to Cart" button.
3. Dispatch **zero** POST requests to `/api/v1/cart/items` regardless of any click event.

At the API layer, the server re-validates availability on every cart-add, returning HTTP 422 with `code: "ITEM_UNAVAILABLE"` if bypassed.

Additional display rules:
- Menu is organised by **category sections**.
- Each available item tile must display: `name`, `description`, `price_egp`, and `availability_state`.
- No item description shall exceed **200 characters** in the UI.

### REQ19 — Server-Time Operating-Hours Validation (Menu-View Checkpoint)

- When a GET request arrives at `/api/v1/restaurants/{id}/menu`, the server **independently re-captures** `server_utc_now()` — the `is_open` value from the catalog response is **not reused**.
- A request outside operating hours returns **HTTP 403** with `code: "RESTAURANT_CLOSED"` and `server_utc_time_at_request` in the body.
- Menu item list is **not included** in the 403 response.

**Boundary Table (REQ19 — Menu-View):**

| Server UTC | HTTP Status | Menu Returned | Description |
|---|---|---|---|
| 09:59 | 403 | false | 1 minute before opening |
| 10:00 | 200 | true | Exact opening boundary |
| 21:59 | 200 | true | Last valid minute |
| 22:00 | 403 | false | Exact closing boundary |
| 03:00 | 403 | false | Middle of the night |

---

## API Contract

### Endpoint

| Property | Value |
|---|---|
| Method & URL | `GET /api/v1/restaurants/{id}/menu` |
| Authentication | Not required (public endpoint) |
| Path Parameter | `id` — the restaurant identifier |

### Success Response — HTTP 200

```json
{
  "restaurant": {
    "restaurant_id": "R001",
    "name": "Burger Palace",
    "is_open": true
  },
  "menu": [
    {
      "category": "Burgers",
      "items": [
        {
          "item_id": "I001",
          "name": "Classic Burger",
          "description": "Beef patty, lettuce, tomato, house sauce.",
          "price_egp": 75.00,
          "available": true
        },
        {
          "item_id": "I003",
          "name": "Unavailable Special",
          "description": "Chef's secret recipe.",
          "price_egp": 50.00,
          "available": false
        }
      ]
    },
    {
      "category": "Sides",
      "items": [
        {
          "item_id": "I004",
          "name": "Loaded Fries",
          "description": "Fries with cheese and jalapenos.",
          "price_egp": 45.00,
          "available": true
        }
      ]
    }
  ],
  "server_utc_time_at_request": "2026-05-10T14:00:00Z"
}
```

### Error Response — HTTP 403 (REQ19: Restaurant Closed)

```json
{
  "error": {
    "code": "RESTAURANT_CLOSED",
    "message": "Burger Palace is currently closed and cannot accept orders.",
    "details": {
      "restaurant_id": "R001",
      "operating_hours_utc": {
        "open": "10:00",
        "close": "22:00"
      },
      "server_utc_time_at_request": "03:00"
    }
  }
}
```

### Error Response — HTTP 404 (Restaurant Not Found)

```json
{
  "error": {
    "code": "RESTAURANT_NOT_FOUND",
    "message": "No restaurant exists with the provided ID."
  }
}
```

### Information Hiding Rationale

| Hidden Concern | What the Client Sees |
|---|---|
| Operating-hours time comparison algorithm | HTTP 403 with `RESTAURANT_CLOSED` code |
| How `available: false` is set (stock system, admin toggle, etc.) | Only the boolean outcome |
| Price authority | `price_egp` here is display data; cart/checkout re-queries prices independently on every write |
| Category sort order | Server-determined; client renders in received order with no sorting logic |

---

## Gherkin Scenarios

### Background

```gherkin
Given the Customer Ordering System is running and reachable
And the server UTC time is within the operating window of "Burger Palace"
And the following menu items exist for "Burger Palace" (R001):
  | item_id | category | name                   | price_egp | available |
  | I001    | Burgers  | Classic Burger         | 75.00     | true      |
  | I002    | Burgers  | Crispy Chicken Sandwich| 85.00     | true      |
  | I003    | Specials | Unavailable Special    | 50.00     | false     |
  | I004    | Sides    | Loaded Fries           | 45.00     | true      |
```

### Scenario 1 — REQ2: Display full menu organised by category

```gherkin
# Covers: REQ2
Scenario: Display full menu organised by category with all required fields
  Given the user clicks on the "Burger Palace" restaurant card
  When the system calls GET "/api/v1/restaurants/R001/menu"
  Then the server shall respond with HTTP 200
  And the menu shall be organised by category sections: "Burgers" and "Sides"
  And each available item tile shall display: name, description, price_egp, and availability_state
  And no item description shall exceed 200 characters in the UI
```

### Scenario 2 — REQ2: Unavailable item is displayed but non-interactive

```gherkin
# Covers: REQ2
Scenario: Unavailable item is displayed but non-interactive
  Given the user is on the "Burger Palace" menu page
  When the page finishes rendering
  Then "Unavailable Special" (I003) shall be visible in its category section
  And the "Unavailable Special" tile shall be in a greyed-out non-interactive state
  And no click on the "Unavailable Special" tile shall dispatch a POST to "/api/v1/cart/items"
```

### Scenario 3 — REQ19: Menu endpoint returns HTTP 403 when restaurant is closed

```gherkin
# Covers: REQ19
Scenario: Menu endpoint returns HTTP 403 when restaurant is closed at server UTC time
  Given "Burger Palace" has operating hours 10:00-22:00 server UTC
  And the server UTC time is "03:00"
  And the user's browser system clock is set to "15:00" (spoofed client time)
  When the user requests GET "/api/v1/restaurants/R001/menu"
  Then the server shall evaluate operating hours using its own UTC clock exclusively
  And the server shall respond with HTTP 403 Forbidden
  And the response body shall contain:
    | field                      | value                        |
    | code                       | RESTAURANT_CLOSED            |
    | message                    | Burger Palace is currently closed |
    | server_utc_time_at_request | 03:00                        |
  And the menu item list shall not be included in the response
```

### Scenario 4 — REQ19: Menu-view boundary enforcement (Scenario Outline)

```gherkin
# Covers: REQ19
Scenario Outline: Menu-view operating-hours gate enforced at exact UTC boundaries
  Given "Burger Palace" has operating hours 10:00-22:00 server UTC
  When a GET to "/api/v1/restaurants/R001/menu" arrives at server UTC "<server_time>"
  Then the response status shall be <status>
  And menu items shall be returned only if <menu_returned> is true

  Examples:
    | server_time | status | menu_returned | description              |
    | 09:59       | 403    | false         | 1 minute before opening  |
    | 10:00       | 200    | true          | Exact opening boundary   |
    | 21:59       | 200    | true          | Last valid minute         |
    | 22:00       | 403    | false         | Exact closing boundary   |
    | 03:00       | 403    | false         | Middle of the night      |
```
