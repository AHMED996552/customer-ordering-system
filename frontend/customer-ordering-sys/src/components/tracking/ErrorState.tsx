/**
 * src/components/tracking/ErrorState.tsx
 * UC-9 — Error/Access Denied state
 *
 * SECURITY: This component renders an IDENTICAL error message for:
 *   - Nonexistent orders (HTTP 403)
 *   - Orders belonging to another user (HTTP 403)
 *
 * This prevents order ID enumeration attacks.
 *
 * CRITICAL: Must NOT say "order not found", "does not exist", "no such order".
 * Must render role="alert" for accessibility.
 * Must render ORDER_ACCESS_DENIED code for test detection.
 */
import React from 'react';

interface ErrorStateProps {
  code: string;
  status?: number;
}

export default function ErrorState({ code }: ErrorStateProps) {
  const isAccessDenied = code === 'ORDER_ACCESS_DENIED';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-gutter">
      <div
        role="alert"
        aria-live="assertive"
        className="glass-card rounded-3xl p-lg max-w-md w-full text-center"
      >
        {/* Icon */}
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-error-container mx-auto mb-md">
          <span
            className="material-symbols-outlined text-error text-3xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
            aria-hidden="true"
          >
            lock
          </span>
        </div>

        {/* Title */}
        <h1 className="font-headline-md text-headline-md text-on-surface mb-sm">
          Access Denied
        </h1>

        {/* Message — identical for both nonexistent and unauthorized orders */}
        <p className="font-body-md text-body-md text-on-surface-variant mb-md">
          You do not have permission to access this order.
        </p>

        {/* Error code — rendered for test identification */}
        <p
          className="font-label-caps text-label-caps text-on-surface-variant/50"
          data-testid="error-code"
        >
          {isAccessDenied ? 'ORDER_ACCESS_DENIED' : code}
        </p>

        {/* Divider */}
        <div className="h-px bg-outline-variant/20 w-full my-md" />

        {/* Back to safety */}
        <a
          href="/"
          className="shimmer-btn inline-flex items-center gap-sm bg-primary text-on-primary font-label-caps text-label-caps px-md py-sm rounded-2xl hover:opacity-90 transition-opacity"
          aria-label="Return to home page"
        >
          <span
            className="material-symbols-outlined text-[18px]"
            aria-hidden="true"
          >
            arrow_back
          </span>
          Return Home
        </a>
      </div>
    </div>
  );
}
