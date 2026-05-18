import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import RegisterPage from '../pages/RegisterPage';

jest.setTimeout(20000);

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegisterRequestBody {
  full_name: string;
  email: string;
  password: string;
  phone_number: string;
}

interface RegisterSuccessResponse {
  message: string;
  user: {
    created_at: string;
    email: string;
    full_name: string;
    phone_number: string;
    status: string;
    user_id: string;
  };
}

interface RegisterErrorResponse {
  error_code: string;
  fields?: Record<string, string[]>;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const VALID_FORM_DATA: RegisterRequestBody = {
  full_name: 'Ahmed Mohamed Rashed',
  email: 'ahmed.rashed.recipient@example.com',
  password: 'SecurePass1@',
  phone_number: '01275644550',
};

const REGISTER_SUCCESS_RESPONSE: RegisterSuccessResponse = {
  message: 'Please check your email to verify your account.',
  user: {
    created_at: '2026-05-17T09:25:40.123456+00:00',
    email: 'ahmed.rashed.recipient@example.com',
    full_name: 'Ahmed Mohamed Rashed',
    phone_number: '01275644550',
    status: 'PENDING_VERIFICATION',
    user_id: 'USR-20260517-xxxxx',
  },
};

// ─── MSW Server ───────────────────────────────────────────────────────────────

let capturedRequestBody: RegisterRequestBody | null = null;

const server = setupServer(
  http.post('/api/v1/auth/register', async ({ request }) => {
    capturedRequestBody = (await request.json()) as RegisterRequestBody;
    return HttpResponse.json(REGISTER_SUCCESS_RESPONSE, { status: 201 });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  capturedRequestBody = null;
});
afterAll(() => server.close());

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VerifyOTPStub = () => <div>Verify OTP Page</div>;

function renderRegisterPage() {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-otp" element={<VerifyOTPStub />} />
      </Routes>
    </MemoryRouter>
  );
  return { user };
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/full name/i), VALID_FORM_DATA.full_name);
  await user.type(screen.getByLabelText(/email/i), VALID_FORM_DATA.email);
  await user.type(screen.getByLabelText(/^password$/i), VALID_FORM_DATA.password);
  await user.type(screen.getByLabelText(/phone number/i), VALID_FORM_DATA.phone_number);
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('RegisterPage', () => {
  // ── 1. Renders all form inputs ────────────────────────────────────────────
  it('renders all required form inputs', () => {
    renderRegisterPage();

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
  });

  // ── 2. Renders submit button ──────────────────────────────────────────────
  it('renders the submit button', () => {
    renderRegisterPage();

    expect(
      screen.getByRole('button', { name: /register|sign up|create account/i })
    ).toBeInTheDocument();
  });

  // ── 3. Input values update correctly ─────────────────────────────────────
  it('updates input values as the user types', async () => {
    const { user } = renderRegisterPage();

    const nameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/email/i);

    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'john@example.com');

    expect(nameInput).toHaveValue('John Doe');
    expect(emailInput).toHaveValue('john@example.com');
  });

  // ── 4–8. Password validation ──────────────────────────────────────────────
  describe('password validation', () => {
    it('shows error when password is shorter than 8 characters', async () => {
      const { user } = renderRegisterPage();

      await user.type(screen.getByLabelText(/^password$/i), 'Ab1@');
      await user.tab();

      expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    });

    it('shows error when password contains no uppercase letter', async () => {
      const { user } = renderRegisterPage();

      await user.type(screen.getByLabelText(/^password$/i), 'securepass1@');
      await user.tab();

      expect(await screen.findByText(/uppercase/i)).toBeInTheDocument();
    });

    it('shows error when password contains no number', async () => {
      const { user } = renderRegisterPage();

      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass@');
      await user.tab();

      expect(await screen.findByText(/at least one number/i)).toBeInTheDocument();
    });

    it('shows error when password contains no special character', async () => {
      const { user } = renderRegisterPage();

      await user.type(screen.getByLabelText(/^password$/i), 'SecurePass1');
      await user.tab();

      expect(await screen.findByText(/special character/i)).toBeInTheDocument();
    });
  });

  // ── 9. Email validation ───────────────────────────────────────────────────
  it('shows error for an invalid email format', async () => {
    const { user } = renderRegisterPage();

    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.tab();

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
  });

  // ── 10–11. Phone number validation ───────────────────────────────────────
  describe('phone number validation', () => {
    it('shows required error when phone number is left empty', async () => {
      const { user } = renderRegisterPage();

      await user.click(screen.getByLabelText(/phone number/i));
      await user.tab();

      expect(await screen.findByText(/phone number is required/i)).toBeInTheDocument();
    });

    it('rejects phone numbers with more than 11 digits', async () => {
      const { user } = renderRegisterPage();

      await user.type(screen.getByLabelText(/phone number/i), '012345678901'); // 12 digits
      await user.tab();

      expect(await screen.findByText(/11 digits/i)).toBeInTheDocument();
    });
  });

  // ── 12. Submit disabled when form invalid ─────────────────────────────────
  it('disables the submit button when the form is invalid', () => {
    renderRegisterPage();

    expect(
      screen.getByRole('button', { name: /register|sign up|create account/i })
    ).toBeDisabled();
  });

  // ── 13. Submit enabled when form valid ────────────────────────────────────
  it('enables the submit button when all fields are valid', async () => {
    const { user } = renderRegisterPage();

    await fillValidForm(user);

    expect(
      screen.getByRole('button', { name: /register|sign up|create account/i })
    ).toBeEnabled();
  });

  // ── 14. No API request sent when form invalid ─────────────────────────────
  it('does not call the register API when the form is invalid', async () => {
    let apiCalled = false;
    server.use(
      http.post('/api/v1/auth/register', () => {
        apiCalled = true;
        return HttpResponse.json(REGISTER_SUCCESS_RESPONSE, { status: 201 });
      })
    );

    const { user } = renderRegisterPage();
    // Only partially fill the form so it stays invalid
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');

    const submitBtn = screen.getByRole('button', { name: /register|sign up|create account/i });
    expect(submitBtn).toBeDisabled();

    // Attempt keyboard submission anyway
    await user.keyboard('{Enter}');

    expect(apiCalled).toBe(false);
  });

  // ── 15. Loading spinner during submission ─────────────────────────────────
  it('shows a loading spinner while the request is in-flight', async () => {
    let resolveRequest!: (r: Response) => void;
    server.use(
      http.post('/api/v1/auth/register', () =>
        new Promise<Response>((res) => {
          resolveRequest = res;
        })
      )
    );

    const { user } = renderRegisterPage();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /register|sign up|create account/i }));

    expect(screen.getByRole('status')).toBeInTheDocument();

    // Unblock to avoid open handles
    resolveRequest(HttpResponse.json(REGISTER_SUCCESS_RESPONSE, { status: 201 }) as unknown as Response);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  // ── 16. Submit button disabled during loading ─────────────────────────────
  it('keeps the submit button disabled while loading', async () => {
    let resolveRequest!: (r: Response) => void;
    server.use(
      http.post('/api/v1/auth/register', () =>
        new Promise<Response>((res) => {
          resolveRequest = res;
        })
      )
    );

    const { user } = renderRegisterPage();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /register|sign up|create account/i }));

    expect(
      screen.getByRole('button', { name: /register|sign up|create account/i })
    ).toBeDisabled();

    resolveRequest(HttpResponse.json(REGISTER_SUCCESS_RESPONSE, { status: 201 }) as unknown as Response);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  // ── 17. Success message displayed ────────────────────────────────────────
  it('displays the success message returned by the API', async () => {
    const { user } = renderRegisterPage();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /register|sign up|create account/i }));

    expect(
      await screen.findByText(/check your email to verify/i)
    ).toBeInTheDocument();
  });

  // ── 18. Redirects to verify-otp after success ────────────────────────────
  it('navigates to the verify OTP page after successful registration', async () => {
    const { user } = renderRegisterPage();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /register|sign up|create account/i }));

    expect(await screen.findByText(/verify otp page/i)).toBeInTheDocument();
  });

  // ── 19. Duplicate email error ─────────────────────────────────────────────
  it('shows duplicate email error when the server responds with 409', async () => {
    server.use(
      http.post('/api/v1/auth/register', () =>
        HttpResponse.json<RegisterErrorResponse>(
          { error_code: 'EMAIL_ALREADY_EXISTS' },
          { status: 409 }
        )
      )
    );

    const { user } = renderRegisterPage();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /register|sign up|create account/i }));

    expect(
      await screen.findByText(/email already exists|already registered/i)
    ).toBeInTheDocument();
  });

  // ── 20. Backend validation errors rendered ────────────────────────────────
  it('renders backend field-level validation errors from a 422 response', async () => {
    server.use(
      http.post('/api/v1/auth/register', () =>
        HttpResponse.json<RegisterErrorResponse>(
          {
            error_code: 'VALIDATION_ERROR',
            fields: {
              password: ['Password must contain at least one special character'],
            },
          },
          { status: 422 }
        )
      )
    );

    const { user } = renderRegisterPage();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /register|sign up|create account/i }));

    expect(
      await screen.findByText(/password must contain at least one special character/i)
    ).toBeInTheDocument();
  });

  // ── 21. Network/server errors handled ────────────────────────────────────
  it('shows a generic error message when the network request fails', async () => {
    server.use(
      http.post('/api/v1/auth/register', () => HttpResponse.error())
    );

    const { user } = renderRegisterPage();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /register|sign up|create account/i }));

    expect(
      await screen.findByText(/something went wrong|network error|try again/i)
    ).toBeInTheDocument();
  });

  // ── 22. Password show/hide toggle ─────────────────────────────────────────
  it('toggles password field visibility when the show/hide button is clicked', async () => {
    const { user } = renderRegisterPage();
    const passwordInput = screen.getByLabelText(/^password$/i);

    // Default: hidden
    expect(passwordInput).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: /show password|toggle password/i }));
    expect(passwordInput).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: /hide password|toggle password/i }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  // ── 23. API called with exact payload ────────────────────────────────────
  it('sends the exact payload to the register API on submit', async () => {
    const { user } = renderRegisterPage();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /register|sign up|create account/i }));

    await waitFor(() => {
      expect(capturedRequestBody).toEqual(VALID_FORM_DATA);
    });
  });

  // ── 24. Password never shown in success UI ────────────────────────────────
  it('does not expose the password value anywhere in the success UI', async () => {
    const { user } = renderRegisterPage();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /register|sign up|create account/i }));

    await screen.findByText(/check your email to verify/i);

    expect(screen.queryByText(VALID_FORM_DATA.password)).not.toBeInTheDocument();
  });

  // ── 25. Form reset / stale-data check ────────────────────────────────────
  it('does not leave stale form data on screen after successful submission', async () => {
    const { user } = renderRegisterPage();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /register|sign up|create account/i }));

    // After navigation the register form fields should be gone
    await screen.findByText(/verify otp page/i);
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
  });

  // ── 27. Loading state cleared after completion ────────────────────────────
  it('removes the loading spinner after the request completes', async () => {
    const { user } = renderRegisterPage();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /register|sign up|create account/i }));

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });
});
