import React, { createContext, useContext, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartItem {
  line_item_id: string;
  item_id: string;
  name: string;
  quantity: number;
  unit_price_egp: number;
  line_total_egp: number;
  available: boolean;
  price_updated?: boolean;
}

export interface CartState {
  cart_id: string;
  restaurant_id: string | null;
  restaurant_name: string | null;
  items: CartItem[];
  subtotal_egp: number;
  item_count: number;
  checkout_eligible: boolean;
  unavailable_items: string[];
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface CartContextValue {
  cart: CartState | null;
  setCart: (cart: CartState | null) => void;
  isPreparing: boolean;
  setIsPreparing: (loading: boolean) => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface CartProviderProps {
  initialCart: CartState | null;
  children: React.ReactNode;
}

export function CartProvider({ initialCart, children }: CartProviderProps) {
  const [cart, setCartState] = useState<CartState | null>(initialCart);
  const [isPreparing, setIsPreparing] = useState(false);

  const setCart = useCallback((newCart: CartState | null) => {
    setCartState(newCart);
  }, []);

  return (
    <CartContext.Provider value={{ cart, setCart, isPreparing, setIsPreparing }}>
      {children}
    </CartContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCartContext(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    // Return a NOOP version for tests that don't use providers
    return {
      cart: null,
      setCart: () => {},
      isPreparing: false,
      setIsPreparing: () => {},
    };
  }
  return ctx;
}
