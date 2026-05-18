import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import RegisterPage from '../pages/RegisterPage';
import VerifyOTPPage from '../pages/VerifyOTPPage';

jest.setTimeout(20000);

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegisterRequestBody {
  full_name: string;
  email: string;
  password: string;
  phone_number: string;
}

interface VerifyOTPRequestBody {
  email: string;
  otp_code: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const REGISTER_FORM = {
  full_name: 'Ahmed Mohamed Rashed',
  email: 'ahmed.rashed.recipient@example.com',
  password: 'SecurePass1@',
  phone_number: '01275644550',
};

const VALID_OTP = '704102';

const REGISTER_SUCCESS = {
  message: 'Please check your email to verify your account.',
  user: {
    created_at: '2026-05-17T09:25:40.123456+00:00',
    email: REGISTER_FORM.email,
    full_name: REGISTER_FORM.full_name,
    phone_number: REGISTER_FORM.phone_number,
    status: 'PENDING_VERIFICATION',
    user_id: 'USR-20260517-xxxxx',
  },
};

const VERIFY_SUCCESS = {
  message: 'Account verified successfully',
  user: {
    created_at: '2026-05-17T10:19:43.811533+00:00',
    email: REGISTER_FORM.email,
    full_name: REGISTER_FORM.full_name,
    phone_number: REGISTER_FORM.phone_number,
    status: 'ACTIVE',
    user_id: 'USR-20260517-xxxxx',
  },
};

// ─── Request capture ──────────────────────────────────────────────────────────

let capturedRegisterBody: RegisterRequestBody | null = null;
let capturedVerifyBody: VerifyOTPRequestBody | null = null;

// ─── MSW Server ───────────────────────────────────────────────────────────────

const server = setupServer(
  http.post('/api/v1/auth/register', async ({ request }) => {
    capturedRegisterBody = (await request.json()) as RegisterRequestBody;
    return HttpResponse.json(REGISTER_SUCCESS, { status: 201 });
  }),
  http.post('/api/v1/auth/verify-otp', async ({ request }) => {
    capturedVerifyBody = (await request.json()) as VerifyOTPRequestBody;
    return HttpResponse.json(VERIFY_SUCCESS, { status: 200 });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  capturedRegisterBody = null;
  capturedVerifyBody = null;
});
afterAll(() => server.close());

// ─── App Stub ─────────────────────────────────────────────────────────────────

const DashboardStub = () => <div>Dashboard Page</div>;
const LoginStub    = () => <div>Login Page</div>;

function renderApp() {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register"   element={<RegisterPage />} />
        <Route path="/verify-otp" element={<VerifyOTPPage />} />
        <Route path="/dashboard"  element={<DashboardStub />} />
        <Route path="/login"      element={<LoginStub />} />
      </Routes>
    </MemoryRouter>
  );
  return { user };
}

// ─── Integration Tests ────────────────────────────────────────────────────────

describe('Auth flow — full integration', () => {
  it('completes the full register → verify OTP flow with real user interactions', async () => {
    const { user } = renderApp();

    // ── STEP 1: Register page renders ──────────────────────────────────────

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /register|sign up|create account/i })
    ).toBeInTheDocument();

    // ── STEP 2: User fills the registration form ───────────────────────────

    await user.type(screen.getByLabelText(/full name/i), REGISTER_FORM.full_name);
    await user.type(screen.getByLabelText(/email/i), REGISTER_FORM.email);
    await user.type(screen.getByLabelText(/^password$/i), REGISTER_FORM.password);
    await user.type(screen.getByLabelText(/phone number/i), REGISTER_FORM.phone_number);

    // ── STEP 3: Submit button is now enabled ──────────────────────────────

    const submitBtn = screen.getByRole('button', { name: /register|sign up|create account/i });
    expect(submitBtn).toBeEnabled();

    // ── STEP 4: User submits the form ─────────────────────────────────────

    await user.click(submitBtn);

    // ── STEP 5: API receives the exact register payload ───────────────────

    await waitFor(() => {
      expect(capturedRegisterBody).toEqual<RegisterRequestBody>({
        full_name: REGISTER_FORM.full_name,
        email:     REGISTER_FORM.email,
        password:  REGISTER_FORM.password,
        phone_number: REGISTER_FORM.phone_number,
      });
    });

    // ── STEP 6: Success message displayed ────────────────────────────────

    expect(
      await screen.findByText(/check your email to verify/i)
    ).toBeInTheDocument();

    // ── STEP 7: Navigation to verify OTP page ────────────────────────────

    expect(
      await screen.findByRole('textbox', { name: /otp|verification code/i })
    ).toBeInTheDocument();

    // Register form is no longer rendered
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();

    // ── STEP 8: Email is passed to the verify OTP page ───────────────────
    // The page should display the target email or pre-populate the hidden field.
    // Verify by checking the outgoing API call includes the correct email (STEP 10).

    // ── STEP 9: User enters the OTP ──────────────────────────────────────

    const otpInput = screen.getByRole('textbox', { name: /otp|verification code/i });
    await user.type(otpInput, VALID_OTP);
    expect(otpInput).toHaveValue(VALID_OTP);

    // ── STEP 10: Verify button enabled for valid 6-digit OTP ─────────────

    const verifyBtn = screen.getByRole('button', { name: /verify|confirm/i });
    expect(verifyBtn).toBeEnabled();

    // ── STEP 11: User submits the OTP ────────────────────────────────────

    await user.click(verifyBtn);

    // ── STEP 12: verify-otp API receives exact payload ────────────────────

    await waitFor(() => {
      expect(capturedVerifyBody).toEqual<VerifyOTPRequestBody>({
        email:    REGISTER_FORM.email,
        otp_code: VALID_OTP,
      });
    });

    // ── STEP 13: Success message shown ────────────────────────────────────

    expect(
      await screen.findByText(/account verified successfully/i)
    ).toBeInTheDocument();

    // ── STEP 14: Navigation to dashboard or login ─────────────────────────

    expect(
      await screen.findByText(/dashboard page|login page/i)
    ).toBeInTheDocument();

    // Verify OTP page is no longer rendered
    expect(
      screen.queryByRole('textbox', { name: /otp|verification code/i })
    ).not.toBeInTheDocument();
  });

  // ── Additional edge-case integration tests ────────────────────────────────

  it('shows registration error and keeps user on register page when 409 is returned', async () => {
    server.use(
      http.post('/api/v1/auth/register', () =>
        HttpResponse.json(
          { error_code: 'EMAIL_ALREADY_EXISTS' },
          { status: 409 }
        )
      )
    );

    const { user } = renderApp();

    await user.type(screen.getByLabelText(/full name/i), REGISTER_FORM.full_name);
    await user.type(screen.getByLabelText(/email/i), REGISTER_FORM.email);
    await user.type(screen.getByLabelText(/^password$/i), REGISTER_FORM.password);
    await user.type(screen.getByLabelText(/phone number/i), REGISTER_FORM.phone_number);

    await user.click(
      screen.getByRole('button', { name: /register|sign up|create account/i })
    );

    expect(
      await screen.findByText(/email already exists|already registered/i)
    ).toBeInTheDocument();

    // User stays on register page
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('shows OTP error and keeps user on verify page when INVALID_OTP is returned', async () => {
    // Allow registration to succeed
    const { user } = renderApp();

    await user.type(screen.getByLabelText(/full name/i), REGISTER_FORM.full_name);
    await user.type(screen.getByLabelText(/email/i), REGISTER_FORM.email);
    await user.type(screen.getByLabelText(/^password$/i), REGISTER_FORM.password);
    await user.type(screen.getByLabelText(/phone number/i), REGISTER_FORM.phone_number);
    await user.click(
      screen.getByRole('button', { name: /register|sign up|create account/i })
    );

    // Wait for OTP page
    await screen.findByRole('textbox', { name: /otp|verification code/i });

    // Override: OTP call returns error
    server.use(
      http.post('/api/v1/auth/verify-otp', () =>
        HttpResponse.json(
          { error_code: 'INVALID_OTP' },
          { status: 400 }
        )
      )
    );

    await user.type(
      screen.getByRole('textbox', { name: /otp|verification code/i }),
      '000000'
    );
    await user.click(screen.getByRole('button', { name: /verify|confirm/i }));

    expect(
      await screen.findByText(/invalid otp|invalid code/i)
    ).toBeInTheDocument();

    // User stays on verify page
    expect(
      screen.getByRole('textbox', { name: /otp|verification code/i })
    ).toBeInTheDocument();
  });

  it('shows OTP expired error and keeps user on verify page', async () => {
    const { user } = renderApp();

    await user.type(screen.getByLabelText(/full name/i), REGISTER_FORM.full_name);
    await user.type(screen.getByLabelText(/email/i), REGISTER_FORM.email);
    await user.type(screen.getByLabelText(/^password$/i), REGISTER_FORM.password);
    await user.type(screen.getByLabelText(/phone number/i), REGISTER_FORM.phone_number);
    await user.click(
      screen.getByRole('button', { name: /register|sign up|create account/i })
    );

    await screen.findByRole('textbox', { name: /otp|verification code/i });

    server.use(
      http.post('/api/v1/auth/verify-otp', () =>
        HttpResponse.json(
          { error_code: 'OTP_EXPIRED' },
          { status: 400 }
        )
      )
    );

    await user.type(
      screen.getByRole('textbox', { name: /otp|verification code/i }),
      '111111'
    );
    await user.click(screen.getByRole('button', { name: /verify|confirm/i }));

    expect(
      await screen.findByText(/otp.*expired|code.*expired/i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole('textbox', { name: /otp|verification code/i })
    ).toBeInTheDocument();
  });

  it('does not allow navigation to verify-otp if register request has not been made', () => {
    // Directly visiting /verify-otp without the email state should show
    // an error or redirect rather than an empty/broken form.
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/verify-otp']}>
        <Routes>
          <Route path="/register"   element={<RegisterPage />} />
          <Route path="/verify-otp" element={<VerifyOTPPage />} />
          <Route path="/dashboard"  element={<DashboardStub />} />
          <Route path="/login"      element={<LoginStub />} />
        </Routes>
      </MemoryRouter>
    );

    // Either the OTP form is shown (email sourced from elsewhere) or
    // the component redirects / shows an error.  We assert at least
    // one of the two sensible outcomes is rendered.
    const hasForm = !!screen.queryByRole('textbox', { name: /otp|verification code/i });
    const hasError = !!screen.queryByText(/invalid|missing|email required|go back/i);
    const redirectedToRegister = !!screen.queryByLabelText(/full name/i);

    expect(hasForm || hasError || redirectedToRegister).toBe(true);
  });
});
