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
  cardType: string;
  errors?: Record<string, string>;
  touched: Record<string, boolean>;
  onBlur: (field: string) => void;
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
  cardType,
  errors,
  touched,
  onBlur,
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
            onBlur={() => onBlur('cardholder')}
            aria-invalid={!!errors?.cardholder && touched.cardholder}
          />
          {errors?.cardholder && touched.cardholder && (
            <p className="text-error text-xs font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
              {errors.cardholder}
            </p>
          )}
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
              onBlur={() => onBlur('cardNumber')}
              aria-invalid={!!errors?.cardNumber && touched.cardNumber}
            />
            <div className="absolute right-md top-1/2 -translate-y-1/2 flex items-center">
              {cardType !== 'unknown' && (
                <span className="font-label-caps text-[10px] bg-secondary/20 text-secondary px-xs py-[2px] rounded border border-secondary/30 uppercase tracking-tighter">
                  {cardType}
                </span>
              )}
            </div>
          </div>
          {errors?.cardNumber && touched.cardNumber && (
            <p className="text-error text-xs font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
              {errors.cardNumber}
            </p>
          )}
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
            onBlur={() => onBlur('expiry')}
            aria-invalid={!!errors?.expiry && touched.expiry}
          />
          {errors?.expiry && touched.expiry && (
            <p className="text-error text-xs font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
              {errors.expiry}
            </p>
          )}
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
              onBlur={() => onBlur('cvv')}
              aria-invalid={!!errors?.cvv && touched.cvv}
            />
          </div>
          {errors?.cvv && touched.cvv && (
            <p className="text-error text-xs font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
              {errors.cvv}
            </p>
          )}
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
