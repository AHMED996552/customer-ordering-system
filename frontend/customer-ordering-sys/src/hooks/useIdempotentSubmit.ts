import { useState, useCallback } from 'react';

export function useIdempotentSubmit<T>(submitFn: (...args: any[]) => Promise<T>) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const execute = useCallback(async (...args: any[]) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      return await submitFn(...args);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, submitFn]);

  return {
    isSubmitting,
    execute,
  };
}
