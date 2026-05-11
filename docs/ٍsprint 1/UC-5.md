## UC-5: Secure Checkout & Payment

**Priority Weight:** 27 | **Priority Tier:** Highest

### Covered Requirements

#### REQ7 — Secure Checkout & Payment `PW: 5`
The system shall process the checkout flow by (1) re-validating cart contents and server-recalculating the total (REQ17), (2) presenting the confirmed total to the user, (3) submitting a payment request to the Payment Gateway, and (4) creating a confirmed order record in the database only upon receiving a payment success callback. The flow must be idempotent (REQ16) and server-time-gated (REQ19).

#### REQ16 — Idempotent Order Submission Guard `PW: 5`
The "Confirm Order" button shall be disabled synchronously on the first click event — before the HTTP request is dispatched — and shall remain in a disabled, loading state until a terminal server response (success, failure, or timeout) is received and processed. Under no circumstances shall a second POST request be dispatched from a single user-initiated click session.

#### REQ17 — Server-Side Price Recalculation `PW: 5`
The backend server shall independently recalculate the complete cart total from the database-authoritative price of each item at the time of the checkout request. Any price value supplied by the client in the request body shall be silently discarded and never used as an input to the charge computation. This is a non-optional security invariant enforced on every checkout request regardless of origin.

#### REQ18 — DoS-Prevention Character Limits `PW: 3`
All free-text input fields (e.g., "Special Instructions", "Delivery Notes") shall enforce a maximum character limit of 500 characters. Enforcement shall occur at both the UI layer (maxlength attribute) and the server-side input validation layer (returning HTTP 422 if the field length exceeds the limit). This constraint applies to all text inputs that are stored, logged, or transmitted to downstream services.

#### REQ19 — Server-Time Operating-Hours Validation `PW: 5`
The system shall evaluate restaurant operating-hours eligibility exclusively using the server's UTC clock. This validation must be applied at three checkpoints: (1) restaurant listing (browsing), (2) menu item display, and (3) checkout initiation. Requests that arrive outside a restaurant's defined operating window at checkpoint (3) shall be rejected with HTTP 403 and a user-facing message stating the restaurant is closed.

#### REQ20 — Unavailable Item Notification at Checkout `PW: 4`
If the pre-checkout cart refresh (REQ15) identifies one or more items with an availability = false status, the system shall halt the checkout process, display an explicit, named notification for each unavailable item (e.g., "Crispy Chicken Sandwich is no longer available"), and block the "Confirm Order" button until the user resolves the conflict by removing the affected item(s).

---