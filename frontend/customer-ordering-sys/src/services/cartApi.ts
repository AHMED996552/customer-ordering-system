const BASE = 'http://localhost:8000';

interface AddToCartParams {
  itemId: string;
  quantity: number;
}

export async function addToCart(params: AddToCartParams): Promise<any> {
  const res = await fetch(`${BASE}/api/v1/cart/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      item_id: params.itemId,
      quantity: params.quantity
    }),
  });
  
  const data = await res.json();
  
  if (!res.ok) {
    // Surface the exact error message from the backend (e.g., cross-restaurant error)
    const backendMsg = data?.error?.message || `Cart API error: ${res.status}`;
    throw new Error(backendMsg);
  }
  
  return data;
}
