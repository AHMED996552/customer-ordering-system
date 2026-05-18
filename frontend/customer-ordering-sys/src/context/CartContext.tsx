import React, { createContext, useContext, useState, useCallback } from 'react';

export interface CartLineItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartContextValue {
  cartItems: CartLineItem[];
  addItem: (item: CartLineItem) => void;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartLineItem[]>([]);

  const addItem = useCallback((incoming: CartLineItem) => {
    setCartItems(prev => {
      const existing = prev.find(i => i.id === incoming.id);
      if (existing) {
        return prev.map(i =>
          i.id === incoming.id
            ? { ...i, quantity: i.quantity + incoming.quantity }
            : i,
        );
      }
      return [...prev, incoming];
    });
  }, []);

  const subtotal = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ cartItems, addItem, subtotal }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextValue => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
};
