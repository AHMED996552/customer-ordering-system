/**
 * auth.ts — UC-7 API layer
 * Uses axios with withCredentials so the browser accepts the HTTP-only cookie.
 */

import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE ?? "http://localhost:5000";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UserInfo {
  user_id: number;
  email: string;
  full_name: string;
}

export interface LoginResponse {
  message: string;
  user: UserInfo;
}

/** Maps HTTP status codes to friendly error messages. */
export function getLoginErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return "Please enter both email and password.";
    case 401:
      return "Invalid email or password.";
    case 403:
      return "Your account is not active. Please verify your email or contact support.";
    case 429:
      return "Too many failed attempts. Your account is temporarily locked. Please try again later.";
    default:
      return "An unexpected error occurred. Please try again.";
  }
}

/**
 * Sends login credentials to the backend.
 * On success the server sets an HTTP-only `auth_token` cookie automatically.
 * The JWT is NEVER returned in the response body.
 */
export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  const response = await axios.post<LoginResponse>(
    `${API_BASE}/api/v1/auth/login`,
    payload,
    {
      withCredentials: true, // accept the HTTP-only cookie
      headers: { "Content-Type": "application/json" },
    }
  );
  return response.data;
}
