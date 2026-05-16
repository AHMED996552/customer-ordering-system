import React from 'react';
import { Trash, Plus, Minus } from "lucide-react";

interface CartItemProps {
  item: any;
  updateQuantity: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
}

export const CartItem: React.FC<CartItemProps> = ({ item, updateQuantity, removeItem }) => {
  return (
    <div
      data-testid={`cart-item-${item.line_item_id}`}
      className={`glass-island p-md rounded-2xl flex flex-col sm:flex-row gap-md items-center transition-all duration-300 ${!item.available ? "opacity-50 grayscale unavailable" : ""
        }`}
    >
      <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden shrink-0 bg-surface-container flex items-center justify-center text-3xl">
        <img src={item.image || "assets/item1.jpg"} alt={item.name} className="w-full h-full object-cover" />
      </div>

      <div className="flex-grow space-y-1 text-center sm:text-left">
        <h3 className="text-lg font-bold">{item.name}</h3>
        {!item.available && (
          <span className="text-error text-[10px] uppercase font-bold tracking-tighter">
            Currently Unavailable
          </span>
        )}
        <div className="flex items-center justify-center sm:justify-start gap-sm mt-3">
          <span className="badge badge-tertiary">Premium Choice</span>
          {item.price_updated && (
            <span
              className="badge bg-amber-500/20 text-amber-500"
              data-testid={`price-updated-badge-${item.item_id}`}
            >
              Price Updated
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center sm:items-end gap-md shrink-0 min-w-[140px]">
        <div className="flex items-center bg-white/5 rounded-lg p-1 border border-white/5 gap-2">
          <button
            onClick={() => updateQuantity(item.line_item_id, Math.max(1, item.quantity - 1))}
            className="p-1 hover:bg-white/10 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={item.quantity <= 1}
            aria-label="Decrease quantity"
          >
            <Minus size={16} />
          </button>
          <span className="w-8 text-center font-bold text-lg text-on-surface" data-testid={`quantity-${item.line_item_id}`}>
            {item.quantity}
          </span>
          <button
            onClick={() => updateQuantity(item.line_item_id, item.quantity + 1)}
            className="p-1 hover:bg-white/10 rounded-md transition-colors"
            aria-label="Increase quantity"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="flex flex-col items-center sm:items-end">
          {item.quantity > 1 && (
            <span className="text-on-surface-variant text-[11px]">
              {item.unit_price_egp.toFixed(2)} / unit
            </span>
          )}
          <span className="text-xl font-bold text-primary">
            {item.line_total_egp.toFixed(2)} EGP
          </span>
        </div>

        <button
          onClick={() => removeItem(item.line_item_id)}
          aria-label="Remove selection"
          className="text-on-surface-variant hover:text-error transition-colors text-[11px] font-bold uppercase tracking-wider"
        >
          <Trash size={18} />
        </button>
      </div>
    </div>
  );
};
