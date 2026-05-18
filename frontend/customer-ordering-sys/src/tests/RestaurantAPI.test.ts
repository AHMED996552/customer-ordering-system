import { fetchRestaurants } from '../services/restaurantApi'

// CRA uses Jest — NOT vi.fn()
global.fetch = jest.fn() as jest.Mock

describe('UC-1 Restaurant API', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear()
  })

  test('fetches restaurant catalog successfully', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        restaurants: [
          {
            restaurant_id: 'R001',
            name: 'Burger Palace',
            cuisine_category: 'American',
            avg_rating: 4.5,
            est_delivery_min: 25,
            delivery_fee_egp: 15.0,
            is_open: true,
            status_label: 'Open',
          },
        ],
        total_count: 1,
        server_utc_time_at_request: '2026-05-16T14:00:00Z',
      }),
    })

    const result = await fetchRestaurants()

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/v1/restaurants'
    )
    expect(result.restaurants.length).toBe(1)
    expect(result.restaurants[0].name).toBe('Burger Palace')
  })

  test('throws on API failure', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false })

    await expect(fetchRestaurants()).rejects.toThrow(
      'Failed to fetch restaurants'
    )
  })
})
