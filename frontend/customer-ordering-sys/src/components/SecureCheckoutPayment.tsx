import React, { useState, useEffect } from 'react';

import DigitalCard from './DigitalCard';
import PaymentForm from './PaymentForm';
import OrderSummary from './OrderSummary';
import DeliverySection from './DeliverySection';
import { useCreditCardValidation } from '../hooks/useCreditCardValidation';
import { useCharacterLimit } from '../hooks/useCharacterLimit';
import { CartItem } from '../utils/checkout.utils';

interface Order {
  id: string;
  status: 'CONFIRMED' | 'FAILED' | 'PENDING';
  total: number;
}

interface SecureCheckoutPaymentProps {
  cartItems: CartItem[];
  onOrderConfirmed?: (order: Order) => void;
  serverUtcHour?: number;
}

const SecureCheckoutPayment: React.FC<SecureCheckoutPaymentProps> = ({
  cartItems,
  onOrderConfirmed,
  serverUtcHour = new Date().getUTCHours(),
}) => {
  const cardValidation = useCreditCardValidation();
  const instructionsLimit = useCharacterLimit('', 500);
  const notesLimit = useCharacterLimit('', 500);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unavailableItems, setUnavailableItems] = useState<string[]>([]);

  // Simulate pre-checkout availability refresh (Requirement REQ20)
  useEffect(() => {
    const unavailable = cartItems
      .filter((item) => item.id === 'I002')
      .map((item) => item.id);
    setUnavailableItems(unavailable);
  }, [cartItems]);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setGlobalError(null);


    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cartItems,
          clientTotal: cartItems.reduce((s, i) => s + i.qty * (i.price ?? 0), 0),
          special_instructions: instructionsLimit.value,
          specialInstructions: instructionsLimit.value,
          delivery_notes: notesLimit.value,
          deliveryNotes: notesLimit.value,
          serverUtcHour,
        }),

      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const msg = body.message || `Request failed (${response.status})`;
        setGlobalError(msg);
        setIsSubmitting(false);
        return;
      }

      const order: Order = await response.json();
      onOrderConfirmed?.(order);
      setIsSubmitting(false);

    } catch (err) {
      setGlobalError((err as Error).message || 'Network error');
      setIsSubmitting(false);
    }
  };

  const hasUnavailable = unavailableItems.length > 0;

  return (
    <div data-testid="checkout-form" className="grid grid-cols-1 lg:grid-cols-12 gap-lg items-start">
      {/* Left Column */}
      <div className="lg:col-span-7 space-y-lg">
        <div className="space-y-sm">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Secure Checkout</h1>
          <p className="text-on-surface-variant font-body-lg text-body-lg">
            Complete your reservation for the Michelin-starred experience.
          </p>
        </div>

        {hasUnavailable && (
          <div role="alert" data-testid="unavailable-warning" className="bg-error-container text-on-error-container p-md rounded-xl border border-error/20">
            Item {unavailableItems.join(', ')} is unavailable. Please remove it before continuing.
          </div>
        )}

        <DigitalCard
          cardholder={cardValidation.cardholder}
          cardNumber={cardValidation.cardNumber}
          expiry={cardValidation.expiry}
          cardType={cardValidation.cardType}
        />

        <DeliverySection />

        <div className="glass-card p-lg rounded-xl space-y-md shadow-2xl">
          <div className="space-y-xs">
            <label className="font-label-caps text-label-caps text-on-surface-variant">
              Special Instructions
            </label>
            <textarea
              data-testid="special-instructions"
              maxLength={500}
              className="w-full bg-surface-container-lowest border-outline-variant/30 text-on-surface rounded-lg px-md py-sm focus:ring-primary focus:border-primary transition-all duration-300 min-h-[100px]"
              placeholder="Allergies, seating preferences, etc."
              value={instructionsLimit.value}
              onChange={instructionsLimit.onChange}
              aria-label="Special Instructions"
            />
            <div className="flex justify-end">
              <span data-testid="instructions-counter" className="text-xs text-on-surface-variant">
                {instructionsLimit.length}/500
              </span>
            </div>
          </div>

          <div className="space-y-xs">
            <label className="font-label-caps text-label-caps text-on-surface-variant">
              Delivery Notes
            </label>
            <textarea
              data-testid="delivery-notes"
              maxLength={500}
              className="w-full bg-surface-container-lowest border-outline-variant/30 text-on-surface rounded-lg px-md py-sm focus:ring-primary focus:border-primary transition-all duration-300 min-h-[80px]"
              placeholder="Gate code, floor number, etc."
              value={notesLimit.value}
              onChange={notesLimit.onChange}
              aria-label="Delivery Notes"
            />
            <div className="flex justify-end">
              <span data-testid="delivery-counter" className="text-xs text-on-surface-variant">
                {notesLimit.length}/500
              </span>
            </div>
          </div>
        </div>

        <PaymentForm
          cardholder={cardValidation.cardholder}
          onCardholderChange={(e) => cardValidation.setCardholder(e.target.value)}
          cardNumber={cardValidation.cardNumber}
          onCardNumberChange={cardValidation.handleCardNumberChange}
          expiry={cardValidation.expiry}
          onExpiryChange={cardValidation.handleExpiryChange}
          cvv={cardValidation.cvv}
          onCvvChange={cardValidation.handleCvvChange}
        />

        {globalError && (
          <p role="alert" data-testid="checkout-error" className="text-error bg-error-container/20 p-md rounded-lg border border-error/20 font-medium">
            {globalError}
          </p>
        )}
      </div>

      {/* Right Column */}
      {!hasUnavailable && (
        <OrderSummary
          cartItems={cartItems}
          isSubmitting={isSubmitting}
          onConfirm={handleSubmit}
          isDisabled={!cardValidation.isValid}
        />
      )}
    </div>
  );
};

export default SecureCheckoutPayment;
