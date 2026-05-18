/**
 * src/hooks/useOrderTracking.ts
 * UC-9 — Track Live Order Status
 *
 * Custom hook managing the full order tracking lifecycle:
 *   1. Fetches order data via GET /api/v1/orders/{orderId}
 *   2. Opens an EventSource connection if stream_endpoint is non-null
 *   3. Listens for 'status_update' events and updates state live
 *   4. Closes the EventSource on terminal status or component unmount
 *
 * Terminal State Guard:
 *   - If stream_endpoint is null (DELIVERED/CANCELLED), EventSource is NEVER opened
 *
 * SSE Event handling:
 *   - Listens on event type 'status_update' via addEventListener
 *   - Also catches generic 'message' events as fallback
 *   - Parses { new_status, timestamp } from event.data (JSON string)
 */

import { useEffect, useRef, useState } from 'react';
import { fetchOrder, Order, TimelineStage } from '../services/api';

const TERMINAL_STATUSES = new Set(['DELIVERED', 'CANCELLED']);

const STATUS_ORDER = [
  'PENDING',
  'ACCEPTED',
  'IN_PREPARATION',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
];

function buildUpdatedTimeline(
  currentTimeline: TimelineStage[],
  newStatus: string,
  timestamp: string
): TimelineStage[] {
  // If newStatus is not a known stage, return unchanged timeline
  const newStatusIndex = STATUS_ORDER.indexOf(newStatus);
  if (newStatusIndex < 0) return currentTimeline;

  return currentTimeline.map((stage) => {
    const stageIndex = STATUS_ORDER.indexOf(stage.stage);
    if (stageIndex < newStatusIndex) {
      // Prior stages — mark completed if not already
      return stage.completed ? stage : { ...stage, completed: true, timestamp };
    }
    if (stage.stage === newStatus) {
      // The new active stage
      return { ...stage, completed: false, timestamp: null };
    }
    // Future stages remain as-is
    return stage;
  });
}

export type TrackingState =
  | { phase: 'loading' }
  | { phase: 'error'; code: string; status: number }
  | { phase: 'loaded'; order: Order; liveStatus: string | null };

export function useOrderTracking(orderId: string): TrackingState {
  const [state, setState] = useState<TrackingState>({ phase: 'loading' });
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let cancelled = false;

    // ── Step 1: Fetch order data ──────────────────────────────────────────────
    fetchOrder(orderId).then((result) => {
      if (cancelled) return;

      if (!result.ok) {
        setState({ phase: 'error', code: result.code, status: result.status });
        return;
      }

      const order = result.order;
      setState({ phase: 'loaded', order, liveStatus: null });

      // ── Step 2: Terminal State Guard ──────────────────────────────────────
      // stream_endpoint must be a non-null string to open EventSource
      if (!order.stream_endpoint) return;

      // ── Step 3: Open SSE connection ───────────────────────────────────────
      const es = new (window.EventSource ?? EventSource)(order.stream_endpoint);
      esRef.current = es;

      // ── Step 4: Handle status_update events ───────────────────────────────
      const handleStatusUpdate = (event: MessageEvent) => {
        if (cancelled) return;
        try {
          const payload = JSON.parse(event.data);
          const newStatus: string = payload?.new_status ?? '';
          const timestamp: string = payload?.timestamp ?? '';

          if (!newStatus) return;

          setState((prev) => {
            if (prev.phase !== 'loaded') return prev;

            const updatedTimeline = prev.order.status_timeline
              ? buildUpdatedTimeline(prev.order.status_timeline, newStatus, timestamp)
              : prev.order.status_timeline;

            const updatedOrder: Order = {
              ...prev.order,
              status: newStatus,
              status_timeline: updatedTimeline,
              // Update stream_endpoint to null if terminal
              stream_endpoint: TERMINAL_STATUSES.has(newStatus)
                ? null
                : prev.order.stream_endpoint,
            };

            return {
              phase: 'loaded',
              order: updatedOrder,
              liveStatus: newStatus,
            };
          });

          // Close stream on terminal status (Terminal State Guard on SSE)
          if (TERMINAL_STATUSES.has(newStatus)) {
            es.close();
            esRef.current = null;
          }
        } catch {
          // Silently ignore malformed SSE payloads
        }
      };

      es.addEventListener('status_update', handleStatusUpdate as EventListener);
      es.addEventListener('message', handleStatusUpdate as EventListener);

      es.onerror = () => {
        if (cancelled) return;
        // SSE error — connection lost. Don't crash, just note the error state
        // Tests verify the component does not crash on SSE error.
        es.close();
        esRef.current = null;
      };
    });

    // ── Cleanup: close EventSource on unmount ─────────────────────────────────
    return () => {
      cancelled = true;
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [orderId]);

  return state;
}
