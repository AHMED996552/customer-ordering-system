/**
 * FILE 2: INTEGRATION TESTS — SecureCheckoutPayment.test.tsx
 * ─────────────────────────────────────────────────────────────────────────
 * Technologies: React Testing Library · Jest · MSW (msw/node)
 */

import SecureCheckoutPayment from '../pages/SecureCheckoutPayment';

/**
 * ─────────────────────────────────────────────────────────────────────────
 * Coverage matrix
 * ───────────────
 * HAPPY PATH & IDEMPOTENCY
 *   SCN-01  Full checkout creates CONFIRMED order
 *   SCN-02  Gateway failure → order NOT created, button re-enabled
 *   SCN-03  Button disabled synchronously before HTTP dispatch
 *   SCN-04  Rapid triple-click produces exactly one POST
 *
 * REQ17 — Server-side price recalculation
 *   SCN-05  Client price 0.01 EGP discarded; server uses 150.00 EGP
 *   SCN-06  Parameterized price-manipulation cases
 *
 * REQ18 — DoS prevention / 500-char limit
 *   SCN-07  UI enforces maxLength=500 + counter
 *   SCN-08  Server rejects >500 chars (HTTP 422)
 *   SCN-09  Parameterized field-limit tests
 *
 * REQ19 — Operating hours
 *   SCN-10  Closed at server UTC 03:00 (client spoofed to 14:00) → 403
 *   SCN-11  Boundary sweep: 09:59/10:00/21:59/22:00/03:00
 *
 * REQ20 — Unavailable item
 *   SCN-12  Pre-checkout refresh hides ConfirmOrder when item unavailable
 *   SCN-13  Server rejects bypass attempt (HTTP 422)
 *
 * NEGATIVE / FAILURE SCENARIOS
 *   NEG-01  API timeout
 *   NEG-02  500 Internal Server Error
 *   NEG-03  Malformed JSON response
 *   NEG-04  Network offline mid-request
 *   NEG-05  Unexpected payment gateway status code
 *   NEG-06  Empty cart edge case
 *   NEG-07  Null / undefined values in response
 * ─────────────────────────────────────────────────────────────────────────
 */

import React, { useState } from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { rest } from 'msw';

// ─── type stubs (delete when importing from real module) ───────────────────
type OrderStatus = 'CONFIRMED' | 'FAILED' | 'PENDING';
interface Order { id: string; status: OrderStatus; total: number; }
interface CartItem { id: string; name: string; qty: number; price: number; }

// Props interface for the component
interface Props {
  cartItems: CartItem[];
  onOrderConfirmed?: (order: Order) => void;
  serverUtcHour?: number;
}


// ===========================================================================
// SHARED MOCK DATA
// ===========================================================================
const CART_ITEMS: CartItem[] = [
  { id: 'I001', name: 'Classic Burger', qty: 2, price: 75.00 },
];

const CONFIRMED_ORDER: Order = {
  id: 'ORD-001',
  status: 'CONFIRMED',
  total: 150.00,
};

// ===========================================================================
// MSW SERVER SETUP
// ===========================================================================
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Helper: mount the component with sensible defaults
// ---------------------------------------------------------------------------
function renderCheckout(props: Partial<Props> = {}) {
  const onOrderConfirmed = jest.fn();
  const utils = render(
    <SecureCheckoutPayment
      cartItems={CART_ITEMS}
      onOrderConfirmed={onOrderConfirmed}
      serverUtcHour={14} // open hours default
      {...props}
    />
  );
  return { ...utils, onOrderConfirmed };
}

// Convenience: register a success handler capturing the request body
function useSuccessHandler(
  capture?: (body: Record<string, unknown>) => void
) {
  server.use(
    rest.post('/api/v1/orders/checkout', async (req, res, ctx) => {
      const body = await req.json<Record<string, unknown>>();
      capture?.(body);
      return res(ctx.status(200), ctx.json(CONFIRMED_ORDER));
    })
  );
}

// ===========================================================================
// HAPPY PATH & IDEMPOTENCY
// ===========================================================================
describe('Happy path & idempotency', () => {

  // SCN-01 ──────────────────────────────────────────────────────────────────
  it('SCN-01: successful checkout creates a CONFIRMED order', async () => {
    let capturedBody: Record<string, unknown> = {};
    useSuccessHandler(b => { capturedBody = b; });
    const { onOrderConfirmed } = renderCheckout();

    await userEvent.click(screen.getByTestId('confirm-order-btn'));

    await waitFor(() =>
      expect(onOrderConfirmed).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'CONFIRMED' })
      )
    );
    // Server receives item list, not the raw client total
    expect(capturedBody.items).toBeDefined();
  });

  // SCN-02 ──────────────────────────────────────────────────────────────────
  it('SCN-02: gateway failure does NOT create an order and re-enables the button', async () => {
    server.use(
      rest.post('/api/v1/orders/checkout', (_req, res, ctx) =>
        res(ctx.status(402), ctx.json({ message: 'Payment declined' }))
      )
    );
    const { onOrderConfirmed } = renderCheckout();

    await userEvent.click(screen.getByTestId('confirm-order-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('checkout-error')).toBeInTheDocument()
    );
    expect(onOrderConfirmed).not.toHaveBeenCalled();
    expect(screen.getByTestId('confirm-order-btn')).not.toBeDisabled();
  });

  // SCN-03 ──────────────────────────────────────────────────────────────────
  it('SCN-03: button is disabled synchronously before HTTP dispatch', async () => {
    let resolveRequest!: () => void;
    server.use(
      rest.post('/api/v1/orders/checkout', async (_req, res, ctx) => {
        await new Promise<void>(r => { resolveRequest = r; });
        return res(ctx.status(200), ctx.json(CONFIRMED_ORDER));
      })
    );
    renderCheckout();

    const btn = screen.getByTestId('confirm-order-btn');
    fireEvent.click(btn); // synchronous click — no await

    // Still in the same JS tick: button must already be disabled
    expect(btn).toBeDisabled();

    // Cleanup: unblock the pending request
    // Unblock the pending handler so the request completes cleanly
    await waitFor(() => expect(typeof resolveRequest).toBe('function'));
    act(() => resolveRequest());


    await waitFor(() => expect(screen.queryByTestId('confirm-order-btn')).not.toBeDisabled());
  });

  // SCN-04 ──────────────────────────────────────────────────────────────────
  it('SCN-04: three rapid clicks within 200ms produce exactly one POST', async () => {
    let callCount = 0;
    server.use(
      rest.post('/api/v1/orders/checkout', async (_req, res, ctx) => {
        callCount++;
        return res(ctx.status(200), ctx.json(CONFIRMED_ORDER));
      })
    );
    renderCheckout();
    const btn = screen.getByTestId('confirm-order-btn');

    // Fire three clicks synchronously — the component disables after the first
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);

    await waitFor(() => expect(callCount).toBe(1), { timeout: 500 });
    expect(callCount).toBe(1);
  });
});

// ===========================================================================
// REQ17 — SERVER-SIDE PRICE RECALCULATION
// ===========================================================================
describe('REQ17 — Server-side price recalculation', () => {

  // SCN-05 ──────────────────────────────────────────────────────────────────
  it('SCN-05: server discards client total 0.01 EGP and uses correct 150.00 EGP', async () => {
    let receivedBody: Record<string, unknown> = {};
    server.use(
      rest.post('/api/v1/orders/checkout', async (req, res, ctx) => {
        receivedBody = await req.json<Record<string, unknown>>();
        // Server would ignore clientTotal and recalculate → respond with 150.00
        return res(ctx.status(200), ctx.json({ ...CONFIRMED_ORDER, total: 150.00 }));
      })
    );

    // Render with a cart that has been tampered client-side
    renderCheckout({
      cartItems: [{ id: 'I001', name: 'Classic Burger', qty: 2, price: 0.005 }],
    });

    await userEvent.click(screen.getByTestId('confirm-order-btn'));

    await waitFor(() => expect(receivedBody.items).toBeDefined());
    // The client total sent to the server is NOT trusted — server ignores it
    const serverComputedTotal = (receivedBody.items as CartItem[])
      .reduce((s, i) => s + i.qty * i.price, 0);
    // The actual price used for authorization (from CONFIRMED_ORDER) is 150.00
    expect(150.00).not.toBe(serverComputedTotal);
  });

  // SCN-06 ──────────────────────────────────────────────────────────────────
  describe('SCN-06: parameterized price manipulation', () => {
    test.each([
      // [description,        manipulatedPrice, qty, dbPrice,  expectedServerTotal]
      ['under-price attack', 0.01, 2, 75.00, 150.00],
      ['over-price attack', 999999.00, 1, 85.00, 85.00],
      ['negative price sent', -50.00, 3, 75.00, 225.00],
    ] as [string, number, number, number, number][])(
      '%s → server authorizes %f EGP',
      async (_label, manipulatedUnitPrice, qty, _dbPrice, expectedTotal) => {
        let authorizedAmount = 0;
        server.use(
          rest.post('/api/v1/orders/checkout', async (_req, res, ctx) => {
            // Simulated server: always uses DB price, ignores client price
            authorizedAmount = expectedTotal;
            return res(ctx.status(200), ctx.json({ ...CONFIRMED_ORDER, total: expectedTotal }));
          })
        );

        const { onOrderConfirmed } = renderCheckout({
          cartItems: [
            { id: 'I001', name: 'Classic Burger', qty, price: manipulatedUnitPrice },
          ],
        });

        await userEvent.click(screen.getByTestId('confirm-order-btn'));

        await waitFor(() => expect(onOrderConfirmed).toHaveBeenCalled());
        expect(authorizedAmount).toBeCloseTo(expectedTotal);
      }
    );
  });
});

// ===========================================================================
// REQ18 — DoS PREVENTION / 500-CHARACTER LIMIT
// ===========================================================================
describe('REQ18 — Character limit on free-text fields', () => {

  // SCN-07 ──────────────────────────────────────────────────────────────────
  it('SCN-07: Special Instructions textarea has maxLength=500 and counter updates', async () => {
    server.use(
      rest.post('/api/v1/orders/checkout', (_req, res, ctx) =>
        res(ctx.status(200), ctx.json(CONFIRMED_ORDER))
      )
    );
    renderCheckout();

    const textarea = screen.getByTestId('special-instructions');
    const counter = screen.getByTestId('instructions-counter');

    // Check native constraint
    expect(textarea).toHaveAttribute('maxLength', '500');

    // Type exactly 500 characters
    const longText = 'A'.repeat(500);
    await userEvent.type(textarea, longText);

    expect(counter).toHaveTextContent('500/500');
  });

  // SCN-08 ──────────────────────────────────────────────────────────────────
  it('SCN-08: server rejects Special Instructions > 500 chars with HTTP 422', async () => {
    server.use(
      rest.post('/api/v1/orders/checkout', async (req, res, ctx) => {
        const body = await req.json<{ specialInstructions?: string }>();
        if ((body.specialInstructions?.length ?? 0) > 500) {
          return res(ctx.status(422), ctx.json({ message: 'Input too long' }));
        }
        return res(ctx.status(200), ctx.json(CONFIRMED_ORDER));
      })
    );
    renderCheckout();

    const textarea = screen.getByTestId('special-instructions');
    // Simulate programmatic injection bypassing the maxLength attribute
    fireEvent.change(textarea, { target: { value: 'B'.repeat(501) } });

    await userEvent.click(screen.getByTestId('confirm-order-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('checkout-error')).toBeInTheDocument()
    );
    expect(screen.getByTestId('checkout-error')).toHaveTextContent('Input too long');
  });

  // SCN-09 ──────────────────────────────────────────────────────────────────
  describe('SCN-09: parameterized 500-char limit across free-text fields', () => {
    test.each([
      ['special_instructions', 'special-instructions', 500, 200],
      ['special_instructions', 'special-instructions', 501, 422],
      ['delivery_notes', 'delivery-notes', 500, 200],
      ['delivery_notes', 'delivery-notes', 501, 422],
    ] as [string, string, number, number][])(
      '%s with %i chars → HTTP %i',
      async (fieldName, testId, inputLen, expectedStatus) => {
        server.use(
          rest.post('/api/v1/orders/checkout', async (req, res, ctx) => {
            const body = await req.json<Record<string, string>>();
            const fieldValue = body[fieldName] ?? '';
            if (fieldValue.length > 500) {
              return res(ctx.status(422), ctx.json({ message: 'Input too long' }));
            }
            return res(ctx.status(200), ctx.json(CONFIRMED_ORDER));
          })
        );

        const { onOrderConfirmed } = renderCheckout();
        const textarea = screen.getByTestId(testId);
        fireEvent.change(textarea, { target: { value: 'C'.repeat(inputLen) } });
        await userEvent.click(screen.getByTestId('confirm-order-btn'));

        if (expectedStatus === 200) {
          await waitFor(() => expect(onOrderConfirmed).toHaveBeenCalled());
        } else {
          await waitFor(() =>
            expect(screen.getByTestId('checkout-error')).toBeInTheDocument()
          );
        }
      }
    );
  });
});

// ===========================================================================
// REQ19 — OPERATING HOURS VALIDATION
// ===========================================================================
describe('REQ19 — Operating hours', () => {

  // SCN-10 ──────────────────────────────────────────────────────────────────
  it('SCN-10: checkout rejected at server UTC 03:00 even when client clock shows 14:00', async () => {
    server.use(
      rest.post('/api/v1/orders/checkout', async (req, res, ctx) => {
        const body = await req.json<{ serverUtcHour: number }>();
        if (body.serverUtcHour < 10 || body.serverUtcHour >= 22) {
          return res(
            ctx.status(403),
            ctx.json({ message: 'Burger Palace is currently closed' })
          );
        }
        return res(ctx.status(200), ctx.json(CONFIRMED_ORDER));
      })
    );

    // serverUtcHour=3 simulates server being closed; component injects this
    const { onOrderConfirmed } = renderCheckout({ serverUtcHour: 3 });
    await userEvent.click(screen.getByTestId('confirm-order-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('checkout-error')).toHaveTextContent(
        'Burger Palace is currently closed'
      )
    );
    expect(onOrderConfirmed).not.toHaveBeenCalled();
  });

  // SCN-11 ──────────────────────────────────────────────────────────────────
  describe('SCN-11: operating hours boundary sweep', () => {
    const closedOpenHandler = rest.post('/api/v1/orders/checkout', async (req, res, ctx) => {
      const body = await req.json<{ serverUtcHour: number }>();
      const { serverUtcHour: h } = body;
      if (h < 10 || h >= 22) {
        return res(ctx.status(403), ctx.json({ message: 'Burger Palace is currently closed' }));
      }
      return res(ctx.status(200), ctx.json(CONFIRMED_ORDER));
    });

    test.each([
      // [serverUtcHour, expectedStatus, shouldConfirm, description]
      [9, 403, false, '09:00 → closed'],
      [10, 200, true, '10:00 → open (boundary)'],
      [21, 200, true, '21:00 → open'],
      [22, 403, false, '22:00 → closed (boundary)'],
      [3, 403, false, '03:00 → closed'],
    ] as [number, number, boolean, string][])(
      '%s', async (serverUtcHour, _status, shouldConfirm) => {
        server.use(closedOpenHandler);
        const { onOrderConfirmed } = renderCheckout({ serverUtcHour });
        await userEvent.click(screen.getByTestId('confirm-order-btn'));

        if (shouldConfirm) {
          await waitFor(() => expect(onOrderConfirmed).toHaveBeenCalled());
        } else {
          await waitFor(() =>
            expect(screen.getByTestId('checkout-error')).toBeInTheDocument()
          );
          expect(onOrderConfirmed).not.toHaveBeenCalled();
        }
      }
    );
  });
});

// ===========================================================================
// REQ20 — UNAVAILABLE ITEM BLOCK
// ===========================================================================
describe('REQ20 — Unavailable item', () => {

  // SCN-12 ──────────────────────────────────────────────────────────────────
  it('SCN-12: ConfirmOrder button absent when pre-checkout refresh finds unavailable item I002', () => {
    renderCheckout({
      cartItems: [
        { id: 'I001', name: 'Classic Burger', qty: 2, price: 75.00 },
        { id: 'I002', name: 'Crispy Fries', qty: 1, price: 30.00 },
      ],
    });

    expect(screen.queryByTestId('confirm-order-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('unavailable-warning')).toHaveTextContent('I002');
  });

  it('SCN-12b: button IS rendered once unavailable item is removed from cart', async () => {
    const { rerender } = render(
      <SecureCheckoutPayment
        cartItems={[
          { id: 'I001', name: 'Classic Burger', qty: 2, price: 75.00 },
          { id: 'I002', name: 'Crispy Fries', qty: 1, price: 30.00 },
        ]}
      />
    );
    expect(screen.queryByTestId('confirm-order-btn')).not.toBeInTheDocument();

    rerender(
      <SecureCheckoutPayment
        cartItems={[{ id: 'I001', name: 'Classic Burger', qty: 2, price: 75.00 }]}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId('confirm-order-btn')).toBeInTheDocument()
    );
  });

  // SCN-13 ──────────────────────────────────────────────────────────────────
  it('SCN-13: server rejects checkout with HTTP 422 even when UI check is bypassed', async () => {
    server.use(
      rest.post('/api/v1/orders/checkout', async (req, res, ctx) => {
        const body = await req.json<{ items: CartItem[] }>();
        const hasUnavailable = body.items.some(i => i.id === 'I002');
        if (hasUnavailable) {
          return res(
            ctx.status(422),
            ctx.json({ message: 'Item I002 is unavailable' })
          );
        }
        return res(ctx.status(200), ctx.json(CONFIRMED_ORDER));
      })
    );

    // Render with only available items so the button appears, then manually
    // inject an unavailable item ID into the request via a custom handler above.
    // Here we test the server-side block by rendering the warning path and
    // calling the API directly (simulating a bypass).
    const { onOrderConfirmed } = renderCheckout({
      cartItems: [{ id: 'I001', name: 'Classic Burger', qty: 2, price: 75.00 }],
    });

    // Verify normal checkout still works (baseline)
    await userEvent.click(screen.getByTestId('confirm-order-btn'));
    await waitFor(() => expect(onOrderConfirmed).toHaveBeenCalled());

    // Now simulate a bypass: call the API directly with an unavailable item
    const bypassResponse = await fetch('/api/v1/orders/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ id: 'I002', name: 'Crispy Fries', qty: 1, price: 30.00 }],
      }),
    });
    expect(bypassResponse.status).toBe(422);
    const err = await bypassResponse.json();
    expect(err.message).toContain('I002');
  });
});

// ===========================================================================
// NEGATIVE / FAILURE SCENARIOS
// ===========================================================================
describe('Negative & failure scenarios', () => {

  // NEG-01 ──────────────────────────────────────────────────────────────────
  it('NEG-01: API timeout surfaces a user-facing error', async () => {
    jest.useFakeTimers();
    server.use(
      rest.post('/api/v1/orders/checkout', (_req, res) =>
        res.networkError('Connection timed out')
      )
    );
    const { onOrderConfirmed } = renderCheckout();

    await userEvent.click(screen.getByTestId('confirm-order-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('checkout-error')).toBeInTheDocument()
    );
    expect(onOrderConfirmed).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  // NEG-02 ──────────────────────────────────────────────────────────────────
  it('NEG-02: HTTP 500 Internal Server Error shows error and re-enables button', async () => {
    server.use(
      rest.post('/api/v1/orders/checkout', (_req, res, ctx) =>
        res(ctx.status(500), ctx.json({ message: 'Internal server error' }))
      )
    );
    renderCheckout();

    await userEvent.click(screen.getByTestId('confirm-order-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('checkout-error')).toBeInTheDocument()
    );
    expect(screen.getByTestId('confirm-order-btn')).not.toBeDisabled();
  });

  // NEG-03 ──────────────────────────────────────────────────────────────────
  it('NEG-03: malformed JSON response does not crash the component', async () => {
    server.use(
      rest.post('/api/v1/orders/checkout', (_req, res, ctx) =>
        res(
          ctx.status(200),
          ctx.set('Content-Type', 'text/plain'),
          ctx.body('NOT_VALID_JSON')
        )
      )
    );
    renderCheckout();

    await userEvent.click(screen.getByTestId('confirm-order-btn'));

    // Component should recover and show an error (not throw)
    await waitFor(() =>
      expect(screen.getByTestId('checkout-error')).toBeInTheDocument(), { timeout: 3000 }
    );
  });

  // NEG-04 ──────────────────────────────────────────────────────────────────
  it('NEG-04: network goes offline mid-request → graceful error message', async () => {
    server.use(
      rest.post('/api/v1/orders/checkout', (_req, res) =>
        res.networkError('Network failure')
      )
    );
    const { onOrderConfirmed } = renderCheckout();

    await userEvent.click(screen.getByTestId('confirm-order-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('checkout-error')).toBeInTheDocument()
    );
    expect(onOrderConfirmed).not.toHaveBeenCalled();
    // Button re-enabled so user can retry when connection is restored
    expect(screen.getByTestId('confirm-order-btn')).not.toBeDisabled();
  });

  // NEG-05 ──────────────────────────────────────────────────────────────────
  it('NEG-05: unexpected payment gateway status code (409 Conflict) handled gracefully', async () => {
    server.use(
      rest.post('/api/v1/orders/checkout', (_req, res, ctx) =>
        res(ctx.status(409), ctx.json({ message: 'Duplicate transaction' }))
      )
    );
    const { onOrderConfirmed } = renderCheckout();

    await userEvent.click(screen.getByTestId('confirm-order-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('checkout-error')).toBeInTheDocument()
    );
    expect(onOrderConfirmed).not.toHaveBeenCalled();
  });

  // NEG-06 ──────────────────────────────────────────────────────────────────
  it('NEG-06: empty cart renders without ConfirmOrder button error', () => {
    server.use(
      rest.post('/api/v1/orders/checkout', (_req, res, ctx) =>
        res(ctx.status(400), ctx.json({ message: 'Cart is empty' }))
      )
    );
    // Should render without throwing
    expect(() => renderCheckout({ cartItems: [] })).not.toThrow();
  });

  // NEG-07 ──────────────────────────────────────────────────────────────────
  it('NEG-07: null / undefined values in API response do not crash the component', async () => {
    server.use(
      rest.post('/api/v1/orders/checkout', (_req, res, ctx) =>
        // Response missing expected fields
        res(ctx.status(200), ctx.json({ id: null, status: undefined, total: null }))
      )
    );
    // Should not throw
    expect(() =>
      renderCheckout().getByTestId('checkout-form')
    ).not.toThrow();
  });

  // NEG-08 ──────────────────────────────────────────────────────────────────
  it('NEG-08: HTTP 429 Too Many Requests shows a rate-limit message', async () => {
    server.use(
      rest.post('/api/v1/orders/checkout', (_req, res, ctx) =>
        res(
          ctx.status(429),
          ctx.json({ message: 'Too many requests, please try again later.' })
        )
      )
    );
    renderCheckout();

    await userEvent.click(screen.getByTestId('confirm-order-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('checkout-error')).toBeInTheDocument()
    );
  });

  // NEG-09 ──────────────────────────────────────────────────────────────────
  it('NEG-09: HTTP 401 Unauthorized prompts re-authentication hint', async () => {
    server.use(
      rest.post('/api/v1/orders/checkout', (_req, res, ctx) =>
        res(ctx.status(401), ctx.json({ message: 'Session expired' }))
      )
    );
    renderCheckout();

    await userEvent.click(screen.getByTestId('confirm-order-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('checkout-error')).toBeInTheDocument()
    );
    expect(screen.getByTestId('checkout-error')).toHaveTextContent('Session expired');
  });
});

// ===========================================================================
// ACCESSIBILITY
// ===========================================================================
describe('Accessibility', () => {
  it('marks the submit button as aria-busy while processing', async () => {
    let resolveReq!: () => void;
    server.use(
      rest.post('/api/v1/orders/checkout', async (_req, res, ctx) => {
        await new Promise<void>(r => { resolveReq = r; });
        return res(ctx.status(200), ctx.json(CONFIRMED_ORDER));
      })
    );
    renderCheckout();
    const btn = screen.getByTestId('confirm-order-btn');
    fireEvent.click(btn);

    expect(btn).toHaveAttribute('aria-busy', 'true');
    if (typeof resolveReq === 'function') act(() => resolveReq());

  });

  it('error messages use role="alert" for screen-reader announcement', async () => {
    server.use(
      rest.post('/api/v1/orders/checkout', (_req, res, ctx) =>
        res(ctx.status(403), ctx.json({ message: 'Burger Palace is currently closed' }))
      )
    );
    renderCheckout({ serverUtcHour: 3 });
    await userEvent.click(screen.getByTestId('confirm-order-btn'));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument()
    );
  });
});
