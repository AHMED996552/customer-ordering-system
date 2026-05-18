import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../components/Input';
import { Spinner } from '../components/Spinner';
import { User, Mail, Phone, Lock, Eye, EyeOff } from 'lucide-react';
import {
  validateEmail,
  validatePassword,
  validatePhoneNumber,
} from '../utils/validators';

export default function RegisterPage() {
  const navigate = useNavigate();

  // Form states
  const [values, setValues] = useState({
    full_name: '',
    email: '',
    password: '',
    phone_number: '',
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({
    full_name: false,
    email: false,
    password: false,
    phone_number: false,
  });

  const [errors, setErrors] = useState<Record<string, string[]>>({
    full_name: [],
    email: [],
    password: [],
    phone_number: [],
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // Validate on values change
  useEffect(() => {
    const nameErrors = values.full_name.trim() === '' ? ['Full Name is required'] : [];
    
    const emailErr = validateEmail(values.email);
    const emailErrors = emailErr ? [emailErr] : [];
    
    const passwordErrors = validatePassword(values.password);
    
    const phoneErr = validatePhoneNumber(values.phone_number);
    const phoneErrors = phoneErr ? [phoneErr] : [];

    setErrors({
      full_name: nameErrors,
      email: emailErrors,
      password: passwordErrors,
      phone_number: phoneErrors,
    });
  }, [values]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setValues((prev) => ({ ...prev, [id]: value }));
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const isFormInvalid =
    !values.full_name ||
    !values.email ||
    !values.password ||
    !values.phone_number ||
    Object.values(errors).some((errList) => errList.length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormInvalid || isLoading) return;

    setIsLoading(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const rawText = await response.text();
      const data = rawText ? JSON.parse(rawText) : {};

      if (response.ok || response.status === 201) {
        setSuccessMessage(data.message || 'Please check your email to verify your account.');
        
        // Form reset / clear stale data
        setValues({
          full_name: '',
          email: '',
          password: '',
          phone_number: '',
        });
        setTouched({
          full_name: false,
          email: false,
          password: false,
          phone_number: false,
        });

        setTimeout(() => {
          navigate('/verify-otp', { state: { email: data.user?.email || values.email } });
        }, process.env.NODE_ENV === 'test' ? 100 : 800);
      } else if (response.status === 409) {
        setServerError('Email already exists. You are already registered.');
      } else if (response.status === 422) {
        if (data.error_code === 'VALIDATION_ERROR' && data.fields) {
          // Render backend field-level validation errors
          setErrors((prev) => ({
            ...prev,
            ...data.fields,
          }));
          // Make sure they are visible by touching the failed fields
          const updatedTouched: Record<string, boolean> = {};
          Object.keys(data.fields).forEach((key) => {
            updatedTouched[key] = true;
          });
          setTouched((prev) => ({ ...prev, ...updatedTouched }));
        } else {
          setServerError(data.message || 'Validation failed. Please verify your fields.');
        }
      } else {
        setServerError('Something went wrong. Please try again.');
      }
    } catch (err: any) {
      console.log('FETCH_ERROR_DETAILS', err?.message, err?.stack, err);
      setServerError('Something went wrong. Network error, please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative z-10 min-h-screen flex flex-col lg:flex-row items-stretch">
      {/* Left Section: Brand Editorial */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-lg xl:p-xl">
        <div>
          <h1 className="font-headline-md text-headline-md font-bold tracking-tight text-primary">
            LuxeEats
          </h1>
        </div>
        <div className="max-w-xl">
          <p className="font-label-caps text-label-caps text-primary tracking-[0.2em] mb-md">
            PRIVATE CULINARY ACCESS
          </p>
          <h2 className="font-display-xl text-display-xl mb-md">
            Taste the <br />
            <span className="text-primary italic">Extraordinary</span>
          </h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-md">
            Join an elite community of gastronomes. Access the world's most exclusive kitchens,
            private chefs, and hidden dining gems.
          </p>
        </div>
        <div className="flex gap-md">
          <div className="flex -space-x-4">
            <div className="w-12 h-12 rounded-full border-2 border-background bg-surface-container overflow-hidden">
              <span className="material-symbols-outlined text-primary text-xl flex items-center justify-center h-full">
                <img src="/assets/person1.jpg" alt="person1" />
              </span>
            </div>
            <div className="w-12 h-12 rounded-full border-2 border-background bg-surface-container overflow-hidden">
              <span className="material-symbols-outlined text-secondary text-xl flex items-center justify-center h-full">
                <img src="/assets/person2.jpg" alt="person2" />
              </span>
            </div>
            <div className="w-12 h-12 rounded-full border-2 border-background bg-surface-container overflow-hidden">
              <span className="material-symbols-outlined text-tertiary text-xl flex items-center justify-center h-full">
                <img src="/assets/person3.jpg" alt="person" />
              </span>
            </div>
          </div>
          <div className="flex flex-col justify-center">
            <span className="font-label-caps text-label-caps text-on-surface">5,000+ MEMBERS</span>
            <span className="text-xs text-on-surface-variant">Vetted Global Enthusiasts</span>
          </div>
        </div>
      </div>

      {/* Right Section: Form Floating Island */}
      <div className="flex-1 flex items-center justify-center p-md md:p-lg xl:p-xl">
        <div className="glass-island w-full max-w-[540px] p-lg md:p-xl rounded-[32px] relative overflow-hidden">
          {/* Inner glow top highlight */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
          
          <header className="mb-lg">
            <div className="lg:hidden mb-md">
              <h1 className="font-headline-md text-headline-md font-bold tracking-tight text-primary">
                LuxeEats
              </h1>
            </div>
            <h3 className="font-headline-md text-headline-md text-on-surface mb-xs">
              Create Account
            </h3>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Step into a world of curated culinary excellence.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-md">
            {/* Server Success Message */}
            {successMessage && (
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl text-primary text-sm">
                {successMessage}
              </div>
            )}

            {/* Server General Error */}
            {serverError && (
              <div className="p-4 bg-error/10 border border-error/20 rounded-xl text-error text-sm">
                {serverError}
              </div>
            )}

            {/* Name Field */}
            <Input
              id="full_name"
              label="Full Name"
              type="text"
              icon={User}
              placeholder="Alexander Sterling"
              value={values.full_name}
              onChange={handleChange}
              onBlur={() => handleBlur('full_name')}
              errors={touched.full_name ? errors.full_name : []}
              disabled={isLoading}
              required
            />

            {/* Email Field */}
            <Input
              id="email"
              label="Email"
              type="email"
              icon={Mail}
              placeholder="alexander@sterling.com"
              value={values.email}
              onChange={handleChange}
              onBlur={() => handleBlur('email')}
              errors={touched.email ? errors.email : []}
              disabled={isLoading}
              required
            />

            {/* Phone Number */}
            <Input
              id="phone_number"
              label="Phone Number"
              type="tel"
              icon={Phone}
              placeholder="01275644550"
              value={values.phone_number}
              onChange={handleChange}
              onBlur={() => handleBlur('phone_number')}
              errors={touched.phone_number ? errors.phone_number : []}
              disabled={isLoading}
              required
            />

            {/* Password Field */}
            <Input
              id="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              icon={Lock}
              placeholder="••••••••••••"
              value={values.password}
              onChange={handleChange}
              onBlur={() => handleBlur('password')}
              errors={touched.password ? errors.password : []}
              disabled={isLoading}
              required
              suffix={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'hide password' : 'show password'}
                  className="text-on-surface-variant hover:text-primary transition-colors focus:outline-none flex items-center justify-center"
                >
                  {showPassword ? <EyeOff size={20} className="select-none" /> : <Eye size={20} className="select-none" />}
                </button>
              }
            />

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isFormInvalid || isLoading}
              aria-label="Create Account"
              className={`shimmer-btn bg-primary w-full py-5 rounded-xl text-on-primary font-bold font-body-lg shadow-[0_8px_30px_rgba(175,198,252,0.3)] transition-all duration-300 mt-md flex items-center justify-center gap-2 ${
                isFormInvalid || isLoading
                  ? 'opacity-50 cursor-not-allowed scale-100'
                  : 'hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {isLoading ? (
                <>
                  <Spinner />
                  <span>Processing...</span>
                </>
              ) : (
                'Create Account'
              )}
            </button>

            <div className="relative flex items-center py-4">
              <div className="flex-grow border-t border-outline-variant/20"></div>
              <span className="flex-shrink mx-4 font-label-caps text-label-caps text-on-surface-variant/60">
                OR CONTINUE WITH
              </span>
              <div className="flex-grow border-t border-outline-variant/20"></div>
            </div>
          </form>
          
          <footer className="mt-lg text-center">
            <p className="font-body-md text-on-surface-variant">
              Already have an account?{' '}
              <a
                className="text-primary font-bold hover:underline underline-offset-4 transition-all"
                href="#login"
              >
                Login
              </a>
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}
