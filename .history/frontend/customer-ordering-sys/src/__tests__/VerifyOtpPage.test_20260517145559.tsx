import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VerifyOtpPage } from '../pages/VerifyOtpPage';
import { verifyOtp } from '../api/auth';

jest.mock('../api/auth');
const mockVerifyOtp = verifyOtp as jest.MockedFunction<typeof verifyOtp>;

describe('VerifyOtpPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('submits OTP and shows success state', async () => {
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

    render(<VerifyOtpPage defaultEmail="jane.doe@example.com" />);

    expect(screen.getByDisplayValue(/jane.doe@example.com/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/otp code/i), '654321');
    await userEvent.click(screen.getByRole('button', { name: /verify otp/i }));

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'jane.doe@example.com',
      otp_code: '654321',
    });

    expect(await screen.findByText(/account verified successfully/i)).toBeInTheDocument();
  });

  it('shows an error message for invalid OTP', async () => {
    mockVerifyOtp.mockRejectedValueOnce(new Error('Invalid OTP code'));

    render(<VerifyOtpPage defaultEmail="jane.doe@example.com" />);

    await userEvent.type(screen.getByLabelText(/otp code/i), '000000');
    await userEvent.click(screen.getByRole('button', { name: /verify otp/i }));

    expect(await screen.findByText(/invalid otp code/i)).toBeInTheDocument();
  });
});
