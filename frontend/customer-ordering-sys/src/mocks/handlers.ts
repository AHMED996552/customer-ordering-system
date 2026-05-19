import { http, HttpResponse } from 'msw';
import { 
  MOCK_MENU_SUCCESS_RESPONSE, 
  MOCK_RESTAURANT_CLOSED_RESPONSE, 
  MOCK_RESTAURANT_NOT_FOUND_RESPONSE 
} from './factories/menu';

// ---------------------------------------------------------------------------
// Mock restaurant catalog — mirrors the MOCK_RESTAURANTS fallback in HomePage
// ---------------------------------------------------------------------------
const MOCK_CATALOG_RESPONSE = {
  restaurants: [
    {
      restaurant_id: 'R001', name: 'Burger Palace',
      cuisine_category: 'American', avg_rating: 4.5,
      est_delivery_min: 25, delivery_fee_egp: 15.0,
      is_open: true, status_label: 'Open',
      operating_hours_display: '10:00 AM – 10:00 PM',
    },
    {
      restaurant_id: 'R002', name: 'Pizza Kingdom',
      cuisine_category: 'Italian', avg_rating: 4.2,
      est_delivery_min: 35, delivery_fee_egp: 20.0,
      is_open: true, status_label: 'Open',
      operating_hours_display: '11:00 AM – 11:00 PM',
    },
    {
      restaurant_id: 'R003', name: 'Sushi House',
      cuisine_category: 'Japanese', avg_rating: 4.8,
      est_delivery_min: 45, delivery_fee_egp: 25.0,
      is_open: true, status_label: 'Open',
      operating_hours_display: '12:00 PM – 9:00 PM',
    },
    {
      restaurant_id: 'R004', name: 'Night Bites',
      cuisine_category: 'Street Food', avg_rating: 3.9,
      est_delivery_min: 20, delivery_fee_egp: 10.0,
      is_open: false, status_label: 'Currently Closed',
      operating_hours_display: '8:00 PM – 4:00 AM',
    },
  ],
  total_count: 4,
  server_utc_time_at_request: new Date().toISOString(),
};

export const handlers = [
  // ── Restaurant catalog (UC-1) ────────────────────────────────────────────
  http.get('http://localhost:5000/api/v1/restaurants', () => {
    return HttpResponse.json(MOCK_CATALOG_RESPONSE, { status: 200 });
  }),

  // ── Menu per restaurant (UC-2) ───────────────────────────────────────────
  http.get('/api/v1/restaurants/:id/menu', ({ params }) => {
    const { id } = params;

    // Simulate Not Found
    if (id === 'NOT_FOUND_ID') {
      return HttpResponse.json(MOCK_RESTAURANT_NOT_FOUND_RESPONSE, { status: 404 });
    }

    // Simulate Closed Restaurant Boundary (REQ19)
    if (id === 'CLOSED_ID') {
      return HttpResponse.json(MOCK_RESTAURANT_CLOSED_RESPONSE, { status: 403 });
    }
    
    // Simulate Server Error
    if (id === 'ERROR_ID') {
      return HttpResponse.json(
        { error: { code: "SERVER_ERROR", message: "Internal server error" } },
        { status: 500 }
      );
    }

    // Default Happy Path (REQ2)
    return HttpResponse.json(MOCK_MENU_SUCCESS_RESPONSE, { status: 200 });
  }),
];
