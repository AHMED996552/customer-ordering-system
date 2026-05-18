/**
 * LoginPage.tsx — UC-7: Authenticate User Identity
 * Converted from the designer's HTML into a fully functional React/TypeScript
 * component with:
 *   - Controlled email + password inputs
 *   - Password visibility toggle
 *   - Form submission with axios (withCredentials)
 *   - Inline error states for 401, 403, 429
 *   - Redirect on success via AuthContext + react-router-dom
 */

import React, { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios, { AxiosError } from "axios";

import { loginUser, getLoginErrorMessage } from "../api/auth";
import { useAuth } from "../hooks/AuthContext";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ApiErrorBody {
  error: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setLoggedInUser } = useAuth();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // ── Submit handler ─────────────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const data = await loginUser({ email: email.trim(), password });
      setLoggedInUser(data.user);
      navigate("/"); // redirect to dashboard on success
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const axiosErr = err as AxiosError<ApiErrorBody>;
        const status = axiosErr.response?.status ?? 500;
        const serverMsg = axiosErr.response?.data?.error;
        // Prefer the server-provided message; fall back to our friendly mapping
        setError(serverMsg ?? getLoginErrorMessage(status));
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="dark">
      <div
        className="bg-background text-on-background min-h-screen flex items-center justify-center overflow-x-hidden relative"
        style={{ fontFamily: "'Manrope', sans-serif" }}
      >
        {/* Ambient background glows */}
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          <div
            className="absolute rounded-full"
            style={{
              top: "-20%",
              left: "-10%",
              width: "60%",
              height: "60%",
              background: "rgba(175,198,252,0.10)",
              filter: "blur(120px)",
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              bottom: "-10%",
              right: "-5%",
              width: "50%",
              height: "50%",
              background: "rgba(60,63,90,0.10)",
              filter: "blur(100px)",
            }}
          />
        </div>

        {/* ── Main content ────────────────────────────────────────────────── */}
        <main className="relative z-10 w-full max-w-[480px] px-4 py-6">
          {/* ── Brand header ──────────────────────────────────────────────── */}
          <div className="flex flex-col items-center mb-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 inner-glow"
              style={{
                background: "rgba(40,68,126,0.30)",
                border: "1px solid rgba(175,198,252,0.20)",
              }}
            >
              <span
                className="material-symbols-outlined text-primary"
                style={{ fontSize: "40px" }}
              >
                restaurant_menu
              </span>
            </div>
            <h1
              className="text-primary tracking-tight"
              style={{
                fontFamily: "'Epilogue', sans-serif",
                fontWeight: 800,
                fontSize: "28px",
                lineHeight: "36px",
              }}
            >
              LuxeEats
            </h1>
            <p
              className="text-[11px] tracking-widest mt-1"
              style={{ color: "rgba(201,197,208,0.60)", fontWeight: 600 }}
            >
              PREMIUM CULINARY ACCESS
            </p>
          </div>

          {/* ── Glass card ────────────────────────────────────────────────── */}
          <div className="glass-island rounded-[32px] p-6">
            {/* Card heading */}
            <div className="text-center mb-5">
              <h2
                className="text-on-surface mb-1"
                style={{
                  fontFamily: "'Epilogue', sans-serif",
                  fontWeight: 700,
                  fontSize: "24px",
                }}
              >
                Welcome Back
              </h2>
              <p
                className="text-sm"
                style={{ color: "rgba(201,197,208,0.80)" }}
              >
                Sign in to your private account
              </p>
            </div>

            {/* ── Error banner ────────────────────────────────────────────── */}
            {error && (
              <div
                id="login-error-message"
                role="alert"
                className="mb-4 px-4 py-3 rounded-xl text-sm font-medium"
                style={{
                  background: "rgba(255,80,80,0.12)",
                  border: "1px solid rgba(255,80,80,0.25)",
                  color: "#ff8080",
                }}
              >
                {error}
              </div>
            )}

            {/* ── Form ────────────────────────────────────────────────────── */}
            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              {/* Email */}
              <div className="space-y-1">
                <label
                  htmlFor="login-email"
                  className="block text-[11px] font-semibold tracking-widest ml-1"
                  style={{ color: "rgba(201,197,208,0.70)" }}
                >
                  EMAIL ADDRESS
                </label>
                <div className="relative group">
                  <span
                    className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 transition-colors"
                    style={{
                      color: "rgba(201,197,208,0.40)",
                      fontSize: "20px",
                    }}
                  >
                    mail
                  </span>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-xl py-4 pl-[52px] pr-4 text-on-surface transition-all duration-300 focus:outline-none focus:ring-1"
                    style={{
                      background: "rgba(20,20,24,0.50)",
                      border: "1px solid rgba(71,68,78,0.30)",
                      color: "#e4e2eb",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#afc6fc";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(71,68,78,0.30)";
                    }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <div className="flex justify-between items-center px-1">
                  <label
                    htmlFor="login-password"
                    className="text-[11px] font-semibold tracking-widest"
                    style={{ color: "rgba(201,197,208,0.70)" }}
                  >
                    PASSWORD
                  </label>
                  {/* <a
                    href="#"
                    className="text-[11px] font-semibold tracking-widest text-primary hover:text-primary-fixed-dim transition-colors"
                  >
                    FORGOT PASSWORD?
                  </a> */}
                </div>
                <div className="relative group">
                  <span
                    className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 transition-colors"
                    style={{
                      color: "rgba(201,197,208,0.40)",
                      fontSize: "20px",
                    }}
                  >
                    lock
                  </span>
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-xl py-4 pl-[52px] pr-12 text-on-surface transition-all duration-300 focus:outline-none"
                    style={{
                      background: "rgba(20,20,24,0.50)",
                      border: "1px solid rgba(71,68,78,0.30)",
                      color: "#e4e2eb",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#afc6fc";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(71,68,78,0.30)";
                    }}
                  />
                  {/* Visibility toggle */}
                  <button
                    id="toggle-password-visibility"
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "rgba(201,197,208,0.40)" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color =
                        "rgba(201,197,208,0.80)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color =
                        "rgba(201,197,208,0.40)";
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                      {showPassword ? "visibility" : "visibility_off"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                id="login-submit-btn"
                type="submit"
                disabled={isLoading}
                className="w-full shimmer-btn py-4 rounded-xl font-semibold tracking-widest shadow-glow hover:shadow-glow-lg mt-2 text-[11px] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? "SIGNING IN…" : "SIGN IN"}
              </button>
            </form>

            {/* Divider */}
            {/* <div className="flex items-center my-6 gap-4">
              <div
                className="h-px flex-1"
                style={{ background: "rgba(71,68,78,0.20)" }}
              />
              <span
                className="text-[11px] tracking-widest font-semibold"
                style={{ color: "rgba(201,197,208,0.40)" }}
              >
                OR CONTINUE WITH
              </span>
              <div
                className="h-px flex-1"
                style={{ background: "rgba(71,68,78,0.20)" }}
              />
            </div> */}

            {/* Social buttons */}
            {/* <div className="grid grid-cols-2 gap-4">
              <button
                id="apple-login-btn"
                type="button"
                className="flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300"
                style={{
                  background: "rgba(39,39,48,0.40)",
                  border: "1px solid rgba(71,68,78,0.20)",
                  color: "#e4e2eb",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "rgba(175,198,252,0.40)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "rgba(71,68,78,0.20)";
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: "20px",
                    fontVariationSettings: "'FILL' 1",
                  }}
                >
                  brand_family
                </span>
                <span className="text-[11px] font-semibold tracking-widest">
                  APPLE
                </span>
              </button>
              <button
                id="google-login-btn"
                type="button"
                className="flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300"
                style={{
                  background: "rgba(39,39,48,0.40)",
                  border: "1px solid rgba(71,68,78,0.20)",
                  color: "#e4e2eb",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "rgba(175,198,252,0.40)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "rgba(71,68,78,0.20)";
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                  google
                </span>
                <span className="text-[11px] font-semibold tracking-widest">
                  GOOGLE
                </span>
              </button>
            </div> */}
          </div>

          {/* Footer */}
          <p
            className="text-center mt-6 text-sm"
            style={{ color: "rgba(201,197,208,0.70)" }}
          >
            New to LuxeEats?{" "}
            <Link
              to="/register"
              className="text-primary font-bold hover:underline underline-offset-4 transition-all"
            >
              Create an account
            </Link>
          </p>
        </main>
      </div>
    </div>
  );
};

export default LoginPage;
