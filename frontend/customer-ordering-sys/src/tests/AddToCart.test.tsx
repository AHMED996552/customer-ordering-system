/**
 * UC-3: Add Item to Cart — Happy Path
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

describe('UC-3 Add Item to Cart', () => {
  test('adds valid item to cart successfully', async () => {
    const user = userEvent.setup();

    render(<App />);

    // user selects quantity
    const quantityInput = screen.getByRole('spinbutton');
    await user.clear(quantityInput);
    await user.type(quantityInput, '2');

    // add item
    const addButton = screen.getByRole('button', { name: /add to cart/i });
    await user.click(addButton);

    // cart updates
    expect(screen.getByText(/cart \(1\)/i)).toBeInTheDocument();

    // subtotal updates
    expect(screen.getByText(/150/i)).toBeInTheDocument();

    // item appears in cart
    expect(screen.getByText(/classic burger/i)).toBeInTheDocument();
  });
});
