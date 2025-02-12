import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import * as WebAuthn from '@simplewebauthn/browser'; // v7.2.0
import Input from '../common/Input';
import Button from '../common/Button';
import AuthService from '../../services/auth.service';
import { ValidationUtils } from '../../utils/validation.utils';

/**
 * Props interface for LoginForm component
 */
interface LoginFormProps {
  onSuccess: (response: any) => void;
  onError: (error: Error) => void;
  enableTOTP?: boolean;
  enableBiometric?: boolean;
  userType?: 'athlete' | 'coach' | 'medical';
}

/**
 * Interface for form data
 */
interface LoginFormData {
  email: string;
  password: string;
  totpCode?: string;
  useBiometric?: boolean;
}

/**
 * Material Design 3.0 compliant authentication form with WCAG 2.1 Level AA accessibility
 */
const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onError,
  enableTOTP = false,
  enableBiometric = false,
  userType = 'athlete'
}) => {
  // Form state management
  const { register, handleSubmit, formState: { errors }, watch } = useForm<LoginFormData>();
  const [isLoading, setIsLoading] = useState(false);
  const [showTOTP, setShowTOTP] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');

  // Initialize AuthService with secure storage configuration
  const authService = new AuthService(
    {
      encryptionKey: process.env.REACT_APP_ENCRYPTION_KEY || '',
      storageType: 'local'
    },
    {
      maxRetries: 3,
      requestTimeout: 30000,
      tokenRefreshThreshold: 300000
    }
  );

  /**
   * Handles biometric authentication
   */
  const handleBiometricAuth = async () => {
    try {
      setIsLoading(true);
      const biometricToken = await WebAuthn.startAuthentication();
      const response = await authService.handleBiometric(biometricToken.toString());
      
      if (response.success) {
        onSuccess(response.data);
      }
    } catch (error) {
      onError(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles TOTP verification
   */
  const handleTOTPVerification = async (totpCode: string) => {
    try {
      setIsLoading(true);
      const response = await authService.verifyTOTP(totpCode, sessionId);
      
      if (response.success) {
        onSuccess(response.data);
      } else {
        onError(new Error('Invalid TOTP code'));
      }
    } catch (error) {
      onError(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles form submission with comprehensive validation
   */
  const onSubmit = useCallback(async (data: LoginFormData) => {
    try {
      setIsLoading(true);

      if (data.useBiometric && enableBiometric) {
        await handleBiometricAuth();
        return;
      }

      // Validate credentials
      if (!ValidationUtils.validateEmail(data.email)) {
        throw new Error('Invalid email format');
      }

      const passwordValidation = ValidationUtils.validatePassword(data.password);
      if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.error?.message);
      }

      // Attempt login
      const response = await authService.login({
        email: data.email,
        password: data.password,
        totpCode: data.totpCode,
        deviceId: window.navigator.userAgent
      });

      if (response.success) {
        if (response.data.requiresMfa && enableTOTP) {
          setShowTOTP(true);
          setSessionId(response.data.sessionId);
        } else {
          onSuccess(response.data);
        }
      }
    } catch (error) {
      onError(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [enableBiometric, enableTOTP, onSuccess, onError]);

  return (
    <form 
      onSubmit={handleSubmit(onSubmit)}
      className="login-form"
      aria-label="Login form"
      noValidate
    >
      {!showTOTP ? (
        <>
          <Input
            {...register('email', { required: true })}
            label="Email"
            type="email"
            error={errors.email?.message}
            disabled={isLoading}
            required
            autoComplete="email"
            aria-describedby="email-error"
          />

          <Input
            {...register('password', { required: true })}
            label="Password"
            type="password"
            error={errors.password?.message}
            disabled={isLoading}
            required
            autoComplete="current-password"
            aria-describedby="password-error"
          />

          {enableBiometric && (
            <div className="biometric-option">
              <input
                type="checkbox"
                {...register('useBiometric')}
                id="useBiometric"
                disabled={isLoading}
              />
              <label htmlFor="useBiometric">
                Use biometric authentication
              </label>
            </div>
          )}

          <Button
            type="submit"
            isLoading={isLoading}
            disabled={isLoading}
            fullWidth
            color="primary"
            variant="contained"
            ariaLabel="Sign in"
          >
            Sign In
          </Button>
        </>
      ) : (
        <div className="totp-verification">
          <Input
            {...register('totpCode', { required: true })}
            label="Enter verification code"
            type="text"
            error={errors.totpCode?.message}
            disabled={isLoading}
            required
            autoComplete="one-time-code"
            maxLength={6}
            aria-describedby="totp-error"
          />

          <Button
            onClick={() => handleTOTPVerification(watch('totpCode'))}
            isLoading={isLoading}
            disabled={isLoading}
            fullWidth
            color="primary"
            variant="contained"
            ariaLabel="Verify code"
          >
            Verify Code
          </Button>
        </div>
      )}

      {/* Accessibility announcement for screen readers */}
      <div 
        role="status" 
        aria-live="polite" 
        className="sr-only"
      >
        {isLoading ? 'Signing in...' : ''}
      </div>
    </form>
  );
};

export default LoginForm;