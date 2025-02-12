import React from 'react';
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import LoginForm from '../../../components/auth/LoginForm';
import AuthService from '../../../services/auth.service';
import { ValidationUtils } from '../../../utils/validation.utils';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock AuthService
jest.mock('../../../services/auth.service');

describe('LoginForm', () => {
  // Test data
  const mockUser = {
    email: 'athlete@example.com',
    password: 'SecurePass123!',
    totpCode: '123456'
  };

  // Mock functions
  const mockOnSuccess = jest.fn();
  const mockOnError = jest.fn();

  // Setup before each test
  beforeEach(() => {
    jest.clearAllMocks();
    // Configure default mock implementations
    (AuthService as jest.Mock).mockImplementation(() => ({
      login: jest.fn(),
      verifyTOTP: jest.fn(),
      handleBiometric: jest.fn(),
      handleOAuth: jest.fn()
    }));
  });

  describe('Accessibility Compliance', () => {
    it('should meet WCAG 2.1 Level AA standards', async () => {
      const { container } = render(
        <LoginForm
          onSuccess={mockOnSuccess}
          onError={mockOnError}
          enableTOTP={true}
          enableBiometric={true}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', () => {
      render(
        <LoginForm
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      // Test tab order
      emailInput.focus();
      expect(document.activeElement).toBe(emailInput);
      
      userEvent.tab();
      expect(document.activeElement).toBe(passwordInput);
      
      userEvent.tab();
      expect(document.activeElement).toBe(submitButton);
    });

    it('should announce form errors to screen readers', async () => {
      render(
        <LoginForm
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      );

      fireEvent.submit(screen.getByRole('form'));

      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        expect(alerts).toHaveLength(2); // Email and password required errors
        expect(alerts[0]).toHaveTextContent(/required/i);
      });
    });
  });

  describe('Standard Authentication', () => {
    it('should handle successful login with username/password', async () => {
      const mockAuthResponse = {
        success: true,
        data: {
          accessToken: 'mock-token',
          user: { id: '1', name: 'Test User' }
        }
      };

      const authService = new AuthService({}, {});
      jest.spyOn(authService, 'login').mockResolvedValue(mockAuthResponse);

      render(
        <LoginForm
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      );

      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: mockUser.email }
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: mockUser.password }
      });
      fireEvent.submit(screen.getByRole('form'));

      await waitFor(() => {
        expect(authService.login).toHaveBeenCalledWith({
          email: mockUser.email,
          password: mockUser.password,
          deviceId: expect.any(String)
        });
        expect(mockOnSuccess).toHaveBeenCalledWith(mockAuthResponse.data);
      });
    });

    it('should handle login validation errors', async () => {
      render(
        <LoginForm
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      );

      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'invalid-email' }
      });
      fireEvent.submit(screen.getByRole('form'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/invalid email/i);
      });
    });
  });

  describe('Two-Factor Authentication', () => {
    it('should handle TOTP verification flow', async () => {
      const mockTOTPResponse = {
        success: true,
        data: {
          requiresMfa: true,
          sessionId: 'mock-session-id'
        }
      };

      const authService = new AuthService({}, {});
      jest.spyOn(authService, 'login').mockResolvedValue(mockTOTPResponse);
      jest.spyOn(authService, 'verifyTOTP').mockResolvedValue({
        success: true,
        data: { accessToken: 'mock-token' }
      });

      render(
        <LoginForm
          onSuccess={mockOnSuccess}
          onError={mockOnError}
          enableTOTP={true}
        />
      );

      // Initial login
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: mockUser.email }
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: mockUser.password }
      });
      fireEvent.submit(screen.getByRole('form'));

      // TOTP verification
      await waitFor(() => {
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/verification code/i), {
        target: { value: mockUser.totpCode }
      });
      fireEvent.click(screen.getByRole('button', { name: /verify code/i }));

      await waitFor(() => {
        expect(authService.verifyTOTP).toHaveBeenCalledWith(
          mockUser.totpCode,
          'mock-session-id'
        );
      });
    });
  });

  describe('Biometric Authentication', () => {
    it('should handle biometric authentication flow', async () => {
      const mockBiometricResponse = {
        success: true,
        data: { accessToken: 'mock-token' }
      };

      const authService = new AuthService({}, {});
      jest.spyOn(authService, 'handleBiometric').mockResolvedValue(mockBiometricResponse);

      render(
        <LoginForm
          onSuccess={mockOnSuccess}
          onError={mockOnError}
          enableBiometric={true}
          userType="athlete"
        />
      );

      const biometricCheckbox = screen.getByLabelText(/use biometric/i);
      fireEvent.click(biometricCheckbox);
      fireEvent.submit(screen.getByRole('form'));

      await waitFor(() => {
        expect(authService.handleBiometric).toHaveBeenCalled();
        expect(mockOnSuccess).toHaveBeenCalledWith(mockBiometricResponse.data);
      });
    });
  });

  describe('Loading States', () => {
    it('should disable form controls during authentication', async () => {
      const authService = new AuthService({}, {});
      jest.spyOn(authService, 'login').mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      render(
        <LoginForm
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      );

      fireEvent.submit(screen.getByRole('form'));

      expect(screen.getByRole('button')).toBeDisabled();
      expect(screen.getByLabelText(/email/i)).toBeDisabled();
      expect(screen.getByLabelText(/password/i)).toBeDisabled();
    });

    it('should show loading indicator during authentication', async () => {
      render(
        <LoginForm
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      );

      fireEvent.submit(screen.getByRole('form'));

      expect(screen.getByRole('status')).toHaveTextContent(/signing in/i);
    });
  });
});