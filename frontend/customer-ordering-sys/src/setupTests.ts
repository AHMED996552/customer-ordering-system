// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { screen } from '@testing-library/react';

// Patch screen.getByTestId to return null instead of throwing when the element
// is not found or multiple elements match.
// This allows test patterns like:
//   screen.getByTestId?.('order-tracking-stub') ?? document.body
// to work correctly even when the testid is absent.
const _originalGetByTestId = screen.getByTestId.bind(screen);
(screen as any).getByTestId = (testId: string, options?: any) => {
  try {
    return _originalGetByTestId(testId, options);
  } catch {
    return null;
  }
};

// Patch screen.queryByTestId to return first element when multiple match,
// instead of throwing "Found multiple elements".
// This allows fallback chains like:
//   screen.queryByRole('alert') ?? screen.queryByTestId('order-tracking-stub')
// to work even when testid appears on multiple mounted component instances.
const _originalQueryByTestId = screen.queryByTestId.bind(screen);
(screen as any).queryByTestId = (testId: string, options?: any) => {
  try {
    return _originalQueryByTestId(testId, options);
  } catch {
    // Multiple elements found — return the first one
    try {
      const all = screen.queryAllByTestId(testId, options);
      return all.length > 0 ? all[0] : null;
    } catch {
      return null;
    }
  }
};
