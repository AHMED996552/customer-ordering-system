import { CartItem } from '../utils/checkout.utils';

export interface CheckoutPayload {
  items: Array<{ item_id: number; quantity: number }>;
  client_total_egp: number;
  idempotency_key: string;
  payment_method: {
    type: string;
    gateway_token: string;
  };
  special_instructions?: string;
  delivery_notes?: string;
  serverUtcHour?: number;
}

export interface CheckoutResponse {
  order_id: string;
  status: string;
}

export interface CheckoutError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

/**
 * Generates a UUID v4 for idempotency.
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments where crypto.randomUUID is not available
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Maps frontend CartItem to backend requirement (item_id: number, quantity: number).
 */
function mapItems(items: CartItem[]) {
  return items.map((item) => {
    // Extract number from "I001" -> 1
    const numericId = parseInt(item.id.replace(/\D/g, ''), 10);
    return {
      item_id: isNaN(numericId) ? 0 : numericId,
      quantity: item.qty || item.quantity || 0,
    };
  });
}

/**
 * Calls the backend checkout API.
 */
export async function checkout(
  cartItems: CartItem[],
  total: number,
  instructions: string,
  notes: string,
  serverUtcHour: number
): Promise<CheckoutResponse> {
  const payload: CheckoutPayload = {
    items: mapItems(cartItems),
    client_total_egp: total,
    idempotency_key: generateUUID(),
    payment_method: {
      type: 'CREDIT_CARD',
      gateway_token: 'tok_visa',
    },
    special_instructions: instructions,
    delivery_notes: notes,
    serverUtcHour,
  };

  const response = await fetch('/api/v1/orders/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw { code: 'MALFORMED_RESPONSE', message: 'The server returned an invalid response.' };
  }

  if (!response.ok) {
    // Return structured error if available, else fallback
    throw data.error || { code: 'UNKNOWN_ERROR', message: data.message || `Request failed with status ${response.status}` };
  }

  return data;
}
