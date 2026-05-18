/**
 * Validation utilities for LuxeEats frontend.
 */

export const validateEmail = (email: string): string | null => {
  if (!email) return 'Email is required';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }
  return null;
};

export const validatePassword = (password: string): string[] => {
  const errors: string[] = [];
  if (!password) {
    errors.push('Password is required');
    return errors;
  }
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  return errors;
};

export const validatePhoneNumber = (phone: string): string | null => {
  if (!phone) return 'Phone number is required';
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length > 11) {
    return 'Phone number must not exceed 11 digits';
  }
  return null;
};
