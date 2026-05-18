import { isCancellationAllowed, formatCancellationWindow, getStatusBadgeClass } from './orderCancellation.utils';

describe('orderCancellation.utils', () => {

  describe('isCancellationAllowed', () => {
    // REQ10 Guard 1 & Guard 2 Rules: 
    // - Status must be exactly 'PENDING'
    // - Elapsed time since creation must be <= 180 seconds
    
    it('returns true when status is PENDING and elapsed time is 179s', () => {
      expect(isCancellationAllowed('PENDING', 179)).toBe(true);
    });

    it('returns true when status is PENDING and elapsed time is exactly 180s (boundary inclusive)', () => {
      expect(isCancellationAllowed('PENDING', 180)).toBe(true);
    });

    it('returns false when status is PENDING but elapsed time is 181s (boundary exceeded)', () => {
      expect(isCancellationAllowed('PENDING', 181)).toBe(false);
    });

    it('returns false for any non-PENDING status, even if within the 180s time window', () => {
      expect(isCancellationAllowed('ACCEPTED', 60)).toBe(false);
      expect(isCancellationAllowed('IN_PREPARATION', 100)).toBe(false);
      expect(isCancellationAllowed('OUT_FOR_DELIVERY', 150)).toBe(false);
      expect(isCancellationAllowed('DELIVERED', 170)).toBe(false);
      expect(isCancellationAllowed('CANCELLED', 120)).toBe(false);
    });
  });

  describe('formatCancellationWindow', () => {
    it('formats remaining seconds into a human-readable m:ss countdown format', () => {
      expect(formatCancellationWindow(180)).toBe('3:00');
      expect(formatCancellationWindow(179)).toBe('2:59');
      expect(formatCancellationWindow(65)).toBe('1:05');
      expect(formatCancellationWindow(9)).toBe('0:09');
      expect(formatCancellationWindow(0)).toBe('0:00');
    });

    it('returns 0:00 for negative seconds (failsafe for expired windows)', () => {
      expect(formatCancellationWindow(-5)).toBe('0:00');
    });
  });

  describe('getStatusBadgeClass', () => {
    it('returns the correct UI styling class for PENDING', () => {
      expect(getStatusBadgeClass('PENDING')).toContain('bg-surface-variant');
    });

    it('returns the correct UI styling class for CANCELLED', () => {
      expect(getStatusBadgeClass('CANCELLED')).toContain('bg-error-container');
    });

    it('returns the correct UI styling class for ACCEPTED', () => {
      expect(getStatusBadgeClass('ACCEPTED')).toContain('bg-primary-container');
    });
  });
});
