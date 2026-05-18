import React, { useState, useEffect } from 'react';
import { isCancellationAllowed, formatCancellationWindow, getStatusBadgeClass } from '../utils/orderCancellation.utils';

export interface OrderDetailsCancellationProps {
  orderId: string;
  initialStatus: string;
  createdAtUtc: string;
  totalAmount: number;
}

const OrderDetailsCancellation: React.FC<OrderDetailsCancellationProps> = ({
  orderId,
  initialStatus,
  createdAtUtc,
  totalAmount,
}) => {
  const [status, setStatus] = useState<string>(initialStatus);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  useEffect(() => {
    const calculateElapsed = () => {
      const created = new Date(createdAtUtc).getTime();
      const now = Date.now();
      return Math.floor((now - created) / 1000);
    };

    setElapsedSeconds(calculateElapsed());

    const interval = setInterval(() => {
      setElapsedSeconds(calculateElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [createdAtUtc]);

  const handleCancel = async () => {
    setIsCancelling(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/v1/orders/${orderId}/cancel`, {
        method: 'POST',
      });
      
      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data?.error?.message || 'An error occurred');
      } else {
        setStatus(data?.order?.status || 'CANCELLED');
        setSuccessMessage(data?.message);
      }
    } catch (error) {
      setErrorMessage('A network error occurred. Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  const remainingSeconds = Math.max(0, 180 - elapsedSeconds);
  const canCancel = isCancellationAllowed(status, elapsedSeconds) && !isCancelling;

  return (
    <main role="main" className="w-full max-w-[600px] glass-card rounded-xl p-md sm:p-lg flex flex-col gap-md">
      {/* Alerts/Banners */}
      {errorMessage && (
        <div role="alert" aria-live="assertive" id="error-banner" className="bg-error-container text-on-error-container p-sm rounded-lg text-body-md font-body-md border border-error/20">
          {errorMessage}
        </div>
      )}
      
      {successMessage && (
        <div role="status" aria-label="Success message" aria-live="polite" id="success-banner" className="bg-surface-variant text-on-surface p-sm rounded-lg text-body-md font-body-md border border-outline-variant/30">
          {successMessage}
        </div>
      )}

      {/* Header Section */}
      <div className="text-center mb-sm">
        <h2 className="font-headline-md text-headline-md text-on-surface mb-xs">Request Cancellation</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">Please review your order details before confirming cancellation.</p>
      </div>

      {/* Order Summary */}
      <div className="bg-surface-container-low rounded-lg p-md border border-outline-variant/30 flex justify-between items-center order-summary">
        <div>
          <span className="font-label-caps text-label-caps text-primary block mb-xs">Order Number</span>
          <span data-testid="order-id" className="font-body-lg text-body-lg text-on-surface font-medium">{orderId}</span>
        </div>
        
        <div className="text-center">
          <span className="font-label-caps text-label-caps text-primary block mb-xs">Status</span>
          <span 
            data-testid="order-status-badge" 
            className={`font-label-caps text-label-caps px-2 py-1 rounded-full ${getStatusBadgeClass(status)}`}
          >
            {status}
          </span>
        </div>

        <div className="text-right">
          <span className="font-label-caps text-label-caps text-primary block mb-xs">Time Remaining</span>
          <div 
            role="timer" 
            aria-label="Cancellation window countdown" 
            aria-live="polite"
            data-testid="cancellation-timer"
            className="font-body-lg text-body-lg text-on-surface font-medium"
          >
            {formatCancellationWindow(remainingSeconds)}
          </div>
        </div>
      </div>

      {/* Reason Selection */}
      <div className="flex flex-col gap-sm">
        <h3 className="font-body-md text-body-md text-on-surface font-medium">Reason for cancellation</h3>
        {['Change of mind', 'Ordered by mistake', 'Wait time too long', 'Other'].map((reason, idx) => (
          <label key={reason} className="flex items-center p-sm rounded-lg border border-outline-variant/30 bg-surface-container-lowest cursor-pointer hover:border-primary/50 transition-colors">
            <input defaultChecked={idx === 0} className="form-radio text-primary bg-transparent border-outline focus:ring-primary h-5 w-5" name="cancel_reason" type="radio" value={reason} />
            <span className="ml-sm font-body-md text-body-md text-on-surface">{reason}</span>
          </label>
        ))}
      </div>

      {/* Refund Summary */}
      <div className="bg-surface-container rounded-lg p-md mt-sm flex items-start gap-sm border border-outline-variant/20">
        <span className="material-symbols-outlined text-primary mt-1">info</span>
        <div>
          <h4 className="font-body-md text-body-md text-on-surface font-medium mb-xs">Refund Information</h4>
          <p className="font-body-md text-body-md text-on-surface-variant">
            The full amount of ${totalAmount.toFixed(2)} will be refunded to your original payment method. Please allow 3-5 business days for processing.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-sm mt-md actions">
        <button 
          type="button"
          className="flex-1 py-sm px-md rounded-full bg-transparent border border-outline text-on-surface font-label-caps text-label-caps hover:bg-surface-variant transition-colors"
        >
          Keep Order
        </button>
        <button 
          type="button" 
          role="button"
          aria-label="Confirm Cancellation"
          onClick={handleCancel}
          disabled={!canCancel}
          className={`flex-1 py-sm px-md rounded-full font-label-caps text-label-caps border transition-colors ${
            canCancel 
              ? 'bg-error-container text-on-error-container border-error/20 hover:bg-error-container/80' 
              : 'bg-surface-variant text-outline cursor-not-allowed border-transparent'
          }`}
        >
          Confirm Cancellation
        </button>
      </div>
    </main>
  );
};

export default OrderDetailsCancellation;
