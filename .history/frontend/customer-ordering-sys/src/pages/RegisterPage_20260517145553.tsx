import React, { FormEvent, useState } from 'react';
import { registerUser, RegisterPayload } from '../api/auth';

interface RegisterPageProps {
  onSuccess?: (email: string) => void;
}

export function RegisterPage({ onSuccess }: RegisterPageProps) {
  const [form, setForm] = useState<RegisterPayload>({
    full_name: '',
    email: '',
    password: '',
    phone_number: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [serverError, setServerError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});
    setServerError('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const response = await registerUser(form);
      setSuccessMessage(response.message);
      onSuccess?.(form.email);
    } catch (error: any) {
      if (error?.fields) {
        setFieldErrors(error.fields);
      }
      setServerError(error?.message || 'Unable to register.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-white shadow rounded-lg">
      <h1 className="text-2xl font-semibold mb-4">Create your account</h1>

      {successMessage ? (
        <div role="status" className="mb-4 rounded-md bg-green-100 p-4 text-green-800">
          {successMessage}
        </div>
      ) : null}

      {serverError ? (
        <div role="alert" className="mb-4 rounded-md bg-red-100 p-4 text-red-800">
          {serverError}
        </div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <label className="block mb-3">
          <span className="text-sm font-medium">Full name</span>
          <input
            name="full_name"
            value={form.full_name}
            onChange={handleChange}
            placeholder="Jane Doe"
            className="mt-1 block w-full rounded border p-2"
          />
          {fieldErrors.full_name ? (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.full_name.join(' ')}</p>
          ) : null}
        </label>

        <label className="block mb-3">
          <span className="text-sm font-medium">Email</span>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="hello@example.com"
            className="mt-1 block w-full rounded border p-2"
          />
          {fieldErrors.email ? (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.email.join(' ')}</p>
          ) : null}
        </label>

        <label className="block mb-3">
          <span className="text-sm font-medium">Password</span>
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="••••••••"
            className="mt-1 block w-full rounded border p-2"
          />
          {fieldErrors.password ? (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.password.join(' ')}</p>
          ) : null}
        </label>

        <label className="block mb-3">
          <span className="text-sm font-medium">Phone number</span>
          <input
            name="phone_number"
            type="tel"
            value={form.phone_number}
            onChange={handleChange}
            placeholder="01012345678"
            className="mt-1 block w-full rounded border p-2"
          />
          {fieldErrors.phone_number ? (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.phone_number.join(' ')}</p>
          ) : null}
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 inline-flex items-center justify-center rounded bg-sky-600 px-4 py-2 text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting...' : 'Register'}
        </button>
      </form>
    </div>
  );
}
