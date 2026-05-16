import { useState, useEffect, useCallback } from "react";
import { CartState } from "../context/CartContext";
import { useCartContext } from "../context/CartContext";
import { updateCartItemQuantity, removeCartItem } from "../services/cartService";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseCartReturn {
  cart: CartState | null;
  isLoading: boolean;
  error: Error | null;
  updateQuantity: (lineItemId: string, quantity: number) => Promise<unknown>;
  removeItem: (lineItemId: string) => Promise<unknown>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCart(): UseCartReturn {
  // Try to get context (available in integration tests via CartProvider)
  let contextCart: CartState | null = null;
  let setContextCart: ((cart: CartState | null) => void) | null = null;

  try {
    const ctx = useCartContext();
    contextCart = ctx.cart;
    setContextCart = ctx.setCart;
  } catch {
    // Outside provider — will fetch from API
  }

  const [fetchedCart, setFetchedCart] = useState<CartState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(contextCart === null);
  const [error, setError] = useState<Error | null>(null);

  // Use context cart if available, otherwise use fetched cart
  const cart = contextCart !== null ? contextCart : fetchedCart;

  useEffect(() => {
    // If we have a cart from context (initialCart provided), skip fetch
    if (contextCart !== null) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch("/api/v1/cart")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load cart");
        return res.json() as Promise<{ cart: CartState }>;
      })
      .then((data) => {
        if (!cancelled) {
          const cartData = data.cart;
          setFetchedCart(cartData);
          if (setContextCart) setContextCart(cartData);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateQuantity = useCallback(
    async (lineItemId: string, quantity: number): Promise<unknown> => {
      const result = await updateCartItemQuantity(lineItemId, quantity);

      // Optimistically update local cart state
      const currentCart = contextCart ?? fetchedCart;
      if (currentCart) {
        const updatedCart: CartState = {
          ...currentCart,
          items: currentCart.items.map((item) =>
            item.line_item_id === lineItemId
              ? {
                  ...item,
                  quantity,
                  line_total_egp: item.unit_price_egp * quantity,
                }
              : item
          ),
          subtotal_egp: currentCart.items.reduce(
            (sum, item) =>
              item.line_item_id === lineItemId
                ? sum + item.unit_price_egp * quantity
                : sum + item.line_total_egp,
            0
          ),
        };
        if (setContextCart) setContextCart(updatedCart);
        else setFetchedCart(updatedCart);
      }

      return result;
    },
    [contextCart, fetchedCart, setContextCart]
  );

  const removeItem = useCallback(
    async (lineItemId: string): Promise<unknown> => {
      const result = await removeCartItem(lineItemId);

      // Update cart state to remove the item
      const currentCart = contextCart ?? fetchedCart;
      if (currentCart) {
        const remainingItems = currentCart.items.filter(
          (item) => item.line_item_id !== lineItemId
        );
        const updatedCart: CartState = {
          ...currentCart,
          items: remainingItems,
          item_count: remainingItems.length,
          subtotal_egp: remainingItems.reduce(
            (sum, item) => sum + item.line_total_egp,
            0
          ),
          checkout_eligible:
            remainingItems.length > 0 &&
            remainingItems.every((item) => item.available),
          unavailable_items: currentCart.unavailable_items.filter(
            (id) =>
              !currentCart.items
                .filter((i) => i.line_item_id === lineItemId)
                .some((i) => i.item_id === id)
          ),
        };
        if (setContextCart) setContextCart(updatedCart);
        else setFetchedCart(updatedCart);
      }

      return result;
    },
    [contextCart, fetchedCart, setContextCart]
  );

  return { cart, isLoading, error, updateQuantity, removeItem };
}
