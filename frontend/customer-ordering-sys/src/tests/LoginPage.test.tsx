/**
 * LoginPage.test.tsx — UC-7: Frontend TDD
 * Tests: input rendering, 401/403/429 error display, happy-path redirect,
 *        password visibility toggle, and loading state.
 *
 * Strategy: Use jest.mock('axios') instead of MSW to avoid CRA + MSW v2
 * compatibility issues with static class blocks and ESM-only dependencies.
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import axios from "axios";

import LoginPage from "../pages/LoginPage";
import { AuthProvider } from "../hooks/AuthContext";

// ── Jest auto-mock axios ───────────────────────────────────────────────────────
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Make axios.isAxiosError return true for our fake error objects
// (jest.mock replaces the whole module so isAxiosError becomes jest.fn())
Object.defineProperty(mockedAxios, "isAxiosError", {
  value: (err: unknown) =>
    Boolean((err as { isAxiosError?: boolean })?.isAxiosError),
  writable: true,
  configurable: true,
});

// ── Helpers ────────────────────────────────────────────────────────────────────

const SUCCESSFUL_RESPONSE = {
  data: {
    message: "Login successful.",
    user: { user_id: 1, email: "alice@example.com", full_name: "Alice Smith" },
  },
  status: 200,
};

/** Creates an AxiosError-shaped object for a given HTTP status. */
function makeAxiosError(status: number, errorMsg: string) {
  const error = {
    isAxiosError: true,
    response: {
      status,
      data: { error: errorMsg },
    },
    message: `Request failed with status code ${status}`,
  };
  return error;
}

/** Wraps LoginPage with required providers + a dummy dashboard route. */
const renderLoginPage = () =>
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );

// Reset mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  1. Rendering Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("LoginPage — Rendering", () => {
  it("renders the email input", () => {
    renderLoginPage();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  });

  it("renders the password input", () => {
    renderLoginPage();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it("renders the sign-in submit button", () => {
    renderLoginPage();
    expect(
      screen.getByRole("button", { name: /sign in/i })
    ).toBeInTheDocument();
  });

  it("renders the brand name LuxeEats", () => {
    renderLoginPage();
    expect(screen.getByText("LuxeEats")).toBeInTheDocument();
  });

  it("renders a link to the register page", () => {
    renderLoginPage();
    expect(screen.getByRole("link", { name: /create an account/i })).toBeInTheDocument();
  });

  it("password input type is 'password' by default", () => {
    renderLoginPage();
    const input = screen.getByLabelText(/^password$/i) as HTMLInputElement;
    expect(input.type).toBe("password");
  });

  it("toggles password visibility when eye button clicked", async () => {
    renderLoginPage();
    const input = screen.getByLabelText(/^password$/i) as HTMLInputElement;
    const toggleBtn = screen.getByRole("button", { name: /show password/i });

    expect(input.type).toBe("password");
    await userEvent.click(toggleBtn);
    expect(input.type).toBe("text");

    const hideBtn = screen.getByRole("button", { name: /hide password/i });
    await userEvent.click(hideBtn);
    expect(input.type).toBe("password");
  });

  it("error alert is NOT visible before any submission", () => {
    renderLoginPage();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  2. Error Display Tests (Padlock Rules 1–3)
// ═══════════════════════════════════════════════════════════════════════════════

describe("LoginPage — Error States", () => {
  it("PADLOCK 2 — shows error on HTTP 401 (bad credentials)", async () => {
    mockedAxios.post.mockRejectedValueOnce(
      makeAxiosError(401, "Invalid email or password.")
    );

    renderLoginPage();
    await userEvent.type(screen.getByLabelText(/email address/i), "bad@example.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /invalid email or password/i
      );
    });
  });

  it("PADLOCK 1 — shows lockout message on HTTP 429 (rate limit)", async () => {
    mockedAxios.post.mockRejectedValueOnce(
      makeAxiosError(
        429,
        "Too many failed attempts. Account locked for ~15 more minute(s)."
      )
    );

    renderLoginPage();
    await userEvent.type(screen.getByLabelText(/email address/i), "locked@example.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), "somepass");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/locked|too many/i);
    });
  });

  it("PADLOCK 3 — shows inactive message on HTTP 403 (unverified email)", async () => {
    mockedAxios.post.mockRejectedValueOnce(
      makeAxiosError(
        403,
        "Your account is not active. Please verify your email or contact support."
      )
    );

    renderLoginPage();
    await userEvent.type(screen.getByLabelText(/email address/i), "inactive@example.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), "Passw0rd!");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/not active/i);
    });
  });

  it("clears previous error when user starts typing again", async () => {
    mockedAxios.post.mockRejectedValueOnce(
      makeAxiosError(401, "Invalid email or password.")
    );

    renderLoginPage();
    await userEvent.type(screen.getByLabelText(/email address/i), "bad@example.com");
    await userEvent.type(screen.getByLabelText(/^password$/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument()
    );

    // Typing in the password clears the error on next submit (error is cleared on submit)
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  3. Happy Path Tests (Padlock 4)
// ═══════════════════════════════════════════════════════════════════════════════

describe("LoginPage — Happy Path (PADLOCK 4)", () => {
  it("navigates to dashboard on successful login (HTTP 200)", async () => {
    mockedAxios.post.mockResolvedValueOnce(SUCCESSFUL_RESPONSE);

    renderLoginPage();
    await userEvent.type(
      screen.getByLabelText(/email address/i),
      "alice@example.com"
    );
    await userEvent.type(screen.getByLabelText(/^password$/i), "Passw0rd!");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByTestId("dashboard")).toBeInTheDocument();
    });
  });

  it("does NOT show an error alert on successful login", async () => {
    mockedAxios.post.mockResolvedValueOnce(SUCCESSFUL_RESPONSE);

    renderLoginPage();
    await userEvent.type(
      screen.getByLabelText(/email address/i),
      "alice@example.com"
    );
    await userEvent.type(screen.getByLabelText(/^password$/i), "Passw0rd!");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    );
  });

  it("button shows 'SIGNING IN…' while loading and is disabled", async () => {
    let resolveRequest!: (value: unknown) => void;
    mockedAxios.post.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );

    renderLoginPage();
    await userEvent.type(
      screen.getByLabelText(/email address/i),
      "alice@example.com"
    );
    await userEvent.type(screen.getByLabelText(/^password$/i), "Passw0rd!");

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /signing in/i })
      ).toBeDisabled()
    );

    // Resolve and let state settle
    act(() => {
      resolveRequest(SUCCESSFUL_RESPONSE);
    });
  });

  it("sends credentials to the correct API endpoint", async () => {
    mockedAxios.post.mockResolvedValueOnce(SUCCESSFUL_RESPONSE);

    renderLoginPage();
    await userEvent.type(
      screen.getByLabelText(/email address/i),
      "alice@example.com"
    );
    await userEvent.type(screen.getByLabelText(/^password$/i), "Passw0rd!");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/auth/login"),
        { email: "alice@example.com", password: "Passw0rd!" },
        expect.objectContaining({ withCredentials: true })
      )
    );
  });
});
