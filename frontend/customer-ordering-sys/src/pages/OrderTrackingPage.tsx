/**
 * src/pages/OrderTrackingPage.tsx
 * UC-9 — Track Live Order Status
 *
 * Main page component for order tracking.
 *
 * Test contract:
 *   - Imported by tests as: require('../../pages/OrderTrackingPage').default
 *   - Props: { orderId: string }
 *   - Fetches GET /api/v1/orders/{orderId}
 *   - On success: renders timeline, restaurant name, order ID, timestamps
 *   - On 403: renders ACCESS DENIED with ORDER_ACCESS_DENIED code — identical for
 *             both nonexistent and unauthorized orders (anti-enumeration)
 *   - On stream_endpoint non-null: opens EventSource, listens for status_update
 *   - On stream_endpoint null: does NOT open EventSource (Terminal State Guard)
 *   - On unmount: closes EventSource connection
 *
 * CRITICAL SSE NOTES:
 *   - Uses addEventListener('status_update', ...) which MockEventSource supports
 *   - Terminal statuses (DELIVERED/CANCELLED) close the EventSource
 *   - The component NEVER shows "live" or "connecting" text for terminal orders
 *
 * ANTI-ENUMERATION:
 *   - All 403 responses render the exact same error message
 *   - No "order not found" / "does not exist" / "no such order" text ever rendered
 */

import React, { useEffect, useRef, useState } from 'react';
import LoadingState from '../components/tracking/LoadingState';
import ErrorState from '../components/tracking/ErrorState';
import TrackingTimeline from '../components/tracking/TrackingTimeline';
import DeliverySummary from '../components/tracking/DeliverySummary';
import { fetchOrder, Order } from '../services/api';

interface Props {
  orderId: string;
}

const TERMINAL_STATUSES = new Set(['DELIVERED', 'CANCELLED']);

const STATUS_ORDER = [
  'PENDING',
  'ACCEPTED',
  'IN_PREPARATION',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
];

type PageState =
  | { phase: 'loading' }
  | { phase: 'error'; code: string; status: number }
  | { phase: 'loaded'; order: Order };

export default function OrderTrackingPage({ orderId }: Props) {
  const [state, setState] = useState<PageState>({ phase: 'loading' });
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let cancelled = false;

    // ── Fetch order data ──────────────────────────────────────────────────────
    fetchOrder(orderId).then((result) => {
      if (cancelled) return;

      if (!result.ok) {
        setState({ phase: 'error', code: result.code, status: result.status });
        return;
      }

      const order = result.order;
      setState({ phase: 'loaded', order });

      // ── Terminal State Guard: only open SSE for active orders ─────────────
      // If stream_endpoint is null or missing, do NOT open EventSource.
      if (!order.stream_endpoint) return;

      // ── Open SSE connection ───────────────────────────────────────────────
      // Use window.EventSource so the MockEventSource installed in tests is used.
      // Use window.EventSource (MockEventSource is installed on window in tests)
      // Guard against ReferenceError in Node/Jest where EventSource is not a global
      const EventSourceCtor: typeof EventSource | undefined =
        typeof window !== 'undefined'
          ? (window as any).EventSource
          : typeof globalThis !== 'undefined'
          ? (globalThis as any).EventSource
          : undefined;

      if (!EventSourceCtor) {
        // EventSource not available (SSR or test without mock installed)
        return;
      }

      const es = new EventSourceCtor(order.stream_endpoint) as EventSource;
      esRef.current = es;

      // ── Handle status_update events ───────────────────────────────────────
      // The mock uses addEventListener('status_update') to fire events, so we
      // must use addEventListener (not onmessage) to receive them.
      const handleStatusUpdate = (event: MessageEvent) => {
        if (cancelled) return;
        try {
          const payload = JSON.parse(event.data);
          const newStatus: string = payload?.new_status ?? '';
          const timestamp: string = payload?.timestamp ?? '';
          if (!newStatus) return;

          setState((prev) => {
            if (prev.phase !== 'loaded') return prev;

            // Update the timeline: mark prior stages as completed
            const updatedTimeline = prev.order.status_timeline
              ? prev.order.status_timeline.map((stage) => {
                  const stageIdx = STATUS_ORDER.indexOf(stage.stage);
                  const newIdx = STATUS_ORDER.indexOf(newStatus);
                  if (stageIdx < newIdx) {
                    return { ...stage, completed: true, timestamp: stage.timestamp ?? timestamp };
                  }
                  if (stage.stage === newStatus) {
                    return { ...stage, completed: false, timestamp: null };
                  }
                  return stage;
                })
              : prev.order.status_timeline;

            return {
              phase: 'loaded',
              order: {
                ...prev.order,
                status: newStatus,
                status_timeline: updatedTimeline,
              },
            };
          });

          // Close stream on terminal status
          if (TERMINAL_STATUSES.has(newStatus)) {
            es.close();
            esRef.current = null;
          }
        } catch {
          // Silently ignore malformed payloads
        }
      };

      es.addEventListener('status_update', handleStatusUpdate as EventListener);
      // Fallback for generic message events
      es.addEventListener('message', handleStatusUpdate as EventListener);

      es.onerror = () => {
        if (cancelled) return;
        es.close();
        esRef.current = null;
      };
    });

    // ── Cleanup on unmount ────────────────────────────────────────────────────
    return () => {
      cancelled = true;
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [orderId]);

  // ── Render: Loading ────────────────────────────────────────────────────────
  if (state.phase === 'loading') {
    return <LoadingState />;
  }

  // ── Render: Error ──────────────────────────────────────────────────────────
  if (state.phase === 'error') {
    return <ErrorState code={state.code} status={state.status} />;
  }

  // ── Render: Loaded (active or terminal) ───────────────────────────────────
  const { order } = state;
  const isTerminal = TERMINAL_STATUSES.has(order.status);

  return (
    <div
      className="relative min-h-screen bg-background text-on-surface antialiased overflow-x-hidden"
    >
      {/* Cinematic map background */}
      <div className="fixed inset-0 z-0 map-container" aria-hidden="true">
        <div className="absolute inset-0 opacity-40 grayscale contrast-125 brightness-50 mix-blend-screen overflow-hidden">
          <div className="w-full h-full bg-gradient-to-br from-primary-container/30 to-background" />
        </div>

        {/* Courier pulse — only shown for active orders */}
        {!isTerminal && (
          <div className="absolute top-[48%] left-[45%] -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-12 h-12 bg-primary/20 rounded-full animate-ping" />
              <div className="relative z-10 w-6 h-6 bg-primary rounded-full border-2 border-white shadow-[0_0_15px_rgba(175,198,252,1)] flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-[14px] text-on-primary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  pedal_bike
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Top Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-lg py-sm rounded-full mt-4 mx-auto max-w-[95%] bg-surface-container-lowest/60 backdrop-blur-xl border border-on-tertiary-container/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.8)]">
        <span className="font-headline-md text-headline-md font-extrabold tracking-tighter text-primary">
          LuxeEats
        </span>
        <nav className="hidden md:flex items-center gap-lg" aria-label="Main navigation">
          <a href="/" className="font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors duration-300">
            Fine Dining
          </a>
          <a href="/" className="font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors duration-300">
            Patisserie
          </a>
        </nav>
      </header>

      {/* Live status announcement region — announces updates to screen readers only */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="live-status-region"
        role="status"
      >
        <span aria-label={`Order status: ${order.status}`} />
      </div>

      {/* Main content */}
      <main className="relative z-10 pt-32 pb-32 md:pb-16 px-gutter">
        {/* Page title (h1) */}
        <h1 className="sr-only">Order Tracking — {order.order_id}</h1>

        <div className="container mx-auto grid grid-cols-1 md:grid-cols-12 gap-gutter">
          {/* Left panel: Delivery summary */}
          <div className="md:col-span-4 flex flex-col gap-gutter">
            <DeliverySummary order={order} />

            {/* Current status badge */}
            <div
              className="glass-card inner-glow rounded-3xl p-md flex items-center gap-md"
              data-testid="order-status"
              aria-label={`Current order status: ${order.status}`}
            >
              <div className="p-base bg-primary-container rounded-xl flex-shrink-0" aria-hidden="true">
                <span
                  className="material-symbols-outlined text-primary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {isTerminal ? 'check_circle' : 'sync'}
                </span>
              </div>
              <div>
                <p className="font-label-caps text-label-caps text-primary">
                  CURRENT STATUS
                </p>
                <p className="font-headline-md text-[18px] text-on-surface">
                  {order.status}
                </p>
              </div>
            </div>
          </div>

          {/* Right panel: Timeline */}
          <div className="md:col-start-9 md:col-span-4">
            <TrackingTimeline order={order} />
          </div>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-md pb-md pt-sm md:hidden rounded-t-[32px] bg-surface-container-lowest/80 backdrop-blur-2xl border-t border-on-tertiary-container/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
        aria-label="Mobile navigation"
      >
        <a href="/" className="flex flex-col items-center justify-center text-on-surface-variant/60 hover:text-primary transition-all active:scale-90 duration-200">
          <span className="material-symbols-outlined" aria-hidden="true">explore</span>
          <span className="font-label-caps text-label-caps mt-1">Explore</span>
        </a>
        <div className="flex flex-col items-center justify-center text-primary font-bold scale-110 transition-all active:scale-90 duration-200" aria-current="page">
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
          <span className="font-label-caps text-label-caps mt-1">Orders</span>
        </div>
      </nav>
    </div>
  );
}
