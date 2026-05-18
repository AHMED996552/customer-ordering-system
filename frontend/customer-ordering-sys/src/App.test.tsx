import { render, screen } from '@testing-library/react';
import App from './App';

test('renders App and defaults to register page', () => {
  render(<App />);
  const headerElement = screen.getByRole('heading', { name: /Create Account/i });
  expect(headerElement).toBeInTheDocument();
});
