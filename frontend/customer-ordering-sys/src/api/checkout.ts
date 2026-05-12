import { CartItem } from '../utils/checkout.utils';

export interface CheckoutPayload {
  items: CartItem[];
  client_total_egp: number;
  special_instructions: string;
  specialInstructions?: string;
  delivery_notes: string;
  deliveryNotes?: string;
  idempotency_key: string;
  serverUtcHour?: number;
  payment_method: {
    type: string;
    gateway_token: string;
  };
}

export const submitCheckout = async (payload: CheckoutPayload) => {
  const response = await fetch('/api/v1/orders/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const errorMsg = body.error?.message || body.message || `Request failed (${response.status})`;
    const errorCode = body.error?.code || 'ERROR';
    throw new Error(errorMsg);
  }

  return response.json();
};
