import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegistrationFlow } from '../pages/RegistrationFlow';
import { registerUser, verifyOtp } from '../api/auth';

jest.mock('../api/auth');
const mockRegisterUser = registerUser as jest.MockedFunction<typeof registerUser>;
const mockVerifyOtp = verifyOtp as jest.MockedFunction<typeof verifyOtp>;

describe('RegistrationFlow integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('completes registration and verification flow', async () => {
    mockRegisterUser.mockResolvedValueOnce({
      message: 'Please check your email to verify your account.',
      user: {
        user_id: 'user_123',
        email: 'jane.doe@example.com',
        full_name: 'Jane Doe',
        phone_number: '01012345678',
        status: 'PENDING_VERIFICATION',
        created_at: '2026-05-17T00:00:00Z',
      },
    });

    mockVerifyOtp.mockResolvedValueOnce({
      message: 'Account verified successfully',
      user: {
        user_id: 'user_123',
        email: 'jane.doe@example.com',
        full_name: 'Jane Doe',
        phone_number: '01012345678',
        status: 'ACTIVE',
        created_at: '2026-05-17T00:00:00Z',
      },
    });

    render(<RegistrationFlow />);

    await userEvent.type(screen.getByLabelText(/full name/i), 'Jane Doe');
    await userEvent.type(screen.getByLabelText(/email/i), 'jane.doe@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'SecurePassword1!');
    await userEvent.type(screen.getByLabelText(/phone number/i), '01012345678');
    await userEvent.click(screen.getByRole('button', { name: /register/i }));

    expect(await screen.findByText(/we sent a verification code to jane.doe@example.com/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveValue('jane.doe@example.com');

    await userEvent.type(screen.getByLabelText(/otp code/i), '654321');
    await userEvent.click(screen.getByRole('button', { name: /verify otp/i }));

    expect(await screen.findByText(/account verified successfully/i)).toBeInTheDocument();
  });
});
