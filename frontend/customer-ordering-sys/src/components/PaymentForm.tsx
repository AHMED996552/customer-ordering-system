import React from 'react';

interface PaymentFormProps {
  cardholder: string;
  onCardholderChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  cardNumber: string;
  onCardNumberChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  expiry: string;
  onExpiryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  cvv: string;
  onCvvChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({
  cardholder,
  onCardholderChange,
  cardNumber,
  onCardNumberChange,
  expiry,
  onExpiryChange,
  cvv,
  onCvvChange,
}) => {
  return (
    <div className="glass-card p-lg rounded-xl space-y-md shadow-2xl mt-lg">
      <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest mb-md">
        Payment Method
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <div className="space-y-xs col-span-full">
          <label className="font-label-caps text-label-caps text-on-surface-variant">
            Cardholder Name
          </label>
          <input
            className="w-full bg-surface-container-lowest border-outline-variant/30 text-on-surface rounded-lg px-md py-sm focus:ring-primary focus:border-primary transition-all duration-300"
            placeholder="Julian Thorne"
            type="text"
            value={cardholder}
            onChange={onCardholderChange}
          />
        </div>
        <div className="space-y-xs col-span-full">
          <label className="font-label-caps text-label-caps text-on-surface-variant">
            Card Number
          </label>
          <div className="relative">
            <input
              className="w-full bg-surface-container-lowest border-outline-variant/30 text-on-surface rounded-lg px-md py-sm focus:ring-primary focus:border-primary transition-all duration-300"
              placeholder="4532 8821 9904 8821"
              type="text"
              value={cardNumber}
              onChange={onCardNumberChange}
            />
            <div className="absolute right-md top-1/2 -translate-y-1/2 flex gap-xs">
              <div className="w-6 h-4 bg-secondary/20 rounded-sm"></div>
              <div className="w-6 h-4 bg-tertiary/20 rounded-sm"></div>
            </div>
          </div>
        </div>
        <div className="space-y-xs">
          <label className="font-label-caps text-label-caps text-on-surface-variant">
            Expiry Date
          </label>
          <input
            className="w-full bg-surface-container-lowest border-outline-variant/30 text-on-surface rounded-lg px-md py-sm focus:ring-primary focus:border-primary transition-all duration-300"
            placeholder="MM/YY"
            type="text"
            value={expiry}
            onChange={onExpiryChange}
          />
        </div>
        <div className="space-y-xs">
          <label className="font-label-caps text-label-caps text-on-surface-variant">CVV</label>
          <div className="relative">
            <input
              className="w-full bg-surface-container-lowest border-outline-variant/30 text-on-surface rounded-lg px-md py-sm focus:ring-primary focus:border-primary transition-all duration-300"
              placeholder="•••"
              type="text"
              value={cvv}
              onChange={onCvvChange}
            />

          </div>
        </div>
      </div>
      <div className="flex items-center gap-sm pt-md">
        <input
          className="rounded border-outline-variant/30 bg-surface-container-lowest text-primary focus:ring-primary"
          id="save-card"
          type="checkbox"
        />
        <label className="font-body-md text-on-surface-variant text-sm" htmlFor="save-card">
          Securely save card for future reservations
        </label>
      </div>
    </div>
  );
};

export default PaymentForm;
