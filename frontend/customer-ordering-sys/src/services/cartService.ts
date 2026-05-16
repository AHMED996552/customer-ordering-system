import { CartState } from "../context/CartContext";

// ─── Update Cart Item Quantity ────────────────────────────────────────────────

export async function updateCartItemQuantity(
  lineItemId: string,
  quantity: number
): Promise<unknown> {
  const response = await fetch(`/api/v1/cart/items/${lineItemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? `Failed to update item quantity`);
  }

  return response.json();
}

// ─── Remove Cart Item ─────────────────────────────────────────────────────────

export async function removeCartItem(lineItemId: string): Promise<unknown> {
  const response = await fetch(`/api/v1/cart/items/${lineItemId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? `Failed to remove cart item`);
  }

  return response.json();
}

// ─── Prepare Checkout ─────────────────────────────────────────────────────────

export async function prepareCheckout(): Promise<CartState> {
  const response = await fetch("/api/v1/cart/checkout/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? `Checkout preparation failed`);
  }

  const data = await response.json() as { cart: CartState };
  return data.cart;
}
