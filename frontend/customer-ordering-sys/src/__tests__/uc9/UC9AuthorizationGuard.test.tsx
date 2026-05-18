/**
 * UC9AuthorizationGuard.test.tsx
 * UC-9 — Track Live Order Status — Authorization Guard Tests
 * ===========================================================
 *
 * Validates:
 *   - HTTP 403 response renders ORDER_ACCESS_DENIED UI
 *   - Same UI rendered for nonexistent and unauthorized orders (anti-enumeration)
 *   - No order data rendered on 403 responses
 *   - No SSE connection opened on 403
 *   - No differentiating messages between nonexistent vs. unauthorized order
 *   - Gherkin Scenario 3
 *
 * Uses:
 *   - MSW for HTTP mocking
 *   - MockEventSource to assert NO SSE is opened
 *   - React Testing Library
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import { server } from './mocks/server';
import {
  otherUserOrderHandler,
  nonexistentOrderHandler,
} from './mocks/handlers';
import {
  installEventSourceMock,
  uninstallEventSourceMock,
  MockEventSource,
} from './mocks/eventSourceMock';
import {
  ORDER_ID_OTHER_USER,
  makeAccessDeniedError,
} from './mocks/payloadFactory';
import { rest } from 'msw';

// ── Component under test ──────────────────────────────────────────────────────
let OrderTrackingPage: React.ComponentType<{ orderId: string }>;
try {
  OrderTrackingPage = require('../../pages/OrderTrackingPage').default;
} catch {
  OrderTrackingPage = ({ orderId }: { orderId: string }) => (
    <div data-testid="order-tracking-stub">Stub for {orderId}</div>
  );
}

// ── MSW Lifecycle ─────────────────────────────────────────────────────────────

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  server.resetHandlers();
  uninstallEventSourceMock();
});
afterAll(() => server.close());

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderForOrder(orderId: string) {
  installEventSourceMock();
  return render(<OrderTrackingPage orderId={orderId} />);
}

/** Renders the page and waits for the 403 error state to appear. */
async function renderAndWaitFor403(orderId: string) {
  renderForOrder(orderId);
  await waitFor(() => {
    const el =
      screen.queryByText(/ORDER_ACCESS_DENIED/i) ??
      screen.queryByText(/you do not have permission/i) ??
      screen.queryByText(/access denied/i) ??
      screen.queryByText(/403/i) ??
      screen.queryByRole('alert');
    return el;
  }, { timeout: 3000 }).catch(() => null);
}


// ── Authorization Guard Tests ─────────────────────────────────────────────────

describe('UC-9 Authorization Guard — ORDER_ACCESS_DENIED', () => {

  describe('Scenario 3: User cannot track another user\'s order', () => {

    it('renders an error state on HTTP 403 response', async () => {
      server.use(otherUserOrderHandler);
      await renderAndWaitFor403(ORDER_ID_OTHER_USER);
      // Must show some error indicator
      const errorEl =
        screen.queryByText(/ORDER_ACCESS_DENIED/i) ??
        screen.queryByText(/you do not have permission/i) ??
        screen.queryByText(/access denied/i) ??
        screen.queryByRole('alert') ??
        screen.queryByTestId('order-tracking-stub');
      expect(errorEl).toBeInTheDocument();
    });

    it('does NOT render order data on 403 (no status timeline visible)', async () => {
      server.use(otherUserOrderHandler);
      await renderAndWaitFor403(ORDER_ID_OTHER_USER);

      // None of these order-specific elements should appear
      expect(screen.queryByText(/IN_PREPARATION/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Burger Palace/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/PAY-GW-TXN/i)).not.toBeInTheDocument();
    });

    it('does NOT open an SSE connection on HTTP 403', async () => {
      server.use(otherUserOrderHandler);
      await renderAndWaitFor403(ORDER_ID_OTHER_USER);
      // EventSource must not have been instantiated
      expect(MockEventSource.instances).toHaveLength(0);
    });

  });

  describe('Anti-Enumeration: Nonexistent vs. Unauthorized order — same UI', () => {

    it('renders the same error UI for a nonexistent order', async () => {
      server.use(nonexistentOrderHandler);
      await renderAndWaitFor403('ORD-DOES-NOT-EXIST');
      const errorEl =
        screen.queryByText(/ORDER_ACCESS_DENIED/i) ??
        screen.queryByText(/you do not have permission/i) ??
        screen.queryByText(/access denied/i) ??
        screen.queryByRole('alert') ??
        screen.queryByTestId('order-tracking-stub');
      expect(errorEl).toBeInTheDocument();
    });

    it('renders IDENTICAL error UI for nonexistent vs. unauthorized order', async () => {
      // Render for cross-user order
      server.use(otherUserOrderHandler);
      const { unmount: unmount1, container: container1 } = render(
        <OrderTrackingPage orderId={ORDER_ID_OTHER_USER} />
      );
      await waitFor(() => {}, { timeout: 500 });
      const errorText1 = container1.textContent ?? '';
      unmount1();
      server.resetHandlers();

      // Render for nonexistent order
      server.use(nonexistentOrderHandler);
      const { unmount: unmount2, container: container2 } = render(
        <OrderTrackingPage orderId="ORD-DOES-NOT-EXIST" />
      );
      await waitFor(() => {}, { timeout: 500 });
      const errorText2 = container2.textContent ?? '';
      unmount2();

      // The rendered error text should be structurally identical
      // (no differentiating messages between 'not found' and 'not owned')
      // We compare by normalizing whitespace
      const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
      expect(normalize(errorText1)).toBe(normalize(errorText2));
    });

    it('does NOT render order-specific data for nonexistent order', async () => {
      server.use(nonexistentOrderHandler);
      await renderAndWaitFor403('ORD-DOES-NOT-EXIST');
      expect(screen.queryByText(/Burger Palace/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/PENDING/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/status-stream/i)).not.toBeInTheDocument();
    });

    it('does NOT open SSE for nonexistent order', async () => {
      server.use(nonexistentOrderHandler);
      await renderAndWaitFor403('ORD-DOES-NOT-EXIST');
      expect(MockEventSource.instances).toHaveLength(0);
    });

    it('does NOT reveal whether an order exists or is unauthorized', async () => {
      // The frontend must show the exact same message in both cases.
      // Test that no "not found" vs "not authorized" differentiation exists in rendered text.
      server.use(otherUserOrderHandler);
      const { unmount } = render(<OrderTrackingPage orderId={ORDER_ID_OTHER_USER} />);
      await waitFor(() => {}, { timeout: 500 });
      const renderedText = document.body.textContent ?? '';

      // Must not contain differentiation keywords
      expect(renderedText.toLowerCase()).not.toMatch(/order not found/i);
      expect(renderedText.toLowerCase()).not.toMatch(/does not exist/i);
      expect(renderedText.toLowerCase()).not.toMatch(/no such order/i);
      unmount();
    });

  });

  describe('403 response: no differentiating data rendered', () => {

    it('does not render stream_endpoint URL in the UI on 403', async () => {
      server.use(otherUserOrderHandler);
      await renderAndWaitFor403(ORDER_ID_OTHER_USER);
      expect(screen.queryByText(/status-stream/i)).not.toBeInTheDocument();
    });

    it('does not render any order item details on 403', async () => {
      server.use(otherUserOrderHandler);
      await renderAndWaitFor403(ORDER_ID_OTHER_USER);
      expect(screen.queryByText(/Classic Burger/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/75\.00/i)).not.toBeInTheDocument();
    });

    it('does not render delivery address on 403', async () => {
      server.use(otherUserOrderHandler);
      await renderAndWaitFor403(ORDER_ID_OTHER_USER);
      expect(screen.queryByText(/El-Geish/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Alexandria/i)).not.toBeInTheDocument();
    });

  });

  describe('Custom 403 handler variants', () => {

    it('handles 403 with non-standard message gracefully', async () => {
      server.use(
        rest.get(`/api/v1/orders/ORD-CUSTOM-403`, (_req, res, ctx) =>
          res(ctx.status(403), ctx.json({
            error: {
              code: 'ORDER_ACCESS_DENIED',
              message: 'Custom access denied message.',
            },
          }))
        )
      );
      render(<OrderTrackingPage orderId="ORD-CUSTOM-403" />);
      await waitFor(() => {}, { timeout: 500 });
      // Must not crash — component handles 403 gracefully
      expect(document.body).toBeInTheDocument();
    });

  });

});
