import React from 'react';
import { CartItem, recalculateTotal } from '../utils/checkout.utils';
import {LockIcon} from 'lucide-react';

interface OrderSummaryProps {
  cartItems: CartItem[];
  isSubmitting: boolean;
  onConfirm: () => void;
  isDisabled: boolean;
}

const OrderSummary: React.FC<OrderSummaryProps> = ({
  cartItems,
  isSubmitting,
  onConfirm,
  isDisabled,
}) => {
  const subtotal = recalculateTotal(cartItems);
  const fee = 45.0; // Fixed fee for demo
  const total = subtotal + fee;

  return (
    <div className="lg:col-span-5 space-y-lg sticky top-base">
      <div className="glass-card rounded-xl p-lg space-y-md shadow-xl">
        <h2 className="font-headline-md text-headline-md text-on-surface">Order Summary</h2>
        <div className="space-y-md">
          {cartItems.map((item) => (
            <div key={item.id} className="flex gap-md items-center group">
              <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container">
                <img
                  src="/assets/item1.jpg"
                  alt={item.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-label-caps text-on-surface truncate">{item.name}</p>
                    <p className="font-body-md text-on-surface-variant text-sm">Qty: {item.qty}</p>
                    <p className="font-label-caps text-primary mt-1">
                      ${(item.price * item.qty).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <hr className="border-outline-variant/20" />
        <div className="space-y-sm">
          <div className="flex justify-between font-body-md">
            <span className="text-on-surface-variant">Subtotal</span>
            <span className="text-on-surface">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-body-md">
            <span className="text-on-surface-variant">Connoisseur Fee</span>
            <span className="text-on-surface">${fee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-headline-md text-2xl pt-md">
            <span className="text-on-surface">Total</span>
            <span className="text-primary">${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="pt-lg">
        <button
          data-testid="confirm-order-btn"
          disabled={isSubmitting}
          onClick={onConfirm}
          aria-busy={isSubmitting}

          className="w-full py-md rounded-full font-label-caps text-lg bg-primary text-on-primary hover:bg-primary/90 shadow-md hover:scale-[1.02] active:scale-95 transition-all duration-300 flex items-center justify-center gap-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          <LockIcon className="w-5" />
          {isSubmitting ? 'Processing…' : 'Confirm Secure Payment'}
        </button>
        <p className="text-center text-[10px] font-label-caps text-on-surface-variant/60 mt-md flex items-center justify-center gap-xs uppercase tracking-widest">
          <span className="material-symbols-outlined text-[12px]">verified_user</span>
          256-bit Encrypted SSL Security
        </p>
      </div>
    </div>
  );
};

export default OrderSummary;
