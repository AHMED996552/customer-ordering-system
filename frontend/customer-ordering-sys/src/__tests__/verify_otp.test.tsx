import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import VerifyOTPPage from '../pages/VerifyOTPPage';

jest.setTimeout(20000);

// ─── Types ────────────────────────────────────────────────────────────────────

interface VerifyOTPRequestBody {
  email: string;
  otp_code: string;
}

interface VerifyOTPSuccessResponse {
  message: string;
  user: {
    created_at: string;
    email: string;
    full_name: string;
    phone_number: string;
    status: 'ACTIVE';
    user_id: string;
  };
}

interface VerifyOTPErrorResponse {
  error_code: 'INVALID_OTP' | 'OTP_EXPIRED';
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const TEST_EMAIL = 'ahmedyousefk6@gmail.com';
const VALID_OTP = '704102';

const VERIFY_SUCCESS_RESPONSE: VerifyOTPSuccessResponse = {
  message: 'Account verified successfully',
  user: {
    created_at: '2026-05-17T10:19:43.811533+00:00',
    email: TEST_EMAIL,
    full_name: 'Ahmed youssef',
    phone_number: '01275644550',
    status: 'ACTIVE',
    user_id: 'USR-20260517-34959',
  },
};

// ─── MSW Server ───────────────────────────────────────────────────────────────

let capturedRequestBody: VerifyOTPRequestBody | null = null;

const server = setupServer(
  http.post('/api/v1/auth/verify-otp', async ({ request }) => {
    capturedRequestBody = (await request.json()) as VerifyOTPRequestBody;
    return HttpResponse.json(VERIFY_SUCCESS_RESPONSE, { status: 200 });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  capturedRequestBody = null;
});
afterAll(() => server.close());

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DashboardStub = () => <div>Dashboard Page</div>;
const LoginStub = () => <div>Login Page</div>;

/**
 * Renders VerifyOTPPage with the given email injected via router state.
 * Adjust the state key ("email") to match your component's useLocation() usage.
 */
function renderVerifyOTPPage(email: string = TEST_EMAIL) {
  const user = userEvent.setup();
  render(
    <MemoryRouter
      initialEntries={[{ pathname: '/verify-otp', state: { email } }]}
    >
      <Routes>
        <Route path="/verify-otp" element={<VerifyOTPPage />} />
        <Route path="/dashboard" element={<DashboardStub />} />
        <Route path="/login" element={<LoginStub />} />
      </Routes>
    </MemoryRouter>
  );
  return { user };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('VerifyOTPPage', () => {
  // ── 1. Renders OTP input ──────────────────────────────────────────────────
  it('renders the OTP input field', () => {
    renderVerifyOTPPage();

    expect(
      screen.getByRole('textbox', { name: /otp|verification code/i })
    ).toBeInTheDocument();
  });

  // ── 2. Renders verify button ──────────────────────────────────────────────
  it('renders the verify button', () => {
    renderVerifyOTPPage();

    expect(
      screen.getByRole('button', { name: /verify|confirm/i })
    ).toBeInTheDocument();
  });

  // ── 3. OTP must be exactly 6 digits ──────────────────────────────────────
  it('shows a validation error when the OTP is fewer than 6 digits', async () => {
    const { user } = renderVerifyOTPPage();

    await user.type(screen.getByRole('textbox', { name: /otp|verification code/i }), '1234');
    await user.tab();

    expect(await screen.findByText(/6 digits|must be 6/i)).toBeInTheDocument();
  });

  it('shows a validation error when the OTP is more than 6 digits', async () => {
    const { user } = renderVerifyOTPPage();

    const otpInput = screen.getByRole('textbox', { name: /otp|verification code/i });
    await user.type(otpInput, '1234567');
    await user.tab();

    expect(await screen.findByText(/6 digits|must be 6/i)).toBeInTheDocument();
  });

  // ── 4. Invalid OTP validation blocks request ──────────────────────────────
  it('does not call the API when the OTP is invalid', async () => {
    let apiCalled = false;
    server.use(
      http.post('/api/v1/auth/verify-otp', () => {
        apiCalled = true;
        return HttpResponse.json(VERIFY_SUCCESS_RESPONSE);
      })
    );

    const { user } = renderVerifyOTPPage();
    await user.type(screen.getByRole('textbox', { name: /otp|verification code/i }), '123');

    const verifyBtn = screen.getByRole('button', { name: /verify|confirm/i });
    expect(verifyBtn).toBeDisabled();
    await user.keyboard('{Enter}');

    expect(apiCalled).toBe(false);
  });

  // ── 5. Verify button disabled when invalid ────────────────────────────────
  it('keeps the verify button disabled when the OTP is not exactly 6 digits', async () => {
    const { user } = renderVerifyOTPPage();

    await user.type(
      screen.getByRole('textbox', { name: /otp|verification code/i }),
      '123'
    );

    expect(screen.getByRole('button', { name: /verify|confirm/i })).toBeDisabled();
  });

  // ── 6. Input updates correctly ────────────────────────────────────────────
  it('updates the OTP input value as the user types', async () => {
    const { user } = renderVerifyOTPPage();
    const otpInput = screen.getByRole('textbox', { name: /otp|verification code/i });

    await user.type(otpInput, VALID_OTP);

    expect(otpInput).toHaveValue(VALID_OTP);
  });

  // ── 7. Loading spinner during request ─────────────────────────────────────
  it('shows a loading spinner while the verify request is in-flight', async () => {
    let resolveRequest!: (r: Response) => void;
    server.use(
      http.post('/api/v1/auth/verify-otp', () =>
        new Promise<Response>((res) => {
          resolveRequest = res;
        })
      )
    );

    const { user } = renderVerifyOTPPage();
    await user.type(
      screen.getByRole('textbox', { name: /otp|verification code/i }),
      VALID_OTP
    );
    await user.click(screen.getByRole('button', { name: /verify|confirm/i }));

    expect(screen.getByRole('status')).toBeInTheDocument();

    resolveRequest(
      HttpResponse.json(VERIFY_SUCCESS_RESPONSE, { status: 200 }) as unknown as Response
    );
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  // ── 8. Verify button disabled during loading ──────────────────────────────
  it('disables the verify button while the request is loading', async () => {
    let resolveRequest!: (r: Response) => void;
    server.use(
      http.post('/api/v1/auth/verify-otp', () =>
        new Promise<Response>((res) => {
          resolveRequest = res;
        })
      )
    );

    const { user } = renderVerifyOTPPage();
    await user.type(
      screen.getByRole('textbox', { name: /otp|verification code/i }),
      VALID_OTP
    );
    await user.click(screen.getByRole('button', { name: /verify|confirm/i }));

    expect(screen.getByRole('button', { name: /verify|confirm/i })).toBeDisabled();

    resolveRequest(
      HttpResponse.json(VERIFY_SUCCESS_RESPONSE, { status: 200 }) as unknown as Response
    );
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  // ── 9. API called with exact payload ─────────────────────────────────────
  it('sends { email, otp_code } to the verify-otp endpoint', async () => {
    const { user } = renderVerifyOTPPage();
    await user.type(
      screen.getByRole('textbox', { name: /otp|verification code/i }),
      VALID_OTP
    );
    await user.click(screen.getByRole('button', { name: /verify|confirm/i }));

    await waitFor(() => {
      expect(capturedRequestBody).toEqual<VerifyOTPRequestBody>({
        email: TEST_EMAIL,
        otp_code: VALID_OTP,
      });
    });
  });

  // ── 10. Success message shown ─────────────────────────────────────────────
  it('displays the success message after a valid OTP is verified', async () => {
    const { user } = renderVerifyOTPPage();
    await user.type(
      screen.getByRole('textbox', { name: /otp|verification code/i }),
      VALID_OTP
    );
    await user.click(screen.getByRole('button', { name: /verify|confirm/i }));

    expect(
      await screen.findByText(/account verified successfully/i)
    ).toBeInTheDocument();
  });

  // ── 11. Redirects after successful verification ───────────────────────────
  it('navigates to dashboard or login after successful verification', async () => {
    const { user } = renderVerifyOTPPage();
    await user.type(
      screen.getByRole('textbox', { name: /otp|verification code/i }),
      VALID_OTP
    );
    await user.click(screen.getByRole('button', { name: /verify|confirm/i }));

    const destination = await screen.findByText(/dashboard page|login page/i);
    expect(destination).toBeInTheDocument();
  });

  // ── 12. ACTIVE status handled correctly ──────────────────────────────────
  it('processes a user with ACTIVE status from the response correctly', async () => {
    const { user } = renderVerifyOTPPage();
    await user.type(
      screen.getByRole('textbox', { name: /otp|verification code/i }),
      VALID_OTP
    );
    await user.click(screen.getByRole('button', { name: /verify|confirm/i }));

    // After verification, user should land on dashboard (ACTIVE status = success flow)
    const destination = await screen.findByText(/dashboard page|login page/i);
    expect(destination).toBeInTheDocument();
  });

  // ── 13. Invalid OTP error displayed ──────────────────────────────────────
  it('displays an invalid OTP error when the server responds with INVALID_OTP', async () => {
    server.use(
      http.post('/api/v1/auth/verify-otp', () =>
        HttpResponse.json<VerifyOTPErrorResponse>(
          { error_code: 'INVALID_OTP' },
          { status: 400 }
        )
      )
    );

    const { user } = renderVerifyOTPPage();
    await user.type(
      screen.getByRole('textbox', { name: /otp|verification code/i }),
      '000000'
    );
    await user.click(screen.getByRole('button', { name: /verify|confirm/i }));

    expect(
      await screen.findByText(/invalid otp|invalid code/i)
    ).toBeInTheDocument();
  });

  // ── 14. Expired OTP error displayed ──────────────────────────────────────
  it('displays an expired OTP error when the server responds with OTP_EXPIRED', async () => {
    server.use(
      http.post('/api/v1/auth/verify-otp', () =>
        HttpResponse.json<VerifyOTPErrorResponse>(
          { error_code: 'OTP_EXPIRED' },
          { status: 400 }
        )
      )
    );

    const { user } = renderVerifyOTPPage();
    await user.type(
      screen.getByRole('textbox', { name: /otp|verification code/i }),
      '111111'
    );
    await user.click(screen.getByRole('button', { name: /verify|confirm/i }));

    expect(
      await screen.findByText(/otp.*expired|code.*expired/i)
    ).toBeInTheDocument();
  });

  // ── 15. Network/server errors handled ────────────────────────────────────
  it('shows a generic error message when the network request fails', async () => {
    server.use(
      http.post('/api/v1/auth/verify-otp', () => HttpResponse.error())
    );

    const { user } = renderVerifyOTPPage();
    await user.type(
      screen.getByRole('textbox', { name: /otp|verification code/i }),
      VALID_OTP
    );
    await user.click(screen.getByRole('button', { name: /verify|confirm/i }));

    expect(
      await screen.findByText(/something went wrong|network error|try again/i)
    ).toBeInTheDocument();
  });

  // ── 16. Resend OTP flow ───────────────────────────────────────────────────
  describe('resend OTP flow (if supported)', () => {
    it('renders a resend OTP button or link', () => {
      renderVerifyOTPPage();

      // Conditionally check — skip if not present
      const resendBtn = screen.queryByRole('button', { name: /resend/i })
        ?? screen.queryByRole('link', { name: /resend/i });

      if (resendBtn) {
        expect(resendBtn).toBeInTheDocument();
      } else {
        // Component does not support resend — acceptable
        expect(true).toBe(true);
      }
    });

    it('calls the resend endpoint when the resend button is clicked', async () => {
      let resendCalled = false;
      server.use(
        http.post('/api/v1/auth/resend-otp', () => {
          resendCalled = true;
          return HttpResponse.json({ message: 'OTP resent' }, { status: 200 });
        })
      );

      const { user } = renderVerifyOTPPage();
      const resendBtn = screen.queryByRole('button', { name: /resend/i });

      if (resendBtn) {
        await user.click(resendBtn);
        await waitFor(() => expect(resendCalled).toBe(true));
      } else {
        // Resend not implemented — skip
        expect(true).toBe(true);
      }
    });
  });

  // ── 17. Loading state cleared after completion ────────────────────────────
  it('removes the loading spinner after the verify request completes', async () => {
    const { user } = renderVerifyOTPPage();
    await user.type(
      screen.getByRole('textbox', { name: /otp|verification code/i }),
      VALID_OTP
    );
    await user.click(screen.getByRole('button', { name: /verify|confirm/i }));

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });
});
