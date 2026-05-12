const BASE = 'http://localhost:5000';

interface AddToCartParams {
  itemId: string;
  quantity: number;
}

export async function addToCart(params: AddToCartParams): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/cart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Cart API error: ${res.status}`);
  return res.json() as Promise<{ success: boolean }>;
}
