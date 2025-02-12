/**
 * @fileoverview Redux slice for authentication state management
 * @version 1.0.0
 * 
 * Implements secure multi-factor authentication, role-based access control,
 * and JWT-based session management with OAuth 2.0 integration
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'; // v1.9.5
import { AuthService } from '../services/auth.service';
import type { IApiResponse } from '../interfaces/common.interface';

// Enhanced interface for authentication state
interface IAuthState {
  isAuthenticated: boolean;
  user: any | null;
  roles: string[];
  accessToken: string | null;
  refreshToken: string | null;
  sessionId: string | null;
  mfaVerified: boolean;
  biometricEnabled: boolean;
  loading: boolean;
  error: {
    code?: string;
    message?: string;
    details?: Record<string, any>;
  } | null;
  lastTokenRefresh: number;
  authAttempts: number;
}

// Enhanced interface for login payload
interface ILoginPayload {
  email: string;
  password: string;
  totpCode?: string;
  useBiometric?: boolean;
  biometricData?: string;
  deviceId?: string;
}

// Initialize authentication service
const authService = new AuthService(
  {
    encryptionKey: process.env.ENCRYPTION_KEY || 'default-key',
    storageType: 'local'
  },
  {
    maxRetries: 3,
    requestTimeout: 30000,
    tokenRefreshThreshold: 300000
  }
);

// Initial state with comprehensive security context
const initialState: IAuthState = {
  isAuthenticated: false,
  user: null,
  roles: [],
  accessToken: null,
  refreshToken: null,
  sessionId: null,
  mfaVerified: false,
  biometricEnabled: false,
  loading: false,
  error: null,
  lastTokenRefresh: 0,
  authAttempts: 0
};

// Enhanced async thunk for login with MFA and biometric support
export const loginAsync = createAsyncThunk(
  'auth/login',
  async (credentials: ILoginPayload, { rejectWithValue }) => {
    try {
      const response = await authService.login({
        email: credentials.email,
        password: credentials.password,
        totpCode: credentials.totpCode,
        biometricToken: credentials.biometricData,
        deviceId: credentials.deviceId
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Authentication failed');
      }

      // Handle MFA verification if required
      if (response.data.requiresMfa && !credentials.totpCode) {
        return {
          requiresMfa: true,
          sessionId: response.data.sessionId
        };
      }

      // Handle biometric verification if enabled
      if (credentials.useBiometric && credentials.biometricData) {
        await authService.handleBiometric(credentials.biometricData);
      }

      return response.data;
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'AUTH_ERROR',
        message: error.message,
        details: error.details
      });
    }
  }
);

// Enhanced async thunk for secure logout
export const logoutAsync = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout();
    } catch (error: any) {
      return rejectWithValue({
        code: 'LOGOUT_ERROR',
        message: error.message
      });
    }
  }
);

// Enhanced async thunk for token refresh
export const refreshTokenAsync = createAsyncThunk(
  'auth/refreshToken',
  async (_, { getState, rejectWithValue }) => {
    try {
      const response = await authService.refreshToken();
      return response.data;
    } catch (error: any) {
      return rejectWithValue({
        code: 'REFRESH_ERROR',
        message: error.message
      });
    }
  }
);

// Enhanced auth slice with comprehensive security features
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    resetError: (state) => {
      state.error = null;
    },
    setMfaVerified: (state, action) => {
      state.mfaVerified = action.payload;
    },
    setBiometricEnabled: (state, action) => {
      state.biometricEnabled = action.payload;
    },
    updateAuthAttempts: (state) => {
      state.authAttempts += 1;
    },
    resetAuthAttempts: (state) => {
      state.authAttempts = 0;
    }
  },
  extraReducers: (builder) => {
    builder
      // Login handling
      .addCase(loginAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginAsync.fulfilled, (state, action) => {
        if (action.payload.requiresMfa) {
          state.sessionId = action.payload.sessionId;
          state.loading = false;
          return;
        }

        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.roles = action.payload.roles;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.sessionId = action.payload.sessionId;
        state.mfaVerified = true;
        state.loading = false;
        state.lastTokenRefresh = Date.now();
        state.authAttempts = 0;
      })
      .addCase(loginAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as any;
        state.authAttempts += 1;
      })

      // Logout handling
      .addCase(logoutAsync.pending, (state) => {
        state.loading = true;
      })
      .addCase(logoutAsync.fulfilled, (state) => {
        return initialState;
      })
      .addCase(logoutAsync.rejected, (state, action) => {
        state.error = action.payload as any;
        state.loading = false;
      })

      // Token refresh handling
      .addCase(refreshTokenAsync.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.lastTokenRefresh = Date.now();
      })
      .addCase(refreshTokenAsync.rejected, (state, action) => {
        state.error = action.payload as any;
        state.isAuthenticated = false;
      });
  }
});

export const {
  resetError,
  setMfaVerified,
  setBiometricEnabled,
  updateAuthAttempts,
  resetAuthAttempts
} = authSlice.actions;

export default authSlice.reducer;