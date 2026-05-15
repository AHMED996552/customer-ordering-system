import React, { useState, useEffect } from 'react';

import DigitalCard from '../components/DigitalCard';
import PaymentForm from '../components/PaymentForm';
import OrderSummary from '../components/OrderSummary';
import DeliverySection from '../components/DeliverySection';
import { useCreditCardValidation } from '../hooks/useCreditCardValidation';
import { useCharacterLimit } from '../hooks/useCharacterLimit';
import { CartItem } from '../utils/checkout.utils';
import { checkout, CheckoutError } from '../api/checkout';
import ErrorModal from '../components/ErrorModal';

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
  const [showUnavailableModal, setShowUnavailableModal] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isLocationConfirmed, setIsLocationConfirmed] = useState(false);

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  // Simulate pre-checkout availability refresh (Requirement REQ20)
  useEffect(() => {
    const unavailable = cartItems
      .filter((item) => item.id === 'I003')
      .map((item) => item.id);
    setUnavailableItems(unavailable);
    if (unavailable.length > 0) {
      setShowUnavailableModal(true);
    }
  }, [cartItems]);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setGlobalError(null);


    try {
      const total = cartItems.reduce((s, i) => s + (i.qty ?? 0) * (i.price ?? 0), 0);
      const result = await checkout(
        cartItems,
        total,
        instructionsLimit.value,
        notesLimit.value,
        serverUtcHour
      );

      onOrderConfirmed?.({
        id: result.order_id,
        status: result.status as 'CONFIRMED' | 'FAILED' | 'PENDING',
        total: total,
      });
      setIsSubmitting(false);

    } catch (err) {
      const error = err as CheckoutError;
      let msg = error.message || 'An unexpected error occurred';

      // REQ: Handle specific error codes
      if (error.code === 'ITEM_UNAVAILABLE') {
        msg = 'Some items in your cart are no longer available. Please remove them and try again.';
      } else if (error.code === 'STORE_CLOSED') {
        msg = 'The restaurant is currently closed. We only accept orders between 10:00 and 22:00 UTC.';
      } else if (error.code === 'IDEMPOTENCY_CONFLICT') {
        msg = 'This order is already being processed. Please check your order history.';
      } else if (error.code === 'PAYMENT_DECLINED') {
        msg = 'Your payment was declined. Please check your card details and try again.';
      }

      setGlobalError(msg);
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

        <ErrorModal
          isOpen={showUnavailableModal}
          onClose={() => setShowUnavailableModal(false)}
          title="Items Unavailable"
          message={`Item ${unavailableItems.join(', ')} is unavailable. Please remove it before continuing.`}
          testId="unavailable-warning"
        />

        <DigitalCard
          cardholder={cardValidation.cardholder}
          cardNumber={cardValidation.cardNumber}
          expiry={cardValidation.expiry}
          cardType={cardValidation.cardType}
        />

        <DeliverySection onLocationConfirmed={setIsLocationConfirmed} />

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
          cardType={cardValidation.cardType}
          errors={cardValidation.errors}
          touched={touched}
          onBlur={handleBlur}
        />

        <ErrorModal
          isOpen={!!globalError}
          onClose={() => setGlobalError(null)}
          title="Payment Error"
          message={globalError || ''}
          testId="checkout-error"
        />
      </div>

      {/* Right Column */}
      {!hasUnavailable && (
        <OrderSummary
          cartItems={cartItems}
          isSubmitting={isSubmitting}
          onConfirm={handleSubmit}
          isDisabled={!cardValidation.isValid || !isLocationConfirmed}
          showErrorHint={Object.keys(touched).length > 0 || isLocationConfirmed}
        />
      )}
    </div>
  );
};

export default SecureCheckoutPayment;
