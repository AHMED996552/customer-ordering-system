/**
 * UC-3: Cart API — frontend ↔ Flask communication
 * Uses jest.fn() (CRA/Jest) instead of vi.fn() (Vitest)
 */
import { addToCart } from '../services/cartApi';

global.fetch = jest.fn();

const mockedFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('Cart API', () => {
  beforeEach(() => {
    mockedFetch.mockClear();
  });

  test('sends add-to-cart request correctly', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    await addToCart({ itemId: 'I001', quantity: 2 });

    expect(mockedFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/cart/items',
      expect.any(Object),
    );
  });
});
