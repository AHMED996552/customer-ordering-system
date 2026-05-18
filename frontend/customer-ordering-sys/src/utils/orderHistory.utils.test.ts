import { formatOrderDate, formatCurrency, getStatusColor } from './orderHistory.utils';

describe('Order History Utilities', () => {
    describe('formatOrderDate', () => {
        it('formats ISO string to short date (e.g., OCT 05)', () => {
            const isoString = '2023-10-05T14:30:00Z';
            expect(formatOrderDate(isoString, 'short')).toBe('OCT 05');
        });

        it('formats ISO string to full date time (e.g., Oct 12, 2023 • 8:45 PM)', () => {
            const isoString = '2023-10-12T20:45:00Z';
            expect(formatOrderDate(isoString, 'full')).toBe('Oct 12, 2023 • 8:45 PM');
        });

        it('handles invalid date strings gracefully', () => {
            const result = formatOrderDate('invalid-date', 'short');
            expect(result).toBe('Invalid Date');
        });
    });

    describe('formatCurrency', () => {
        it('formats whole numbers to EGP currency string', () => {
            expect(formatCurrency(312)).toMatch(/\$312\.00/);
        });

        it('formats decimal numbers properly', () => {
            expect(formatCurrency(1234.5)).toMatch(/\$1234\.50/);
        });

        it('handles zero value', () => {
            expect(formatCurrency(0)).toMatch(/\$0\.00/);
        });
    });

    describe('getStatusColor', () => {
        it('returns correct classes for DELIVERED status', () => {
            const styles = getStatusColor('DELIVERED');
            expect(styles.bg).toContain('bg-green-500/10');
            expect(styles.text).toContain('text-green-400');
        });

        it('returns correct classes for CANCELLED status', () => {
            const styles = getStatusColor('CANCELLED');
            expect(styles.text).toContain('text-error');
        });

        it('returns default fallback classes for unknown status', () => {
            const styles = getStatusColor('UNKNOWN');
            expect(styles.text).toContain('text-on-surface-variant');
        });
    });
});
