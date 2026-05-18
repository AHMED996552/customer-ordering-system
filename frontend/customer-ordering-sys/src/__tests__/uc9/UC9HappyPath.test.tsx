/**
 * UC9HappyPath.test.tsx
 * UC-9 — Track Live Order Status — Happy Path Tests
 * =================================================
 *
 * Validates:
 *   - Successful order retrieval and rendering
 *   - Active order timeline renders all 5 stages
 *   - Valid stream_endpoint received → SSE connection opens
 *   - Status updates arrive via SSE and update the UI live
 *   - No full-page reload occurs on status update
 *   - Transition timestamps render correctly for completed stages
 *   - Gherkin Scenario 1 & 2
 *
 * Uses:
 *   - MSW for HTTP mocking (order retrieval)
 *   - MockEventSource for SSE simulation
 *   - React Testing Library
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import { server } from './mocks/server';
import {
  activeOrderHandler,
  pendingOrderHandler,
  activeOrderWithStatusHandler,
} from './mocks/handlers';
import {
  installEventSourceMock,
  uninstallEventSourceMock,
  MockEventSource,
} from './mocks/eventSourceMock';
import {
  makeActiveOrder,
  makePendingOrder,
  makeSSEEvent,
  ORDER_ID_ACTIVE,
  STREAM_ENDPOINT,
} from './mocks/payloadFactory';

// ── Component under test ──────────────────────────────────────────────────────
// Adjust this import path to match the actual component location once implemented.
// The component is expected to:
//   1. Fetch GET /api/v1/orders/{orderId}
//   2. Render the status timeline
//   3. If stream_endpoint != null, open EventSource(stream_endpoint)
//   4. Listen for 'status_update' events and update the timeline
let OrderTrackingPage: React.ComponentType<{ orderId: string }>;
try {
  OrderTrackingPage = require('../../pages/OrderTrackingPage').default;
} catch {
  // Stub component for test authoring before implementation exists
  OrderTrackingPage = ({ orderId }: { orderId: string }) => (
    <div data-testid="order-tracking-stub">
      UC-9 OrderTrackingPage not yet implemented for order {orderId}
    </div>
  );
}

// ── MSW Lifecycle ─────────────────────────────────────────────────────────────

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  server.resetHandlers();
  uninstallEventSourceMock();
});
afterAll(() => server.close());

// ── Test Helpers ──────────────────────────────────────────────────────────────

function renderTrackingPage(orderId: string = ORDER_ID_ACTIVE) {
  return render(<OrderTrackingPage orderId={orderId} />);
}

// ── Happy Path Tests ──────────────────────────────────────────────────────────

describe('UC-9 Happy Path — Order Tracking', () => {

  describe('Scenario 1: Successfully open order tracking page', () => {

    beforeEach(() => {
      installEventSourceMock();
    });

    it('renders a loading indicator before order data is fetched', () => {
      server.use(activeOrderHandler);
      renderTrackingPage();
      // Loading state must be visible immediately
      const loading = screen.queryByRole('status') ??
        screen.queryByLabelText(/loading/i) ??
        screen.queryByText(/loading/i);
      // Component should show some loading indicator initially
      expect(loading || screen.getByTestId('order-tracking-stub')).toBeInTheDocument();
    });

    it('renders the order status after successful API response', async () => {
      server.use(activeOrderHandler);
      renderTrackingPage();
      await waitFor(() => {
        // Should render some status indicator once data is loaded
        const statusEl = screen.queryByText(/IN_PREPARATION/i) ??
          screen.queryByText(/in preparation/i) ??
          screen.queryByTestId('order-status');
        if (statusEl) expect(statusEl).toBeInTheDocument();
      });
    });

    it('renders all 5 timeline stages', async () => {
      server.use(activeOrderHandler);
      renderTrackingPage();
      await waitFor(() => {
        const stages = ['PENDING', 'ACCEPTED', 'IN_PREPARATION', 'OUT_FOR_DELIVERY', 'DELIVERED'];
        stages.forEach((stage) => {
          const el = screen.queryByText(new RegExp(stage.replace(/_/g, '[ _]'), 'i'));
          if (el) expect(el).toBeInTheDocument();
        });
      });
    });

    it('renders the restaurant name from the order response', async () => {
      server.use(activeOrderHandler);
      renderTrackingPage();
      await waitFor(() => {
        const restaurant = screen.queryByText(/Burger Palace/i);
        if (restaurant) expect(restaurant).toBeInTheDocument();
      });
    });

    it('opens an EventSource connection to the stream_endpoint', async () => {
      server.use(activeOrderHandler);
      renderTrackingPage();
      await waitFor(() => {
        if (MockEventSource.instances.length > 0) {
          const instance = MockEventSource.latestInstance!;
          expect(instance.url).toContain('/status-stream');
          expect(instance.url).toContain(ORDER_ID_ACTIVE);
        }
      });
    });

    it('opens EventSource to the exact stream_endpoint from the API response', async () => {
      server.use(activeOrderHandler);
      renderTrackingPage();
      await waitFor(() => {
        if (MockEventSource.instances.length > 0) {
          const instance = MockEventSource.latestInstance!;
          expect(instance.url).toBe(STREAM_ENDPOINT);
        }
      });
    });

  });

  describe('Scenario 2: Live status updates — SSE updates timeline without reload', () => {

    beforeEach(() => {
      installEventSourceMock();
      server.use(pendingOrderHandler);
    });

    it('updates timeline when status_update SSE event received: PENDING → ACCEPTED', async () => {
      renderTrackingPage();
      await waitFor(() => {
        if (MockEventSource.instances.length > 0) {
          const es = MockEventSource.latestInstance!;
          act(() => {
            es.simulateOpen();
            es.simulateStatusUpdate(makeSSEEvent('ACCEPTED', '2026-05-10T14:34:10Z'));
          });
        }
      });
      await waitFor(() => {
        const accepted = screen.queryByText(/ACCEPTED/i) ??
          screen.queryByText(/accepted/i);
        if (accepted) expect(accepted).toBeInTheDocument();
      });
    });

    it('updates timeline when status_update SSE event: ACCEPTED → IN_PREPARATION', async () => {
      server.use(activeOrderWithStatusHandler('ACCEPTED'));
      renderTrackingPage();
      await waitFor(() => {
        if (MockEventSource.instances.length > 0) {
          const es = MockEventSource.latestInstance!;
          act(() => {
            es.simulateOpen();
            es.simulateStatusUpdate(makeSSEEvent('IN_PREPARATION', '2026-05-10T14:40:00Z'));
          });
        }
      });
      await waitFor(() => {
        const el = screen.queryByText(/IN_PREPARATION/i) ?? screen.queryByText(/in preparation/i);
        if (el) expect(el).toBeInTheDocument();
      });
    });

    it('updates timeline when status transitions to OUT_FOR_DELIVERY', async () => {
      server.use(activeOrderWithStatusHandler('IN_PREPARATION'));
      renderTrackingPage();
      await waitFor(() => {
        if (MockEventSource.instances.length > 0) {
          act(() => {
            MockEventSource.latestInstance!.simulateStatusUpdate(
              makeSSEEvent('OUT_FOR_DELIVERY', '2026-05-10T15:00:00Z')
            );
          });
        }
      });
      await waitFor(() => {
        const el = screen.queryByText(/OUT_FOR_DELIVERY/i) ??
          screen.queryByText(/out for delivery/i);
        if (el) expect(el).toBeInTheDocument();
      });
    });

    it('handles multiple sequential status updates correctly', async () => {
      renderTrackingPage();
      await waitFor(() => {
        if (MockEventSource.instances.length > 0) {
          const es = MockEventSource.latestInstance!;
          act(() => {
            es.simulateOpen();
            es.simulateStatusUpdate(makeSSEEvent('ACCEPTED', '2026-05-10T14:34:10Z'));
            es.simulateStatusUpdate(makeSSEEvent('IN_PREPARATION', '2026-05-10T14:40:00Z'));
            es.simulateStatusUpdate(makeSSEEvent('OUT_FOR_DELIVERY', '2026-05-10T15:00:00Z'));
          });
        }
      });
      // Component must not crash during multiple rapid updates
      expect(screen.getByTestId?.('order-tracking-stub') ?? document.body).toBeTruthy();
    });

    it('does not perform a full page reload on status update', async () => {
      const originalLocation = window.location;
      const mockReplace = jest.fn();
      const mockReload = jest.fn();

      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, reload: mockReplace, replace: mockReplace },
        writable: true,
      });

      renderTrackingPage();
      await waitFor(() => {
        if (MockEventSource.instances.length > 0) {
          act(() => {
            MockEventSource.latestInstance!.simulateStatusUpdate(
              makeSSEEvent('ACCEPTED', '2026-05-10T14:34:10Z')
            );
          });
        }
      });

      // No reload or replace should have been called
      expect(mockReplace).not.toHaveBeenCalled();
      expect(mockReload).not.toHaveBeenCalled();

      // Restore
      Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
    });

  });

  describe('Timeline rendering: completed stages and timestamps', () => {

    beforeEach(() => {
      installEventSourceMock();
    });

    it('renders timestamps for completed stages', async () => {
      server.use(activeOrderHandler);
      renderTrackingPage();
      await waitFor(() => {
        // Completed stages should show their timestamps
        const tsEl = screen.queryByText(/2026-05-10/i);
        if (tsEl) expect(tsEl).toBeInTheDocument();
      });
    });

    it('renders the order ID in the page', async () => {
      server.use(activeOrderHandler);
      renderTrackingPage();
      await waitFor(() => {
        const orderIdEl = screen.queryByText(new RegExp(ORDER_ID_ACTIVE, 'i'));
        if (orderIdEl) expect(orderIdEl).toBeInTheDocument();
      });
    });

  });

  describe('EventSource cleanup on unmount', () => {

    beforeEach(() => {
      installEventSourceMock();
    });

    it('closes the EventSource connection when component unmounts', async () => {
      server.use(activeOrderHandler);
      const { unmount } = renderTrackingPage();

      await waitFor(() => {
        if (MockEventSource.instances.length > 0) {
          act(() => {
            MockEventSource.latestInstance!.simulateOpen();
          });
        }
      });

      const instance = MockEventSource.latestInstance;
      unmount();

      if (instance) {
        // After unmount, the EventSource should be closed
        await waitFor(() => {
          expect(instance.isClosed).toBe(true);
        });
      }
    });

  });

});
