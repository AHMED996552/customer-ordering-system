import { rest } from 'msw';
import { 
  MOCK_MENU_SUCCESS_RESPONSE, 
  MOCK_RESTAURANT_CLOSED_RESPONSE, 
  MOCK_RESTAURANT_NOT_FOUND_RESPONSE 
} from './factories/menu';

export const handlers = [
  rest.get('/api/v1/restaurants/:id/menu', (req, res, ctx) => {
    const { id } = req.params;

    // Simulate Not Found
    if (id === 'NOT_FOUND_ID') {
      return res(
        ctx.status(404),
        ctx.json(MOCK_RESTAURANT_NOT_FOUND_RESPONSE)
      );
    }

    // Simulate Closed Restaurant Boundary (REQ19)
    if (id === 'CLOSED_ID') {
      return res(
        ctx.status(403),
        ctx.json(MOCK_RESTAURANT_CLOSED_RESPONSE)
      );
    }
    
    // Simulate Server Error
    if (id === 'ERROR_ID') {
      return res(
        ctx.status(500),
        ctx.json({ error: { code: "SERVER_ERROR", message: "Internal server error" }})
      );
    }

    // Default Happy Path (REQ2)
    return res(
      ctx.status(200),
      ctx.json(MOCK_MENU_SUCCESS_RESPONSE)
    );
  }),
];
