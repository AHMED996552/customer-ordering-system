Use Case 1.1: Feature 1 — Add Item to Cart (UC-3)Priority Weight: 26 | Priority Tier: HighestCourse: CSE323 — Software Engineering | Spring 2026Institution: Egypt-Japan University of Science and Technology (E-JUST)1. Requirements SpecificationsREQ3 — Add Item to Cart PW: 5The system shall allow an authenticated or guest user to select a menu item, specify a valid quantity (positive integer), and add it to their active session cart. The system shall enforce all cart integrity constraints (REQ14) at the moment of addition.REQ12 — Negative Quantity Guard PW: 5The system shall immediately reject any attempt to set an item quantity to zero or any negative integer.UI Layer: Disable the "Add to Cart" submit button immediately if the quantity ≤ 0.Server-side: Return HTTP 422 Unprocessable Entity with a descriptive error message.REQ13 — Fractional Quantity Guard PW: 4The system shall reject any quantity input that is not a positive integer (e.g., 0.5, 2.3, or NaN).UI Layer: Input field shall block decimal points and non-numeric characters.Server-side: Return HTTP 422 with message: "Quantity must be a whole number."REQ14 — Cross-Restaurant Cart Guard PW: 4When adding an item from Restaurant B while the cart contains items from Restaurant A, the system shall present a conflict modal. The user must explicitly confirm ("Yes, clear cart and add") before the previous cart items are discarded and the new item is added.REQ20 — Unavailable Item Notification PW: 4If an item’s availability status is false, the system shall:Display the item tile in a greyed-out, non-interactive state.Block the "Add to Cart" action at the API level (Return HTTP 422 ITEM_UNAVAILABLE).REQ21 — Empty Cart Checkout Guard PW: 4The "Proceed to Checkout" button shall be disabled if the cart count is zero. The server shall independently verify that the cart is not empty before processing checkout, otherwise returning HTTP 400.2. API Contract & ConventionsGlobal API ConventionsConventionValueBase URL/api/v1Content-Typeapplication/jsonAuthenticationHTTP-only session cookie (session_id)Monetary ValuesNumbers with exactly 2 decimal places in EGP (e.g., 75.00)TimestampsISO 8601 UTC strings: "2026-05-10T14:32:00Z"Endpoint: Add Item to CartMethod & URL: POST /api/v1/cart/itemsRequest Payload{
  "item_id": "string", // Required. Must reference an existing menu item.
  "quantity": "integer" // Required. Strict positive integer >= 1.
}
Success Response (HTTP 200 OK){
  "cart": {
    "cart_id": "cart_abc123",
    "restaurant_id": "R001",
    "restaurant_name": "BurgerPalace",
    "items": [
      {
        "line_item_id": "L001",
        "item_id": "I001",
        "name": "Classic Burger",
        "quantity": 2,
        "unit_price_egp": 75.00,
        "line_total_egp": 150.00
      }
    ],
    "subtotal_egp": 150.00,
    "item_count": 1
  }
}
Error Responses (Standard Envelope)409 Conflict (CROSS_RESTAURANT_CONFLICT): Triggered when adding items from a different restaurant (REQ14).422 Unprocessable Entity (VALIDATION_ERROR): Triggered by REQ12/REQ13 (Invalid quantity).422 Unprocessable Entity (ITEM_UNAVAILABLE): Triggered by REQ20 when the item is out of stock.400 Bad Request (EMPTY_CART): Triggered by REQ21 if checkout is attempted on an empty cart.3. Information Hiding RationalePricing Authority: The client never sends price data. The server fetches the unit_price_egp from the database. This makes it structurally impossible for a client to submit a fraudulent price.Cross-Restaurant Logic: The internal algorithm for detecting restaurant mismatches is hidden. The client simply receives a 409 status and reacts by showing the UI modal.Database Schema: The API response reveals computed totals and abstract IDs (line_item_id), hiding the actual table structures and storage mechanisms from the frontend.Availability Mechanism: The client has no knowledge of why an item is unavailable (e.g., stock levels vs. time windows); it only receives the final outcome (ITEM_UNAVAILABLE).4. Standard Error EnvelopeAll non-2xx responses follow this uniform structure:{
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human-readable description of the error.",
    "fields": {
      "field_name": "Specific detail (present only for validation errors)"
    }
  }
}
