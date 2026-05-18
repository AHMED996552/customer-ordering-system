import React, { useState } from 'react';
import { RegisterPage } from './RegisterPage';
import { VerifyOtpPage } from './VerifyOtpPage';

export function RegistrationFlow() {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'register' | 'verify'>('register');

  const handleRegisterSuccess = (registeredEmail: string) => {
    setEmail(registeredEmail);
    setStep('verify');
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      {step === 'register' ? (
        <RegisterPage onSuccess={handleRegisterSuccess} />
      ) : (
        <div className="space-y-4">
          <div className="max-w-lg mx-auto rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold">Almost there</h2>
            <p className="mt-2 text-sm text-slate-600">We sent a verification code to {email}. Enter it below to activate your account.</p>
          </div>
          <VerifyOtpPage defaultEmail={email} />
        </div>
      )}
    </div>
  );
}
