/**
 * src/services/api.ts
 * UC-9 — Track Live Order Status
 *
 * API service layer for order data fetching.
 * All requests are made without a user_id parameter — identity is resolved
 * server-side from the session cookie (UC-9 security requirement).
 */

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
  status_timeline: TimelineStage[] | null;
  stream_endpoint: string | null;
}

export interface AccessDeniedError {
  error: {
    code: 'ORDER_ACCESS_DENIED';
    message: string;
  };
}

export type FetchOrderResult =
  | { ok: true; order: Order }
  | { ok: false; status: number; code: string };

/**
 * Fetch order tracking data from the API.
 * Returns a discriminated union: success or error.
 */
export async function fetchOrder(orderId: string): Promise<FetchOrderResult> {
  let response: Response;
  try {
    response = await fetch(`/api/v1/orders/${orderId}`);
  } catch {
    return { ok: false, status: 0, code: 'NETWORK_ERROR' };
  }

  if (response.status === 403) {
    let code = 'ORDER_ACCESS_DENIED';
    try {
      const body = await response.json();
      code = body?.error?.code ?? 'ORDER_ACCESS_DENIED';
    } catch {
      // Ignore parse errors
    }
    return { ok: false, status: 403, code };
  }

  if (!response.ok) {
    return { ok: false, status: response.status, code: 'SERVER_ERROR' };
  }

  try {
    const body = await response.json();
    return { ok: true, order: body.order };
  } catch {
    return { ok: false, status: response.status, code: 'PARSE_ERROR' };
  }
}
