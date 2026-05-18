export const isCancellationAllowed = (status: string, elapsedSeconds: number): boolean => {
  return status === 'PENDING' && elapsedSeconds <= 180;
};

export const formatCancellationWindow = (seconds: number): string => {
  if (seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const getStatusBadgeClass = (status: string): string => {
  switch (status) {
    case 'PENDING':
      return 'bg-surface-variant text-on-surface-variant';
    case 'CANCELLED':
      return 'bg-error-container text-on-error-container';
    case 'ACCEPTED':
      return 'bg-primary-container text-on-primary-container';
    default:
      return 'bg-surface-variant text-on-surface-variant';
  }
};
