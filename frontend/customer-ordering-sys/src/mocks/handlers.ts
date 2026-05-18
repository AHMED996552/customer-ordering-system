import { http, HttpResponse } from 'msw';
import { 
  MOCK_MENU_SUCCESS_RESPONSE, 
  MOCK_RESTAURANT_CLOSED_RESPONSE, 
  MOCK_RESTAURANT_NOT_FOUND_RESPONSE 
} from './factories/menu';

export const handlers = [
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
