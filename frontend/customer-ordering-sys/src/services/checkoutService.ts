import { CartState } from "../context/CartContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlaceOrderArgs {
  cart: CartState;
  [key: string]: unknown;
}

interface PlaceOrderResult {
  status: number;
  error?: string;
  order_id?: string;
}

// ─── checkoutService ──────────────────────────────────────────────────────────

export const checkoutService = {
  placeOrder: async (args: PlaceOrderArgs): Promise<PlaceOrderResult> => {
    const { cart, ...rest } = args;

    const payload = {
      cart_id: cart.cart_id,
      items: cart.items.map((item) => ({
        item_id: item.item_id,
        line_item_id: item.line_item_id,
        name: item.name,
        quantity: item.quantity,
        unit_price_egp: item.unit_price_egp,
        line_total_egp: item.line_total_egp,
      })),
      subtotal_egp: cart.subtotal_egp,
      restaurant_id: cart.restaurant_id,
      ...rest,
    };

    try {
      const response = await fetch("/api/v1/orders/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({})) as Record<string, unknown>;

      if (!response.ok) {
        return {
          status: response.status,
          error: (data.error as string) ?? `Order placement failed`,
        };
      }

      return {
        status: response.status,
        order_id: data.order_id as string | undefined,
      };
    } catch (err) {
      return {
        status: 0,
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  },
};
