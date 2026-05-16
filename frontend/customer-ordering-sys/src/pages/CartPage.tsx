import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../hooks/useCart";
import { prepareCheckout } from "../services/cartService";
import { useNotification } from "../context/NotificationContext";
import { useCartContext } from "../context/CartContext";
import { CartHeader } from "../components/CartHeader";
import { CartItem } from "../components/CartItem";
import { CartSummary } from "../components/CartSummary";

export const CartPage: React.FC = () => {
  const { cart, isLoading, error, updateQuantity, removeItem } = useCart();
  const { notify } = useNotification();
  const { setCart, isPreparing, setIsPreparing } = useCartContext();
  const navigate = useNavigate();
  const [prepError, setPrepError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="cart-loading">
        <div className="text-primary font-headline animate-pulse text-2xl" role="status">
          Refining Selection...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-error font-headline text-2xl text-center">
          Failed to load collection.
        </div>
      </div>
    );
  }

  const handleProceed = async () => {
    if (!cart || cart.items.length === 0 || isPreparing) return;
    setIsPreparing(true);
    setPrepError(null);
    try {
      const refreshedCart = await prepareCheckout();
      setCart(refreshedCart);

      if (!refreshedCart.checkout_eligible) {
        refreshedCart.items.forEach((item: any) => {
          if (!item.available) {
            notify(`${item.name} is no longer available`);
          }
        });
        setIsPreparing(false);
      } else {
        setIsPreparing(false);
        navigate("/checkout");
      }
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("failed to fetch")) {
        setPrepError("Network error. Please try again.");
      } else {
        setPrepError("Something went wrong. Please try again.");
      }
      setIsPreparing(false);
    }
  };

  const isEmpty = !cart || cart.items.length === 0;

  return (
    <div className="flex flex-col gap-lg animate-in" data-testid="cart-container">
      <CartHeader />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-lg items-start">
        <div className="flex flex-col gap-md">
          {isEmpty ? (
            <div className="glass-island p-xl text-center rounded-2xl">
              <h3 className="text-xl font-bold">Your cart is empty</h3>
              <p className="text-on-surface-variant mt-2 text-sm">Refine your palate and add some exquisite dishes.</p>
            </div>
          ) : (
            cart.items.map((item: any) => (
              <CartItem 
                key={item.line_item_id} 
                item={item} 
                updateQuantity={updateQuantity} 
                removeItem={removeItem} 
              />
            ))
          )}

          {prepError && (
            <div role="alert" className="p-md bg-error-container/20 border border-error/30 rounded-xl text-error text-center text-sm font-bold">
              {prepError}
            </div>
          )}
        </div>

        <CartSummary 
          cart={cart} 
          isPreparing={isPreparing} 
          isEmpty={isEmpty} 
          handleProceed={handleProceed} 
        />
      </div>
    </div>
  );
};
