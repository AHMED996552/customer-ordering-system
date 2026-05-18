import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrderDetailsCancellation from '../OrderDetailsCancellation';

// Mock the global fetch API to simulate backend responses
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('OrderDetailsCancellation Component', () => {
  const defaultProps = {
    orderId: 'ORD-20260510-001',
    initialStatus: 'PENDING',
    createdAtUtc: '2026-05-10T14:32:00Z',
    totalAmount: 150.00,
  };

  beforeEach(() => {
    // Control system time to rigorously test the 180s countdown boundary
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-10T14:32:00Z')); // 0 seconds elapsed initially
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const setupUser = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

  describe('Rendering & Data Display', () => {
    it('renders the order ID, dynamic countdown timer, and current status badge properly', () => {
      render(<OrderDetailsCancellation {...defaultProps} />);
      
      expect(screen.getByTestId('order-id')).toHaveTextContent('ORD-20260510-001');
      expect(screen.getByTestId('order-status-badge')).toHaveTextContent('PENDING');
      
      const timer = screen.getByRole('timer', { name: /cancellation window countdown/i });
      expect(timer).toBeInTheDocument();
      expect(timer).toHaveAttribute('aria-live', 'polite');
      expect(timer).toHaveTextContent('3:00');
    });
  });

  describe('Timer & Button State Handling (Guard 2 Enforcement)', () => {
    it('updates the countdown display and keeps the cancel button enabled within the 180s window', () => {
      render(<OrderDetailsCancellation {...defaultProps} />);
      
      const cancelButton = screen.getByRole('button', { name: /confirm cancellation/i });
      const timer = screen.getByRole('timer');

      expect(cancelButton).toBeEnabled();
      expect(timer).toHaveTextContent('3:00');

      // Advance time by 60 seconds
      act(() => { jest.advanceTimersByTime(60000); });

      expect(timer).toHaveTextContent('2:00');
      expect(cancelButton).toBeEnabled();
    });

    it('automatically disables the cancel button exactly when the 180-second window expires', () => {
      render(<OrderDetailsCancellation {...defaultProps} />);
      
      const cancelButton = screen.getByRole('button', { name: /confirm cancellation/i });
      const timer = screen.getByRole('timer');

      // Advance to 179 seconds
      act(() => { jest.advanceTimersByTime(179000); });
      expect(timer).toHaveTextContent('0:01');
      expect(cancelButton).toBeEnabled();

      // Advance to 180 seconds (Exact boundary — still allowed per REQ10)
      act(() => { jest.advanceTimersByTime(1000); });
      expect(timer).toHaveTextContent('0:00');
      expect(cancelButton).toBeEnabled(); 

      // Advance to 181 seconds (Window Expired)
      act(() => { jest.advanceTimersByTime(1000); });
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Error & Edge Case Handling (Crucial Backend Mocks)', () => {
    it('displays IDOR fallback error for 403 ORDER_ACCESS_DENIED', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: {
            code: 'ORDER_ACCESS_DENIED',
            message: 'You do not have permission to cancel this order.'
          }
        })
      });

      const user = setupUser();
      render(<OrderDetailsCancellation {...defaultProps} />);
      
      await user.click(screen.getByRole('button', { name: /confirm cancellation/i }));

      const errorBanner = await screen.findByRole('alert');
      expect(errorBanner).toHaveTextContent('You do not have permission to cancel this order.');
    });

    it('displays guard failure error for 409 ORDER_ALREADY_ACCEPTED', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          error: {
            code: 'ORDER_ALREADY_ACCEPTED',
            message: 'This order has already been accepted by the restaurant and cannot be cancelled.'
          }
        })
      });

      const user = setupUser();
      render(<OrderDetailsCancellation {...defaultProps} />);
      
      await user.click(screen.getByRole('button', { name: /confirm cancellation/i }));

      const errorBanner = await screen.findByRole('alert');
      expect(errorBanner).toHaveTextContent('This order has already been accepted by the restaurant and cannot be cancelled.');
    });

    it('displays guard failure error for 409 CANCELLATION_WINDOW_EXPIRED', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          error: {
            code: 'CANCELLATION_WINDOW_EXPIRED',
            message: 'The 3-minute cancellation window for this order has closed.'
          }
        })
      });

      const user = setupUser();
      render(<OrderDetailsCancellation {...defaultProps} />);
      
      await user.click(screen.getByRole('button', { name: /confirm cancellation/i }));

      const errorBanner = await screen.findByRole('alert');
      expect(errorBanner).toHaveTextContent('The 3-minute cancellation window for this order has closed.');
    });

    it('displays retry prompt for 502 REFUND_FAILED and preserves PENDING status (Atomicity Guard)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({
          error: {
            code: 'REFUND_FAILED',
            message: 'We could not process your cancellation at this time. Please try again.',
            details: { current_status: 'PENDING' }
          }
        })
      });

      const user = setupUser();
      render(<OrderDetailsCancellation {...defaultProps} />);
      
      await user.click(screen.getByRole('button', { name: /confirm cancellation/i }));

      const errorBanner = await screen.findByRole('alert');
      expect(errorBanner).toHaveTextContent('We could not process your cancellation at this time. Please try again.');
      
      // Verify the UI safely preserves PENDING instead of advancing to cancelled
      expect(screen.getByTestId('order-status-badge')).toHaveTextContent('PENDING');
    });
  });

  describe('Happy Path (HTTP 200)', () => {
    it('successfully cancels the order, updates UI status to CANCELLED, and shows gateway message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          order: {
            order_id: 'ORD-20260510-001',
            status: 'CANCELLED',
            cancelled_at: '2026-05-10T14:34:47Z',
            refund: { status: 'INITIATED' }
          },
          message: 'Your order has been cancelled. A refund of 150.00 EGP has been initiated.'
        })
      });

      const user = setupUser();
      render(<OrderDetailsCancellation {...defaultProps} />);
      
      await user.click(screen.getByRole('button', { name: /confirm cancellation/i }));

      // Verify the specific server success string is rendered
      const successBanner = await screen.findByRole('status', { name: /success message/i });
      expect(successBanner).toHaveTextContent('Your order has been cancelled. A refund of 150.00 EGP has been initiated.');

      // Verify the badge flips state
      expect(screen.getByTestId('order-status-badge')).toHaveTextContent('CANCELLED');
    });
  });

  describe('Accessibility (a11y)', () => {
    it('supports keyboard navigation ensuring the cancel button is focusable', async () => {
      const user = setupUser();
      render(<OrderDetailsCancellation {...defaultProps} />);
      
      const cancelButton = screen.getByRole('button', { name: /confirm cancellation/i });
      
      // Navigate via standard browser focus mechanisms
      cancelButton.focus();
      expect(cancelButton).toHaveFocus();
    });
  });
});
