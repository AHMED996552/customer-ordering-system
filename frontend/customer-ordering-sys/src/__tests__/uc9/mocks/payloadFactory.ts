/**
 * payloadFactory.ts
 * UC-9 — Track Live Order Status
 *
 * Deterministic payload factories for building canonical UC-9 API response
 * objects in frontend tests. Aligned strictly with the UC-9 API contract.
 */

// ── Constants ────────────────────────────────────────────────────────────────

export const ORDER_ID_ACTIVE = 'ORD-20260510-001';
export const ORDER_ID_TERMINAL = 'ORD-20260510-002';
export const ORDER_ID_OTHER_USER = 'ORD-20260510-004';

export const STREAM_ENDPOINT = `/api/v1/orders/${ORDER_ID_ACTIVE}/status-stream`;

// ── Type definitions ─────────────────────────────────────────────────────────

export interface TimelineStage {
  stage: string;
  completed: boolean;
  timestamp: string | null;
}

export interface OrderItem {
  item_id: string;
  name: string;
  quantity: number;
  unit_price_egp: number;
  line_total_egp: number;
}

export interface DeliveryAddress {
  street: string;
  city: string;
  notes: string;
}

export interface Order {
  order_id: string;
  status: string;
  restaurant_id: string;
  restaurant_name: string;
  items: OrderItem[];
  server_computed_total_egp: number;
  delivery_address: DeliveryAddress;
  special_instructions: string;
  payment_reference: string;
  created_at: string;
  cancellable: boolean;
  status_timeline: TimelineStage[];
  stream_endpoint: string | null;
}

export interface OrderResponse {
  order: Order;
}

export interface AccessDeniedError {
  error: {
    code: 'ORDER_ACCESS_DENIED';
    message: string;
  };
}

export interface SSEStatusUpdatePayload {
  new_status: string;
  timestamp: string;
}

// ── Timeline factories ────────────────────────────────────────────────────────

/** Build a full 5-stage timeline with the given status as the most recently
 *  completed stage. Stages after currentStatus have completed=false, timestamp=null. */
export function makeTimeline(currentStatus: string): TimelineStage[] {
  const stages = [
    'PENDING',
    'ACCEPTED',
    'IN_PREPARATION',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
  ];

  const completedTimestamps: Record<string, string> = {
    PENDING: '2026-05-10T14:32:00Z',
    ACCEPTED: '2026-05-10T14:34:10Z',
    IN_PREPARATION: '2026-05-10T14:40:00Z',
    OUT_FOR_DELIVERY: '2026-05-10T15:00:00Z',
    DELIVERED: '2026-05-10T15:30:00Z',
  };

  const currentIndex = stages.indexOf(currentStatus);

  return stages.map((stage, idx) => ({
    stage,
    completed: idx < currentIndex,
    timestamp: idx < currentIndex ? completedTimestamps[stage] : null,
  }));
}

/** Build a timeline for a CANCELLED order (only PENDING completed). */
export function makeCancelledTimeline(): TimelineStage[] {
  return [
    { stage: 'PENDING', completed: true, timestamp: '2026-05-10T14:32:00Z' },
    { stage: 'ACCEPTED', completed: false, timestamp: null },
    { stage: 'IN_PREPARATION', completed: false, timestamp: null },
    { stage: 'OUT_FOR_DELIVERY', completed: false, timestamp: null },
    { stage: 'DELIVERED', completed: false, timestamp: null },
  ];
}

// ── Order factories ───────────────────────────────────────────────────────────

/**
 * Build a canonical active order payload.
 *
 * @param overrides - Partial<Order> to override default values.
 */
export function makeActiveOrder(overrides: Partial<Order> = {}): OrderResponse {
  const status = overrides.status ?? 'IN_PREPARATION';
  const orderId = overrides.order_id ?? ORDER_ID_ACTIVE;

  const order: Order = {
    order_id: orderId,
    status,
    restaurant_id: 'R001',
    restaurant_name: 'Burger Palace',
    items: [
      {
        item_id: 'I001',
        name: 'Classic Burger',
        quantity: 2,
        unit_price_egp: 75.0,
        line_total_egp: 150.0,
      },
    ],
    server_computed_total_egp: 150.0,
    delivery_address: {
      street: '15 El-Geish Street',
      city: 'Alexandria',
      notes: 'Ring doorbell twice.',
    },
    special_instructions: 'No onions, please.',
    payment_reference: 'PAY-GW-TXN-77241',
    created_at: '2026-05-10T14:32:00Z',
    cancellable: false,
    status_timeline: overrides.status_timeline ?? makeTimeline(status),
    stream_endpoint: `/api/v1/orders/${orderId}/status-stream`,
    ...overrides,
  };

  return { order };
}

/**
 * Build a canonical DELIVERED (terminal) order payload.
 * stream_endpoint is null — SSE must NOT be opened.
 */
export function makeTerminalOrder(
  status: 'DELIVERED' | 'CANCELLED' = 'DELIVERED',
  overrides: Partial<Order> = {}
): OrderResponse {
  const orderId = overrides.order_id ?? ORDER_ID_TERMINAL;

  const timeline =
    status === 'CANCELLED'
      ? makeCancelledTimeline()
      : makeTimeline('DELIVERED').map((s) => ({ ...s, completed: true, timestamp: s.timestamp ?? '2026-05-10T15:30:00Z' }));

  const order: Order = {
    order_id: orderId,
    status,
    restaurant_id: 'R001',
    restaurant_name: 'Burger Palace',
    items: [
      {
        item_id: 'I001',
        name: 'Classic Burger',
        quantity: 2,
        unit_price_egp: 75.0,
        line_total_egp: 150.0,
      },
    ],
    server_computed_total_egp: 150.0,
    delivery_address: {
      street: '15 El-Geish Street',
      city: 'Alexandria',
      notes: 'Ring doorbell twice.',
    },
    special_instructions: 'No onions, please.',
    payment_reference: 'PAY-GW-TXN-77241',
    created_at: '2026-05-10T14:32:00Z',
    cancellable: false,
    status_timeline: timeline,
    stream_endpoint: null, // ← Terminal state guard: always null
    ...overrides,
  };

  return { order };
}

/**
 * Build the canonical 403 ORDER_ACCESS_DENIED error envelope.
 * Per UC-9 security rules, this is structurally identical for both
 * "nonexistent order" and "other user's order".
 */
export function makeAccessDeniedError(): AccessDeniedError {
  return {
    error: {
      code: 'ORDER_ACCESS_DENIED',
      message: 'You do not have permission to access this order.',
    },
  };
}

/**
 * Build a canonical SSE status_update event payload.
 */
export function makeSSEEvent(newStatus: string, timestamp?: string): SSEStatusUpdatePayload {
  return {
    new_status: newStatus,
    timestamp: timestamp ?? new Date().toISOString(),
  };
}

/**
 * Build a canonical active order starting from PENDING status.
 */
export function makePendingOrder(): OrderResponse {
  return makeActiveOrder({ status: 'PENDING', status_timeline: makeTimeline('PENDING') });
}
