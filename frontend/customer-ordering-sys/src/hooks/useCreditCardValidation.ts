import { useState, useCallback, useMemo } from 'react';
import { 
  detectCardType, 
  luhn, 
  validateExpiry, 
  validateCvv, 
  cvvLength 
} from '../utils/checkout.utils';

export function useCreditCardValidation() {
  const [cardholder, setCardholder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  const cardType = useMemo(() => detectCardType(cardNumber), [cardNumber]);

  const handleCardNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    // Format with spaces
    const parts = value.match(/.{1,4}/g);
    if (parts) value = parts.join(' ');
    setCardNumber(value.slice(0, 19)); // 16 digits + 3 spaces
  }, []);

  const handleExpiryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value;
    
    // If deleting the slash, remove the preceding digit as well
    if (expiry.endsWith('/') && input.length === expiry.length - 1) {
      input = input.slice(0, -1);
    }

    let value = input.replace(/\D/g, '');
    
    if (value.length > 0) {
      // Month validation
      if (value.length >= 2) {
        let monthNum = parseInt(value.slice(0, 2), 10);
        if (monthNum > 12) monthNum = 12;
        if (monthNum === 0) monthNum = 1;
        value = monthNum.toString().padStart(2, '0') + value.slice(2);
      }
      
      // Year validation
      if (value.length >= 4) {
        let yearNum = parseInt(value.slice(2, 4), 10);
        const currentYearShort = new Date().getFullYear() % 100;
        const maxYearShort = currentYearShort + 4;
        if (yearNum > maxYearShort) yearNum = maxYearShort;
        value = value.slice(0, 2) + yearNum.toString().padStart(2, '0');
      }

      // Format with slash
      if (value.length >= 2) {
        value = value.slice(0, 2) + '/' + value.slice(2, 4);
      }
    }
    
    setExpiry(value.slice(0, 5));
  }, [expiry]);

  const handleCvvChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setCvv(value.slice(0, cvvLength(cardType)));
  }, [cardType]);

  const errors = useMemo(() => {
    const rawNumber = cardNumber.replace(/\D/g, '');
    const errs: Record<string, string> = {};

    if (!cardholder.trim()) {
      errs.cardholder = 'Cardholder name is required';
    }

    if (!rawNumber) {
      errs.cardNumber = 'Card number is required';
    } else if (rawNumber.length < 13 || !luhn(rawNumber)) {
      errs.cardNumber = 'Invalid card number';
    }

    const expiryCheck = validateExpiry(expiry);
    if (!expiry) {
      errs.expiry = 'Expiry date is required';
    } else if (!expiryCheck.valid) {
      errs.expiry = expiryCheck.error || 'Invalid expiry date';
    }

    if (!cvv) {
      errs.cvv = 'CVV is required';
    } else if (!validateCvv(cvv, cardType)) {
      errs.cvv = `Invalid CVV (must be ${cvvLength(cardType)} digits)`;
    }

    return errs;
  }, [cardholder, cardNumber, expiry, cvv, cardType]);

  const isValid = Object.keys(errors).length === 0;

  return {
    cardholder,
    setCardholder,
    cardNumber,
    handleCardNumberChange,
    expiry,
    handleExpiryChange,
    cvv,
    handleCvvChange,
    cardType,
    isValid,
    errors,
  };
}
