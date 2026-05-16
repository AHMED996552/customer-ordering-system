import { rest } from "msw";
import { CartState } from "../context/CartContext";

// ─── Shared Mock Data ─────────────────────────────────────────────────────────

const cartWithItems: CartState = {
  cart_id: "cart_abc123",
  restaurant_id: "R001",
  restaurant_name: "Burger Palace",
  items: [
    {
      line_item_id: "L001",
      item_id: "I001",
      name: "Classic Burger",
      quantity: 2,
      unit_price_egp: 75.0,
      line_total_egp: 150.0,
      available: true,
      price_updated: false,
    },
    {
      line_item_id: "L002",
      item_id: "I002",
      name: "Crispy Chicken Sandwich",
      quantity: 1,
      unit_price_egp: 85.0,
      line_total_egp: 85.0,
      available: true,
      price_updated: false,
    },
  ],
  subtotal_egp: 235.0,
  item_count: 2,
  checkout_eligible: true,
  unavailable_items: [],
};

const refreshedPricesCart: CartState = {
  ...cartWithItems,
  items: [
    {
      ...cartWithItems.items[0],
      unit_price_egp: 90.0,
      line_total_egp: 180.0,
      price_updated: true,
    },
    {
      ...cartWithItems.items[1],
      unit_price_egp: 85.0,
      line_total_egp: 85.0,
      available: true,
      price_updated: false,
    },
  ],
  subtotal_egp: 265.0,
  item_count: 2,
  checkout_eligible: true,
};

// ─── Handlers ─────────────────────────────────────────────────────────────────

export const handlers = [
  rest.get("/api/v1/cart", (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(cartWithItems));
  }),

  rest.post("/api/v1/cart/checkout/prepare", (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(refreshedPricesCart));
  }),

  rest.patch("/api/v1/cart/items/:lineItemId", (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ success: true }));
  }),

  rest.delete("/api/v1/cart/items/:lineItemId", (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ success: true }));
  }),
];
