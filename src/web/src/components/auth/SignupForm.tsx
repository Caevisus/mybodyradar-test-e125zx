import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { validateEmail, validatePassword, validateUsername } from '../../utils/validation.utils';
import { AuthService } from '../../services/auth.service';
import type { IApiResponse } from '../../interfaces/common.interface';

// Material UI v5.14.0
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  Alert,
  Paper
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';

interface SignupFormProps {
  onSignupSuccess: (data: any) => void;
  onSignupError: (error: any) => void;
  onMFASetup?: (data: any) => void;
  className?: string;
}

interface SignupFormData {
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
  enableMFA: boolean;
}

// Validation schema using yup
const signupSchema = yup.object().shape({
  email: yup
    .string()
    .required('Email is required')
    .test('email', 'Invalid email format', (value) => validateEmail(value || '')),
  password: yup
    .string()
    .required('Password is required')
    .test('password', 'Password does not meet security requirements', 
      (value) => validatePassword(value || '').isValid),
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password')], 'Passwords must match'),
  username: yup
    .string()
    .required('Username is required')
    .test('username', 'Invalid username format', (value) => validateUsername(value || '')),
  enableMFA: yup.boolean()
});

const SignupForm: React.FC<SignupFormProps> = ({
  onSignupSuccess,
  onSignupError,
  onMFASetup,
  className
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch
  } = useForm<SignupFormData>({
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      username: '',
      enableMFA: false
    }
  });

  const authService = new AuthService({
    storageType: 'session',
    encryptionKey: process.env.REACT_APP_ENCRYPTION_KEY || ''
  }, {
    maxRetries: 3,
    requestTimeout: 30000,
    tokenRefreshThreshold: 300000
  });

  const handleSignup = useCallback(async (data: SignupFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response: IApiResponse<any> = await authService.register({
        email: data.email.trim(),
        password: data.password,
        username: data.username.trim(),
        enableMFA: data.enableMFA
      });

      if (response.success) {
        if (data.enableMFA && onMFASetup) {
          onMFASetup(response.data);
        } else {
          onSignupSuccess(response.data);
        }
      } else {
        setError(response.error?.message || 'Registration failed');
        onSignupError(response.error);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'An unexpected error occurred';
      setError(errorMessage);
      onSignupError(err);
    } finally {
      setIsLoading(false);
    }
  }, [authService, onSignupSuccess, onSignupError, onMFASetup]);

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  return (
    <Paper 
      elevation={3} 
      className={className}
      component="form"
      onSubmit={handleSubmit(handleSignup)}
      sx={{ p: 4, maxWidth: 500, width: '100%' }}
      role="form"
      aria-label="Sign up form"
    >
      <Typography variant="h5" component="h1" gutterBottom align="center">
        Create Account
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} role="alert">
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 2 }}>
        <TextField
          {...register('email')}
          label="Email"
          type="email"
          fullWidth
          error={!!errors.email}
          helperText={errors.email?.message}
          disabled={isLoading}
          InputProps={{
            'aria-describedby': 'email-error'
          }}
          required
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          {...register('username')}
          label="Username"
          fullWidth
          error={!!errors.username}
          helperText={errors.username?.message}
          disabled={isLoading}
          InputProps={{
            'aria-describedby': 'username-error'
          }}
          required
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          {...register('password')}
          label="Password"
          type={showPassword ? 'text' : 'password'}
          fullWidth
          error={!!errors.password}
          helperText={errors.password?.message}
          disabled={isLoading}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="toggle password visibility"
                  onClick={togglePasswordVisibility}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
            'aria-describedby': 'password-error'
          }}
          required
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          {...register('confirmPassword')}
          label="Confirm Password"
          type={showPassword ? 'text' : 'password'}
          fullWidth
          error={!!errors.confirmPassword}
          helperText={errors.confirmPassword?.message}
          disabled={isLoading}
          InputProps={{
            'aria-describedby': 'confirm-password-error'
          }}
          required
        />
      </Box>

      <FormControlLabel
        control={
          <Checkbox
            {...register('enableMFA')}
            disabled={isLoading}
            color="primary"
          />
        }
        label="Enable Multi-Factor Authentication"
        sx={{ mb: 2 }}
      />

      <Button
        type="submit"
        variant="contained"
        color="primary"
        fullWidth
        disabled={!isValid || isLoading}
        sx={{ mb: 2 }}
      >
        {isLoading ? (
          <CircularProgress size={24} color="inherit" />
        ) : (
          'Sign Up'
        )}
      </Button>

      <Typography variant="body2" color="textSecondary" align="center">
        By signing up, you agree to our Terms of Service and Privacy Policy
      </Typography>
    </Paper>
  );
};

export default SignupForm;