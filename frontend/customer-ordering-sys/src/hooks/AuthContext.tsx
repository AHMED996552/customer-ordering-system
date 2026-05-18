/**
 * AuthContext.tsx — Global authentication state (UC-7)
 * Wraps the app and makes the logged-in user accessible from any component.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { UserInfo } from "../api/auth";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AuthState {
  user: UserInfo | null;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  /** Call after a successful login to store user metadata. */
  setLoggedInUser: (user: UserInfo) => void;
  /** Clears user state (logout). */
  clearUser: () => void;
}

// ── Context ────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ── Provider ───────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserInfo | null>(null);

  const setLoggedInUser = useCallback((u: UserInfo) => {
    setUser(u);
  }, []);

  const clearUser = useCallback(() => {
    setUser(null);
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    setLoggedInUser,
    clearUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Usage:
 *   const { user, isAuthenticated, setLoggedInUser } = useAuth();
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}
