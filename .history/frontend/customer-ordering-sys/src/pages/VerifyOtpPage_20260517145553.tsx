import React, { FormEvent, useState } from 'react';
import { verifyOtp } from '../api/auth';

interface VerifyOtpPageProps {
  defaultEmail?: string;
}

export function VerifyOtpPage({ defaultEmail = '' }: VerifyOtpPageProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [otpCode, setOtpCode] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const response = await verifyOtp({ email, otp_code: otpCode });
      setSuccessMessage(response.message);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Unable to verify OTP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-white shadow rounded-lg">
      <h1 className="text-2xl font-semibold mb-4">Verify your account</h1>

      {successMessage ? (
        <div role="status" className="mb-4 rounded-md bg-green-100 p-4 text-green-800">
          {successMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div role="alert" className="mb-4 rounded-md bg-red-100 p-4 text-red-800">
          {errorMessage}
        </div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <label className="block mb-3">
          <span className="text-sm font-medium">Email</span>
          <input
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="hello@example.com"
            className="mt-1 block w-full rounded border p-2"
          />
        </label>

        <label className="block mb-3">
          <span className="text-sm font-medium">OTP code</span>
          <input
            name="otp_code"
            value={otpCode}
            onChange={(event) => setOtpCode(event.target.value)}
            placeholder="123456"
            className="mt-1 block w-full rounded border p-2"
          />
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 inline-flex items-center justify-center rounded bg-sky-600 px-4 py-2 text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Verifying...' : 'Verify OTP'}
        </button>
      </form>
    </div>
  );
}
