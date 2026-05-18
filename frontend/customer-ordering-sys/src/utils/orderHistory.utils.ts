// ============================================================
// src/utils/orderHistory.utils.ts
// Pure formatting utilities for the Order History feature (UC-8).
// All functions are deterministic and timezone-agnostic (UTC).
// ============================================================

/** Supported formatting modes for order dates. */
export type DateFormat = 'short' | 'full';

/** Return type for getStatusColor. */
export interface StatusStyles {
  bg: string;
  text: string;
  border: string;
}

// ------------------------------------------------------------------
// formatOrderDate
// ------------------------------------------------------------------
/**
 * Converts an ISO-8601 UTC timestamp into a UI-ready date string.
 *
 * - `'short'` → `"OCT 05"` (month abbreviation + zero-padded day, uppercase)
 * - `'full'`  → `"Oct 12, 2023 • 8:45 PM"` (human-readable with time)
 *
 * Returns `"Invalid Date"` for unparseable inputs.
 */
export function formatOrderDate(isoString: string, format: DateFormat): string {
  const date = new Date(isoString);

  // Guard: Date.parse returns NaN for invalid strings, but new Date('invalid')
  // returns a Date whose getTime() is NaN.
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  if (format === 'short') {
    // e.g. "OCT 05"
    const month = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${month} ${day}`;
  }

  // format === 'full'  →  "Oct 12, 2023 • 8:45 PM"
  const datePart = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }); // "Oct 12, 2023"

  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }); // "8:45 PM"

  return `${datePart} • ${timePart}`;
}

// ------------------------------------------------------------------
// formatCurrency
// ------------------------------------------------------------------
/**
 * Formats a numeric amount as a dollar-prefixed string with exactly
 * two decimal places.  e.g. 312 → "$312.00", 1234.5 → "$1234.50"
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// ------------------------------------------------------------------
// getStatusColor
// ------------------------------------------------------------------
/**
 * Maps an order status string to the Tailwind CSS colour utility classes
 * defined in the LuxeEats design system.
 *
 * Returns a `{ bg, text, border }` object so callers can compose
 * class strings freely without hard-coding status logic in JSX.
 */
export function getStatusColor(status: string): StatusStyles {
  switch (status.toUpperCase()) {
    case 'DELIVERED':
      return {
        bg: 'bg-green-500/10',
        text: 'text-green-400',
        border: 'border-green-500/20',
      };
    case 'CANCELLED':
      return {
        bg: 'bg-error/10',
        text: 'text-error',
        border: 'border-error/20',
      };
    case 'PENDING':
      return {
        bg: 'bg-primary/10',
        text: 'text-primary',
        border: 'border-primary/20',
      };
    default:
      return {
        bg: 'bg-surface-variant',
        text: 'text-on-surface-variant',
        border: 'border-outline-variant',
      };
  }
}
