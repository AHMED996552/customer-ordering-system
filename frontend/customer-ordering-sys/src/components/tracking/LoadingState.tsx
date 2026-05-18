/**
 * src/components/tracking/LoadingState.tsx
 * UC-9 — Loading indicator (accessible)
 */
import React from 'react';

export default function LoadingState() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center" data-testid="order-tracking-stub">
      <div
        role="status"
        aria-label="Loading order details"
        aria-live="polite"
        className="flex flex-col items-center gap-6"
      >
        {/* Pulsing ring spinner */}
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="material-symbols-outlined text-primary text-2xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              local_shipping
            </span>
          </div>
        </div>
        <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
          Loading your order…
        </p>
      </div>
    </div>
  );
}
