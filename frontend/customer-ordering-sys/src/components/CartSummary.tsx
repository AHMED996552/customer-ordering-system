import React from 'react';

interface CartSummaryProps {
  cart: any;
  isPreparing: boolean;
  isEmpty: boolean;
  handleProceed: () => void;
}

export const CartSummary: React.FC<CartSummaryProps> = ({ cart, isPreparing, isEmpty, handleProceed }) => {
  return (
    <aside className="lg:sticky lg:top-24">
      <div className="glass-island p-lg rounded-[24px] border-primary/20">
        <h3 className="text-xl font-bold border-b border-white/10 pb-md">Summary</h3>

        <div className="mt-lg space-y-md">
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Subtotal</span>
            <span className="font-bold" data-testid="cart-subtotal">{(cart?.subtotal_egp || 0).toFixed(2)} EGP</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Logistics</span>
            <span className="text-primary font-bold">Complimentary</span>
          </div>
        </div>

        <div className="mt-xl pt-lg border-t border-white/10">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">Estimated Total</span>
            <span className="text-4xl font-bold text-primary mt-1">
              {(cart?.subtotal_egp || 0).toFixed(2)}
            </span>
          </div>
        </div>

        <button
          onClick={handleProceed}
          disabled={isPreparing || isEmpty || !cart?.checkout_eligible}
          className="shimmer-btn w-full py-md rounded-xl mt-lg font-bold text-lg shadow-xl active:scale-95"
        >
          {isPreparing ? "Preparing..." : "Proceed to Checkout"}
        </button>

        <div className="mt-md flex items-center justify-center gap-xs text-[10px] text-on-surface-variant/40 uppercase tracking-widest">
          <span className="material-symbols-outlined text-sm">verified</span>
          Authentic Gourmet Assurance
        </div>
      </div>
    </aside>
  );
};
