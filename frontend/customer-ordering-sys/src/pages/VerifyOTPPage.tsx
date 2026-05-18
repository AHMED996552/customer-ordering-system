import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Spinner } from '../components/Spinner';
import { Lock } from 'lucide-react';

export default function VerifyOTPPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Extract email from router state
  const email = location.state?.email || '';

  // Input state
  const [otp, setOtp] = useState('');
  const [isTouched, setIsTouched] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Expiry / Resend Timer state
  const [countdown, setCountdown] = useState(59);

  // Status/Request state
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Timer countdown hook
  useEffect(() => {
    if (countdown === 0) return;

    const interval = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [countdown]);

  // Validation on input change
  useEffect(() => {
    if (isTouched || otp.length >= 6) {
      if (otp.length !== 6) {
        setValidationError('OTP must be exactly 6 digits.');
      } else {
        setValidationError(null);
      }
    }
  }, [otp, isTouched]);

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    setOtp(val);
  };

  const handleBlur = () => {
    setIsTouched(true);
  };

  const handleResend = async () => {
    if (countdown > 0 || isLoading) return;

    setIsLoading(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/v1/auth/resend-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(
          data.message || 'Verification code resent successfully.'
        );
        setCountdown(59);
      } else {
        setServerError(
          data.error || 'Failed to resend code. Please try again.'
        );
      }
    } catch (err) {
      setServerError(
        'Something went wrong. Network error, please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (otp.length !== 6 || isLoading) return;

    setIsLoading(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/v1/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          otp_code: otp,
        }),
      });

      const data = await response.json();

      if (response.ok || response.status === 200) {
        setSuccessMessage(
          data.message || 'Account verified successfully'
        );

        setOtp('');
        setIsTouched(false);

        setTimeout(() => {
          if (data.user?.status === 'ACTIVE') {
            navigate('/dashboard');
          } else {
            navigate('/login');
          }
        }, process.env.NODE_ENV === 'test' ? 100 : 800);
      } else if (response.status === 400) {
        if (data.error_code === 'OTP_EXPIRED') {
          setServerError(
            'OTP has expired. Please request a new one.'
          );
        } else {
          setServerError(
            'Invalid OTP code. Please try again.'
          );
        }
      } else if (response.status === 404) {
        setServerError('User not found.');
      } else {
        setServerError(
          'Something went wrong. Please try again.'
        );
      }
    } catch (err) {
      setServerError(
        'Something went wrong. Network error, please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Missing email fallback
  if (!email) {
    return (
      <main className="min-h-screen w-screen flex items-center justify-center p-md">
        <div className="w-full max-w-lg">
          <div className="glass-island rounded-[32px] p-xl flex flex-col items-center text-center w-full">
            <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mb-md border border-error/20">
              <span className="material-symbols-outlined text-error text-3xl">
                error
              </span>
            </div>

            <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight mb-md">
              Authentication Error
            </h2>

            <p className="font-body-md text-body-md text-on-surface-variant mb-lg">
              We could not find a registered email for this session.
              Please return to the previous step.
            </p>

            <button
              onClick={() => navigate('/register')}
              className="shimmer-btn w-full py-md bg-primary text-on-primary font-label-caps text-label-caps rounded-2xl shadow-[0_8px_32px_rgba(175,198,252,0.25)] hover:scale-[1.02] active:scale-95 transition-all"
            >
              Go Back
            </button>
          </div>
        </div>
      </main>
    );
  }

  const isVerifyDisabled = otp.length !== 6 || isLoading;

  return (
    <main className="min-h-screen w-screen flex items-center justify-center p-md">
      <div className="w-full max-w-lg">
        {/* Verification Card */}
        <div className="glass-island rounded-[32px] p-xl flex flex-col items-center text-center w-full relative overflow-hidden">
          {/* Glow Line */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>

          {/* Icon */}
          <div className="w-16 h-16 bg-primary-container rounded-full flex items-center justify-center mb-md shadow-[0_0_30px_rgba(1,31,75,0.5)] border border-primary/20">
            <Lock className="text-primary w-8 h-8" />
          </div>

          {/* Heading */}
          <div className="mb-lg space-y-sm">
            <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">
              Verify Your Identity
            </h2>

            <p className="font-body-md text-body-md text-on-surface-variant max-w-xs mx-auto">
              Enter the 6-digit code sent to your registered device.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="w-full space-y-md">
            {/* Success */}
            {successMessage && (
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl text-primary text-sm">
                {successMessage}
              </div>
            )}

            {/* Error */}
            {serverError && (
              <div className="p-4 bg-error/10 border border-error/20 rounded-xl text-error text-sm">
                {serverError}
              </div>
            )}

            {/* OTP */}
            <div className="relative w-full max-w-[320px] mx-auto mb-lg">
              <div className="flex gap-sm justify-between pointer-events-none">
                {[0, 1, 2, 3, 4, 5].map((index) => {
                  const char = otp[index] || '';
                  const isFocused = otp.length === index;

                  return (
                    <div
                      key={index}
                      className={`w-11 h-14 md:w-12 md:h-16 bg-surface-container-lowest text-center flex items-center justify-center font-headline-md text-headline-md text-primary border rounded-xl transition-all ${
                        isFocused
                          ? 'border-primary shadow-[0_0_15px_rgba(175,198,252,0.3)] bg-primary-container/20'
                          : 'border-outline-variant/30'
                      }`}
                    >
                      {char || '·'}
                    </div>
                  );
                })}
              </div>

              <input
                type="text"
                id="otp_code"
                value={otp}
                onChange={handleOtpChange}
                onBlur={handleBlur}
                aria-label="Verification Code"
                className="absolute inset-0 w-full h-full opacity-0 cursor-text focus:outline-none"
                disabled={isLoading}
                ref={inputRef}
                autoComplete="one-time-code"
              />
            </div>

            {/* Validation */}
            {validationError && (
              <p className="text-error text-xs text-center mb-md">
                {validationError}
              </p>
            )}

            {/* Button */}
            <button
              type="submit"
              disabled={isVerifyDisabled}
              aria-label="Verify & Access"
              className={`shimmer-btn w-full py-md bg-primary text-on-primary font-label-caps text-label-caps rounded-2xl shadow-[0_8px_32px_rgba(175,198,252,0.25)] transition-all flex items-center justify-center gap-2 ${
                isVerifyDisabled
                  ? 'opacity-50 cursor-not-allowed scale-100'
                  : 'hover:scale-[1.02] active:scale-95'
              }`}
            >
              {isLoading ? (
                <>
                  <Spinner />
                  <span>Verifying...</span>
                </>
              ) : (
                'VERIFY & ACCESS'
              )}
            </button>
          </form>

          {/* Resend */}
          <div className="space-y-md mt-md w-full">
            {countdown > 0 ? (
              <div className="flex items-center justify-center gap-xs font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
                <span className="material-symbols-outlined text-sm select-none">
                  schedule
                </span>

                <span>
                  Resend code in 00:
                  {countdown.toString().padStart(2, '0')}
                </span>
              </div>
            ) : (
              <p className="font-body-md text-body-md text-on-surface-variant/80">
                Didn't receive the code?{' '}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isLoading}
                  className="text-primary font-semibold hover:underline decoration-primary/30 transition-all focus:outline-none"
                >
                  Resend
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Footer Icons */}
        <div className="mt-lg flex justify-center gap-md opacity-20 select-none">
          <span className="material-symbols-outlined text-on-surface-variant">
            fingerprint
          </span>

          <span className="material-symbols-outlined text-on-surface-variant">
            lock
          </span>

          <span className="material-symbols-outlined text-on-surface-variant">
            key
          </span>
        </div>
      </div>
    </main>
  );
}
