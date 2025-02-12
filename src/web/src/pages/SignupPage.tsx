import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom'; // ^6.0.0
import { useSnackbar } from 'notistack'; // ^3.0.0
import SignupForm from '../components/auth/SignupForm';
import { useAuth } from '../contexts/AuthContext';
import Loading from '../components/common/Loading';

interface SignupPageProps {
  className?: string;
  enableBiometric?: boolean;
  defaultRole?: string;
}

const SignupPage: React.FC<SignupPageProps> = React.memo(({
  className = '',
  enableBiometric = true,
  defaultRole = 'athlete'
}) => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { register, setupMFA, setupBiometric } = useAuth();

  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<'signup' | 'mfa' | 'biometric'>('signup');
  const [registrationData, setRegistrationData] = useState<any>(null);

  // Handle successful signup
  const handleSignupSuccess = useCallback(async (userData: any) => {
    try {
      setIsLoading(true);
      setRegistrationData(userData);

      // Register user
      const registerResponse = await register(userData);

      if (registerResponse.success) {
        // Setup MFA if required for role
        if (userData.enableMFA) {
          setCurrentStep('mfa');
          const mfaResponse = await setupMFA(registerResponse.data.userId);
          
          if (!mfaResponse.success) {
            throw new Error('MFA setup failed');
          }
        }

        // Setup biometric if enabled and supported
        if (enableBiometric && window.PublicKeyCredential) {
          setCurrentStep('biometric');
          const biometricResponse = await setupBiometric(registerResponse.data.userId);
          
          if (!biometricResponse.success) {
            enqueueSnackbar('Biometric setup skipped', { variant: 'warning' });
          }
        }

        // Registration complete - redirect based on role
        const dashboardRoute = `/${userData.role || defaultRole}/dashboard`;
        enqueueSnackbar('Registration successful!', { variant: 'success' });
        navigate(dashboardRoute);
      } else {
        throw new Error(registerResponse.error?.message || 'Registration failed');
      }
    } catch (error) {
      handleSignupError(error);
    } finally {
      setIsLoading(false);
    }
  }, [register, setupMFA, setupBiometric, enableBiometric, defaultRole, navigate, enqueueSnackbar]);

  // Handle signup errors
  const handleSignupError = useCallback((error: any) => {
    const errorMessage = error instanceof Error ? error.message : 'Registration failed';
    enqueueSnackbar(errorMessage, { 
      variant: 'error',
      autoHideDuration: 5000,
      anchorOrigin: { vertical: 'top', horizontal: 'center' }
    });
    setCurrentStep('signup');
    setRegistrationData(null);
  }, [enqueueSnackbar]);

  // Render loading state
  if (isLoading) {
    return (
      <Loading 
        message={`Setting up your account${currentStep === 'mfa' ? ' - MFA Configuration' : 
          currentStep === 'biometric' ? ' - Biometric Setup' : ''}`}
        size="large"
        overlay
      />
    );
  }

  return (
    <div 
      className={`signup-page ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: 'var(--spacing-md)',
        backgroundColor: 'var(--color-background)'
      }}
    >
      <SignupForm
        onSignupSuccess={handleSignupSuccess}
        onSignupError={handleSignupError}
        onMFASetup={registrationData}
        className="signup-page__form"
      />
    </div>
  );
});

SignupPage.displayName = 'SignupPage';

export default SignupPage;