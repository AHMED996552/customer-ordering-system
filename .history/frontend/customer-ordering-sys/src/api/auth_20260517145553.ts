export interface RegisterPayload {
  full_name: string;
  email: string;
  password: string;
  phone_number: string;
}

export interface RegisterResponse {
  message: string;
  user: {
    user_id: string;
    email: string;
    full_name: string;
    phone_number: string;
    status: string;
    created_at: string;
  };
}

export interface VerifyOtpPayload {
  email: string;
  otp_code: string;
}

export interface VerifyOtpResponse {
  message: string;
  user: {
    user_id: string;
    email: string;
    full_name: string;
    phone_number: string;
    status: string;
    created_at: string;
  };
}

async function parseError(response: Response) {
  let errorPayload: any;
  try {
    errorPayload = await response.json();
  } catch {
    errorPayload = null;
  }

  const message =
    errorPayload?.message ||
    errorPayload?.error ||
    errorPayload?.error_code ||
    JSON.stringify(errorPayload) ||
    response.statusText;

  const error = new Error(message || 'Request failed');
  (error as any).status = response.status;
  (error as any).fields = errorPayload?.fields;
  return error;
}

export async function registerUser(payload: RegisterPayload): Promise<RegisterResponse> {
  const response = await fetch('/api/v1/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return response.json();
}

export async function verifyOtp(payload: VerifyOtpPayload): Promise<VerifyOtpResponse> {
  const response = await fetch('/api/v1/auth/verify-otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return response.json();
}
