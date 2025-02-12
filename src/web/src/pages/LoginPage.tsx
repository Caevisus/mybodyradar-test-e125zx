/**
 * @fileoverview Enhanced Login Page Component with Material Design 3.0 compliance,
 * multi-factor authentication, biometric support, and WCAG 2.1 Level AA accessibility
 * @version 1.0.0
 */

import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalytics } from '@analytics/react';
import { ErrorBoundary } from 'react-error-boundary';
import LoginForm from '../components/auth/LoginForm';
import Loading from '../components/common/Loading';
import { useAuth } from '../hooks/useAuth';
import type { IApiResponse } from '../interfaces/common.interface';

/**
 * Enhanced Login Page component implementing Material Design 3.0 and WCAG 2.1 Level AA
 */
const LoginPage: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const analytics = useAnalytics();
  const {
    isAuthenticated,
    login,
    verifyMFA,
    biometricAuth,
    loading
  } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  /**
   * Handles successful login with enhanced security checks
   */
  const handleLoginSuccess = useCallback(async (response: IApiResponse<any>) => {
    try {
      analytics.track('login_success', {
        timestamp: new Date().toISOString(),
        userType: response.data?.user?.type
      });

      if (response.data?.requiresMfa) {
        return handleMFARequired(response.data);
      }

      navigate('/dashboard');
    } catch (error) {
      handleLoginError(error as Error);
    }
  }, [navigate, analytics]);

  /**
   * Handles MFA verification flow
   */
  const handleMFARequired = useCallback(async (mfaData: any) => {
    try {
      analytics.track('mfa_required', {
        timestamp: new Date().toISOString()
      });

      const verified = await verifyMFA(mfaData.totpCode);
      if (verified) {
        analytics.track('mfa_success', {
          timestamp: new Date().toISOString()
        });
        navigate('/dashboard');
      }
    } catch (error) {
      handleLoginError(error as Error);
    }
  }, [verifyMFA, navigate, analytics]);

  /**
   * Enhanced error handling for login failures
   */
  const handleLoginError = useCallback((error: Error) => {
    analytics.track('login_error', {
      error: error.message,
      timestamp: new Date().toISOString()
    });

    // Clear sensitive data from memory
    window.requestIdleCallback(() => {
      const sensitiveFields = document.querySelectorAll('input[type="password"]');
      sensitiveFields.forEach(field => (field as HTMLInputElement).value = '');
    });
  }, [analytics]);

  /**
   * Error boundary fallback component
   */
  const ErrorFallback = useCallback(({ error, resetErrorBoundary }: any) => (
    <div 
      role="alert"
      className="login-error"
      aria-live="polite"
    >
      <h2>Login Error</h2>
      <p>{error.message}</p>
      <button 
        onClick={resetErrorBoundary}
        className="error-reset-button"
      >
        Try Again
      </button>
    </div>
  ), []);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      <div 
        className="login-page"
        role="main"
        aria-labelledby="login-title"
      >
        <div className="login-container">
          <h1 
            id="login-title"
            className="login-title"
          >
            Sign In
          </h1>

          <LoginForm
            onSuccess={handleLoginSuccess}
            onError={handleLoginError}
            onMFARequired={handleMFARequired}
            enableTOTP={true}
            enableBiometric={true}
          />

          {/* Accessibility links */}
          <div className="accessibility-links">
            <a 
              href="/forgot-password"
              className="forgot-password-link"
            >
              Forgot Password?
            </a>
            <a 
              href="/help"
              className="help-link"
            >
              Need Help?
            </a>
          </div>

          {/* Loading overlay */}
          {loading && (
            <Loading
              overlay={true}
              message="Signing in..."
              color="primary"
              size="large"
              preventClick={true}
              testId="login-loading"
            />
          )}

          {/* Screen reader announcements */}
          <div 
            role="status" 
            aria-live="polite" 
            className="sr-only"
          >
            {loading ? 'Signing in, please wait...' : ''}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
});

LoginPage.displayName = 'LoginPage';

export default LoginPage;