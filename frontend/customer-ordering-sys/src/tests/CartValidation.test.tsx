/**
 * UC-3: Cart Validation — invalid quantities and unavailable items
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CartProvider } from '../context/CartContext';
import MenuPage from '../pages/MenuPage';

const renderMenuPage = () =>
  render(
    <CartProvider>
      <MemoryRouter>
        <MenuPage />
      </MemoryRouter>
    </CartProvider>
  );

describe('Cart Validation', () => {
  test('rejects quantity below 1', async () => {
    const user = userEvent.setup();

    renderMenuPage();

    const input = screen.getAllByRole('spinbutton')[0];
    await user.clear(input);
    await user.type(input, '0');

    expect(
      screen.getByText(/quantity must be at least 1/i)
    ).toBeInTheDocument();
  });

  test('disables unavailable items', () => {
    renderMenuPage();

    const unavailableButton = screen.getByRole('button', { name: /unavailable/i });

    expect(unavailableButton).toBeDisabled();
  });
});
