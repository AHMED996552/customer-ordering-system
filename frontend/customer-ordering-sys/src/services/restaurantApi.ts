export interface Restaurant {
  restaurant_id: string;
  name: string;
  cuisine_category: string;
  avg_rating: number;
  est_delivery_min: number;
  delivery_fee_egp: number;
  is_open: boolean;
  status_label: string;
  operating_hours_display: string;
}

export interface RestaurantCatalogResponse {
  restaurants: Restaurant[];
  total_count: number;
  server_utc_time_at_request: string;
}

const API_BASE = process.env.REACT_APP_API_BASE ?? 'http://localhost:5000';

export async function fetchRestaurants(): Promise<RestaurantCatalogResponse> {
  const response = await fetch(`${API_BASE}/api/v1/restaurants`);

  if (!response.ok) {
    throw new Error('Failed to fetch restaurants');
  }

  return response.json();
}
