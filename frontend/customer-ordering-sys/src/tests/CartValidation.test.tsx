/**
 * UC-3: Cart Validation — invalid quantities and unavailable items
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

describe('Cart Validation', () => {
  test('rejects quantity below 1', async () => {
    const user = userEvent.setup();

    render(<App />);

    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '0');

    expect(
      screen.getByText(/quantity must be at least 1/i)
    ).toBeInTheDocument();
  });

  test('disables unavailable items', () => {
    render(<App />);

    const unavailableButton = screen.getByRole('button', { name: /unavailable/i });

    expect(unavailableButton).toBeDisabled();
  });
});
