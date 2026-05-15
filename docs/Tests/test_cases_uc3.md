# UC-3: Add Item to Cart - Test Cases Document

**Project:** Customer Ordering System (CSE323)
**Requirements Covered:** REQ3, REQ12, REQ13, REQ14, REQ20, REQ21

---

## 1. Test Case Matrix

| Test ID | Req ID | Layer (UI/API) | Test Scenario / Description | Pre-conditions | Input Data / Action | Expected Result (UI State & HTTP Status) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-01** | REQ3 | API | Successfully add a valid available item | Cart is empty or has R001 items | `item_id: "I001"`, `quantity: 2` | **HTTP 200 OK**. Cart updates successfully, subtotal updates. |
| **TC-02** | REQ12 | UI | Immediate guard for zero quantity | User is on menu page | Enter `0` in quantity field | "Add to Cart" button is **Disabled**. Message: "Quantity must be at least 1". |
| **TC-03** | REQ12 | API | Server-side rejection of negative quantity | Active session | Send POST with `quantity: -5` | **HTTP 422 Unprocessable Entity**. Error Code: `VALIDATION_ERROR`. |
| **TC-04** | REQ13 | UI | Prevention of decimal input characters | User is on menu page | Attempt to type `0.5` or `.` | Field blocks the decimal character. Button remains disabled. |
| **TC-05** | REQ13 | API | Server-side rejection of fractional/NaN | Active session | Send POST with `quantity: 1.5` or `NaN` | **HTTP 422 Unprocessable Entity**. Error Code: `VALIDATION_ERROR`. |
| **TC-06** | REQ14 | UI | Cross-restaurant conflict detection | Cart has item from R001 | Click "Add" for item from R002 | **Conflict Modal** appears asking to clear cart. No API call sent yet. |
| **TC-07** | REQ14 | API | Server-side enforcement of restaurant consistency | Cart has item from R001 | Send POST with R002 item | **HTTP 409 Conflict**. Error Code: `CROSS_RESTAURANT_CONFLICT`. |
| **TC-08** | REQ20 | UI | Visual guard for unavailable items | Item `I003` is unavailable | View item `I003` | Item is **Greyed-out**. "Add to Cart" is non-interactive. |
| **TC-09** | REQ20 | API | Server-side guard for unavailable items | Active session | Send POST for item `I003` | **HTTP 422 Unprocessable Entity**. Error Code: `ITEM_UNAVAILABLE`. |
| **TC-10** | REQ21 | UI | Empty cart checkout prevention | Cart is completely empty | Navigate to Cart Page | "Proceed to Checkout" button is **Disabled**. Message: "Your cart is empty." |
| **TC-11** | REQ21 | API | Server-side empty cart checkout guard | Cart is completely empty | Send POST to `/api/v1/checkout` | **HTTP 400 Bad Request**. Error Code: `EMPTY_CART_CHECKOUT` / "Cart is empty". |

---

## 2. Test Execution Notes
* **Base URL:** `/api/v1` for all API calls.
* **Authentication:** Assumes a valid `session_id` in HTTP-only cookies.
* **Validation Errors:** Must return the standard error envelope with the `fields` object populated explaining the exact issue.