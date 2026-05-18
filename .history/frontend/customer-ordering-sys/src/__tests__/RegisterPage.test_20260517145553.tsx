import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterPage } from '../pages/RegisterPage';
import { registerUser } from '../api/auth';

jest.mock('../api/auth');
const mockRegisterUser = registerUser as jest.MockedFunction<typeof registerUser>;

describe('RegisterPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('submits registration details and displays success message', async () => {
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

    render(<RegisterPage />);

    await userEvent.type(screen.getByLabelText(/full name/i), 'Jane Doe');
    await userEvent.type(screen.getByLabelText(/email/i), 'jane.doe@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'SecurePassword1!');
    await userEvent.type(screen.getByLabelText(/phone number/i), '01012345678');
    await userEvent.click(screen.getByRole('button', { name: /register/i }));

    expect(mockRegisterUser).toHaveBeenCalledWith({
      full_name: 'Jane Doe',
      email: 'jane.doe@example.com',
      password: 'SecurePassword1!',
      phone_number: '01012345678',
    });

    expect(await screen.findByText(/please check your email to verify your account/i)).toBeInTheDocument();
  });

  it('renders validation errors returned by the backend', async () => {
    const error = new Error('Password requirements are not met');
    (error as any).fields = {
      password: ['Password must contain uppercase, lowercase and digits'],
    };
    mockRegisterUser.mockRejectedValueOnce(error);

    render(<RegisterPage />);

    await userEvent.type(screen.getByLabelText(/full name/i), 'Jane Doe');
    await userEvent.type(screen.getByLabelText(/email/i), 'jane.doe@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), '123');
    await userEvent.type(screen.getByLabelText(/phone number/i), '01012345678');
    await userEvent.click(screen.getByRole('button', { name: /register/i }));

    expect(await screen.findByText(/password must contain uppercase, lowercase and digits/i)).toBeInTheDocument();
    expect(screen.getByText(/password requirements are not met/i)).toBeInTheDocument();
  });
});
