/**
 * UC-3: Add Item to Cart — Happy Path
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CartProvider } from '../context/CartContext';
import MenuPage from '../pages/MenuPage';

// Mock the cart API so tests don't need a running backend
jest.mock('../services/cartApi', () => ({
  addToCart: jest.fn().mockResolvedValue({ success: true }),
}));

const renderMenuPage = () =>
  render(
    <CartProvider>
      <MemoryRouter>
        <MenuPage />
      </MemoryRouter>
    </CartProvider>
  );

describe('UC-3 Add Item to Cart', () => {
  test('adds valid item to cart successfully', async () => {
    const user = userEvent.setup();

    renderMenuPage();

    // user selects quantity (first item on page)
    const quantityInput = screen.getAllByRole('spinbutton')[0];
    await user.clear(quantityInput);
    await user.type(quantityInput, '2');

    // add item (first card)
    const addButton = screen.getAllByRole('button', { name: /add to cart/i })[0];
    await user.click(addButton);

    // cart badge updates to show 1 unique item
    await waitFor(() => {
      expect(screen.getByText(/Cart \(1\)/)).toBeInTheDocument();
    });

    // subtotal updates (first item price × 2)
    expect(screen.getByText(/150/i)).toBeInTheDocument();
  });
});
