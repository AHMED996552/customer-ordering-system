import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import OrderHistory from '../OrderHistory';

// Mock MSW Server
const server = setupServer(
  rest.get('/api/v1/orders', (req, res, ctx) => {
    const page = req.url.searchParams.get('page');
    if (page === '1' || !page) {
      return res(
        ctx.status(200),
        ctx.json({
          orders: [
            {
              order_id: 'ORD-20260510-001',
              restaurant_id: 'R001',
              restaurant_name: "L'Ambroisie Moderne",
              created_at: '2023-10-12T20:45:00Z',
              item_summary: 'Black Truffle Risotto x2, Vintage Cristal Champagne',
              total_egp: 574.00,
              status: 'DELIVERED',
              cancellable: false,
            },
            {
              order_id: 'ORD-20260508-003',
              restaurant_id: 'R002',
              restaurant_name: 'The Prime Grill',
              created_at: '2023-09-15T18:00:00Z',
              item_summary: 'Dry-Aged Ribeye, Truffle Fries',
              total_egp: 245.00,
              status: 'CANCELLED',
              cancellable: false,
            }
          ],
          pagination: {
            page: 1,
            limit: 10,
            total_count: 2,
            total_pages: 1,
          },
        })
      );
    } else if (page === '2') {
        return res(
            ctx.status(200),
            ctx.json({
              orders: [
                {
                  order_id: 'ORD-20260507-005',
                  restaurant_id: 'R003',
                  restaurant_name: "Sushi House",
                  created_at: '2023-09-10T19:00:00Z',
                  item_summary: 'Spicy Tuna Roll x2',
                  total_egp: 150.00,
                  status: 'DELIVERED',
                  cancellable: false,
                }
              ],
              pagination: {
                page: 2,
                limit: 10,
                total_count: 11,
                total_pages: 2,
              },
            })
        );
    }
    return res(ctx.status(200), ctx.json({ orders: [], pagination: { page: 1, limit: 10, total_count: 0, total_pages: 0 } }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('OrderHistory Component - UC-8', () => {
  it('renders the main layout correctly', async () => {
    render(<OrderHistory />);
    expect(screen.getByRole('heading', { name: /Your Culinary History/i })).toBeInTheDocument();
    expect(screen.getByText(/Concierge Portal/i)).toBeInTheDocument();
  });

  it('displays order data with all 6 mandatory fields', async () => {
    render(<OrderHistory />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText("L'Ambroisie Moderne")).toBeInTheDocument();
    });

    // 1. Restaurant Name
    expect(screen.getByText("L'Ambroisie Moderne")).toBeInTheDocument();
    
    // 2. Created At (using the formatted string from utils mock or assumed format)
    expect(screen.getByText(/Oct 12, 2023/i)).toBeInTheDocument();
    
    // 3. Status
    expect(screen.getByText('DELIVERED')).toBeInTheDocument();
    expect(screen.getByText('CANCELLED')).toBeInTheDocument();

    // 4. Total EGP
    expect(screen.getByText('$574.00')).toBeInTheDocument();

    // 5. Item Summary
    expect(screen.getByText(/Black Truffle Risotto x2/i)).toBeInTheDocument();

    // 6. Order ID
    const firstOrderCard = screen.getByTestId('order-card-ORD-20260510-001');
    expect(firstOrderCard).toBeInTheDocument();
  });

  it('handles empty state correctly', async () => {
    server.use(
      rest.get('/api/v1/orders', (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({ orders: [], pagination: { page: 1, limit: 10, total_count: 0, total_pages: 0 } })
        );
      })
    );
    render(<OrderHistory />);
    
    await waitFor(() => {
      expect(screen.getByText(/No orders found/i)).toBeInTheDocument();
    });
  });

  it('displays HTTP 401 Unauthenticated error and prompts login', async () => {
    server.use(
      rest.get('/api/v1/orders', (req, res, ctx) => {
        return res(
          ctx.status(401),
          ctx.json({ error: { code: 'UNAUTHENTICATED', message: 'You must be logged in to view your order history.' } })
        );
      })
    );
    render(<OrderHistory />);
    
    await waitFor(() => {
      expect(screen.getByText(/You must be logged in to view your order history/i)).toBeInTheDocument();
    });
    // Check if login prompt/button exists
    expect(screen.getByRole('button', { name: /Login/i })).toBeInTheDocument();
  });

  it('displays HTTP 403 Order Access Denied error', async () => {
    server.use(
      rest.get('/api/v1/orders', (req, res, ctx) => {
        return res(
          ctx.status(403),
          ctx.json({ error: { code: 'ORDER_ACCESS_DENIED', message: 'You do not have permission to access this order.' } })
        );
      })
    );
    render(<OrderHistory />);
    
    await waitFor(() => {
      expect(screen.getByText(/You do not have permission to access this order/i)).toBeInTheDocument();
    });
  });

  it('displays HTTP 422 Validation Error for invalid parameters', async () => {
    server.use(
      rest.get('/api/v1/orders', (req, res, ctx) => {
        return res(
          ctx.status(422),
          ctx.json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Request parameters failed validation.',
              fields: { page: 'Must be a positive integer greater than or equal to 1.' }
            }
          })
        );
      })
    );
    render(<OrderHistory />);
    
    await waitFor(() => {
      expect(screen.getByText(/Request parameters failed validation/i)).toBeInTheDocument();
    });
  });

  it('handles pagination controls and dispatches new requests', async () => {
    const user = userEvent.setup();
    render(<OrderHistory />);
    
    await waitFor(() => {
        expect(screen.getByText("L'Ambroisie Moderne")).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /Next Page/i });
    await user.click(nextButton);

    await waitFor(() => {
        // Assume Sushi House is on page 2
        expect(screen.getByText("Sushi House")).toBeInTheDocument();
    });
  });

  it('meets accessibility (a11y) standards for images and interactive elements', async () => {
    render(<OrderHistory />);
    
    await waitFor(() => {
        expect(screen.getByText("L'Ambroisie Moderne")).toBeInTheDocument();
    });

    // Check images for alt text
    const images = screen.getAllByRole('img');
    images.forEach(img => {
      expect(img).toHaveAttribute('alt');
      expect(img.getAttribute('alt')).not.toBe('');
    });

    // Check keyboard navigability for actionable items
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).not.toHaveAttribute('tabindex', '-1');
    });
  });

  it('handles network failures gracefully', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new TypeError('Network error'));
    
    render(<OrderHistory />);
    
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('handles internal server errors (500) gracefully', async () => {
    server.use(
      rest.get('/api/v1/orders', (req, res, ctx) =>
        res(
          ctx.status(500),
          ctx.json({
            error: 'INTERNAL_SERVER_ERROR',
            message: 'Internal server error',
          })
        )
      )
    );
    
    render(<OrderHistory />);
    
    await waitFor(() => {
      expect(screen.getByText('INTERNAL_SERVER_ERROR')).toBeInTheDocument();
      expect(screen.getByText('Internal server error')).toBeInTheDocument();
    });
  });
});
