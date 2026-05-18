import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { 
  MOCK_MENU_SUCCESS_RESPONSE, 
  MOCK_RESTAURANT_CLOSED_RESPONSE 
} from '../mocks/factories/menu';

import MenuPage from '../pages/MenuPage';
// =====================================================================
// TEST SUITE: UC-2 Explore Menu Details
// =====================================================================

describe('UC-2: Explore Menu Details', () => {

  describe('Happy Path (REQ2)', () => {
    
    it('displays full menu organised by category with required fields', async () => {
      render(<MenuPage restaurantId="R001" />);
      
      // Check loading state (Accessibility)
      expect(screen.getByRole('status')).toHaveTextContent(/loading/i);

      // Wait for the restaurant name to appear
      expect(await screen.findByRole('heading', { level: 1, name: /Burger Palace Menu/i })).toBeInTheDocument();

      // Check categories
      expect(screen.getByRole('heading', { level: 2, name: /Burgers/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /Sides/i })).toBeInTheDocument();

      // Check item details: Classic Burger
      const classicBurger = screen.getByRole('article', { name: /Classic Burger/i });
      expect(classicBurger).toBeInTheDocument();
      expect(within(classicBurger).getByText(/Beef patty, lettuce, tomato, house sauce./i)).toBeInTheDocument();
      expect(within(classicBurger).getByText(/75 EGP/i)).toBeInTheDocument();
      // Should have an active Add to Cart button
      const addButton = within(classicBurger).getByRole('button', { name: /Add to Cart/i });
      expect(addButton).not.toBeDisabled();
    });

  });

  describe('Unavailable Menu Item State (REQ2)', () => {

    it('renders unavailable items in a non-interactive state without firing POST requests', async () => {
      // Mock the POST endpoint to ensure it's not called
      const postCartMock = jest.fn();
      server.use(
        http.post('/api/v1/cart/items', () => {
          postCartMock();
          return HttpResponse.json(null, { status: 200 });
        })
      );

      render(<MenuPage restaurantId="R001" />);
      
      // Wait for load
      expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();

      // Find the Unavailable Special
      const unavailableSpecial = screen.getByRole('article', { name: /Unavailable Special/i });
      expect(unavailableSpecial).toBeInTheDocument();

      // Assert description and price exist
      expect(within(unavailableSpecial).getByText(/Chef's secret recipe./i)).toBeInTheDocument();
      expect(within(unavailableSpecial).getByText(/50 EGP/i)).toBeInTheDocument();

      // Find the disabled button/tile
      const button = within(unavailableSpecial).getByRole('button');
      
      // REQ2 explicit checks: must be disabled via aria-disabled or disabled attribute
      const isDisabledAttr = button.hasAttribute('disabled');
      const isAriaDisabled = button.getAttribute('aria-disabled') === 'true';
      expect(isDisabledAttr || isAriaDisabled).toBe(true);

      // Verify POST is NOT dispatched on click
      userEvent.click(button);
      expect(postCartMock).not.toHaveBeenCalled();
    });
  });

  describe('Operating-Hours Validation (REQ19)', () => {

    it('renders closed restaurant message when server returns HTTP 403', async () => {
      render(<MenuPage restaurantId="CLOSED_ID" />);
      
      // Expect the exact message from the MOCK_RESTAURANT_CLOSED_RESPONSE
      const expectedMessage = MOCK_RESTAURANT_CLOSED_RESPONSE.error.message;
      
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(expectedMessage);
      
      // Ensure menu items are not rendered
      expect(screen.queryByText(/Classic Burger/i)).not.toBeInTheDocument();
    });

  });

  describe('Error and Edge Cases', () => {
    
    it('renders a 404 Not Found state gracefully', async () => {
      render(<MenuPage restaurantId="NOT_FOUND_ID" />);
      
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/Restaurant Not Found/i);
    });
    
    it('renders a generic error state for HTTP 500', async () => {
      render(<MenuPage restaurantId="ERROR_ID" />);
      
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/error occurred/i);
    });

  });

  describe('Description Character Limit (REQ2)', () => {

    it('truncates descriptions exceeding 200 characters', async () => {
      // Override the MSW handler for this specific test
      const longDescription = "A".repeat(250);
      const customResponse = JSON.parse(JSON.stringify(MOCK_MENU_SUCCESS_RESPONSE));
      customResponse.menu[0].items[0].description = longDescription;

      server.use(
        http.get('/api/v1/restaurants/:id/menu', () => {
          return HttpResponse.json(customResponse, { status: 200 });
        })
      );

      render(<MenuPage restaurantId="R001" />);
      expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();

      const article = screen.getByRole('article', { name: /Classic Burger/i });
      // Find the paragraph containing the description.
      // It shouldn't contain the full 250 characters.
      const descElement = within(article).getByText(/A{200}/i);
      expect(descElement.textContent?.length).toBeLessThanOrEqual(203); // 200 + '...'
      expect(descElement.textContent).not.toContain(longDescription);
    });

  });

});
