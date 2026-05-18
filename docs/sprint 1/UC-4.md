## UC-4: Manage Shopping Cart

**Priority Weight:** 13 | **Priority Tier:** High

### Covered Requirements

#### REQ4 — Manage Shopping Cart `PW: 4`
The system shall provide a dedicated cart interface where users can review all added items with their quantities and unit prices, update the quantity of an existing item, remove individual items, and view a dynamically recalculated subtotal. Changes must be reflected in real time without requiring a full page reload.

#### REQ15 — Stale-Cart Refresh at Checkout `PW: 5`
Immediately before rendering the final checkout confirmation screen, the system shall re-query the database for the current price and availability status of every item in the cart. Stale prices shall be silently updated to current values; unavailable items shall trigger REQ20. This operation must complete before the checkout total is displayed or the "Confirm Order" button is enabled.

#### REQ21 — Empty Cart Checkout Guard `PW: 4`
The system shall prevent a user from initiating the checkout flow when the cart contains zero line items. The "Proceed to Checkout" button shall be disabled whenever the cart item count is zero. A server-side pre-condition check shall independently verify |cart.items| ≥ 1 before any checkout processing begins, returning HTTP 400 with message "Cart is empty" if the condition is not met.

---