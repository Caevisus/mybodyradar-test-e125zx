/**
 * @fileoverview Enhanced Authentication Context Provider with comprehensive security features
 * @version 1.0.0
 * 
 * Implements secure authentication state management with multi-factor authentication,
 * biometric verification, and role-based access control for the smart-apparel system.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AuthService } from '../services/auth.service';
import { getStorageItem, setStorageItem } from '../utils/storage.utils';

// Authentication state interface
interface IAuthState {
  isAuthenticated: boolean;
  user: IAthlete | null;
  loading: boolean;
  error: string | null;
  mfaRequired: boolean;
  biometricEnabled: boolean;
  userRole: string | null;
  sessionInfo: ISessionInfo | null;
  securityContext: ISecurityContext;
}

// Session information interface
interface ISessionInfo {
  sessionId: string;
  startTime: Date;
  lastActivity: Date;
  deviceId: string;
  mfaVerified: boolean;
  biometricVerified: boolean;
}

// Security context interface
interface ISecurityContext {
  lastLoginTime: Date | null;
  deviceId: string | null;
  isTrustedDevice: boolean;
  securityEvents: Array<{
    type: string;
    timestamp: Date;
    details: Record<string, any>;
  }>;
}

// Auth context interface
interface IAuthContext extends IAuthState {
  login: (credentials: IAuthCredentials) => Promise<void>;
  logout: () => Promise<void>;
  verifyMfa: (totpCode: string) => Promise<boolean>;
  verifyBiometric: (biometricToken: string) => Promise<boolean>;
  refreshSession: () => Promise<void>;
  updateSecurityContext: (updates: Partial<ISecurityContext>) => void;
}

// Initial security context
const initialSecurityContext: ISecurityContext = {
  lastLoginTime: null,
  deviceId: null,
  isTrustedDevice: false,
  securityEvents: []
};

// Create the auth context
const AuthContext = createContext<IAuthContext | undefined>(undefined);

// Session timeout configuration (in milliseconds)
const SESSION_TIMEOUTS = {
  ATHLETE: 24 * 60 * 60 * 1000, // 24 hours
  COACH: 12 * 60 * 60 * 1000,   // 12 hours
  MEDICAL: 8 * 60 * 60 * 1000,  // 8 hours
  ADMIN: 4 * 60 * 60 * 1000     // 4 hours
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authService = new AuthService({
    storageConfig: {
      encryptionKey: process.env.VITE_STORAGE_ENCRYPTION_KEY!,
      storageType: 'local'
    },
    serviceConfig: {
      maxRetries: 3,
      requestTimeout: 30000,
      tokenRefreshThreshold: 300000 // 5 minutes
    }
  });

  // Initialize state
  const [state, setState] = useState<IAuthState>({
    isAuthenticated: false,
    user: null,
    loading: true,
    error: null,
    mfaRequired: false,
    biometricEnabled: false,
    userRole: null,
    sessionInfo: null,
    securityContext: initialSecurityContext
  });

  // Initialize session from storage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedSession = await getStorageItem<ISessionInfo>('session', true);
        const storedContext = await getStorageItem<ISecurityContext>('securityContext', true);

        if (storedSession.success && storedSession.data && storedContext.success && storedContext.data) {
          // Validate session timeout based on user role
          const sessionTimeout = SESSION_TIMEOUTS[state.userRole as keyof typeof SESSION_TIMEOUTS] || SESSION_TIMEOUTS.ATHLETE;
          const isSessionValid = new Date().getTime() - new Date(storedSession.data.lastActivity).getTime() < sessionTimeout;

          if (isSessionValid) {
            await refreshSession();
          } else {
            await logout();
          }
        }
      } catch (error) {
        console.error('Session initialization error:', error);
        await logout();
      } finally {
        setState(prev => ({ ...prev, loading: false }));
      }
    };

    initializeAuth();
  }, []);

  // Login handler
  const login = async (credentials: IAuthCredentials): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const response = await authService.login(credentials);

      if (response.success) {
        const { user, requiresMfa, sessionId } = response.data;

        // Create new session info
        const sessionInfo: ISessionInfo = {
          sessionId,
          startTime: new Date(),
          lastActivity: new Date(),
          deviceId: crypto.randomUUID(),
          mfaVerified: !requiresMfa,
          biometricVerified: false
        };

        await setStorageItem('session', sessionInfo, true);

        setState(prev => ({
          ...prev,
          isAuthenticated: !requiresMfa,
          user,
          mfaRequired: requiresMfa,
          sessionInfo,
          userRole: user.role,
          securityContext: {
            ...prev.securityContext,
            lastLoginTime: new Date(),
            deviceId: sessionInfo.deviceId
          }
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Authentication failed'
      }));
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  // MFA verification handler
  const verifyMfa = async (totpCode: string): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const response = await authService.verifyMFA(totpCode);

      if (response.success) {
        setState(prev => ({
          ...prev,
          isAuthenticated: true,
          mfaRequired: false,
          sessionInfo: prev.sessionInfo ? {
            ...prev.sessionInfo,
            mfaVerified: true,
            lastActivity: new Date()
          } : null
        }));

        return true;
      }

      return false;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'MFA verification failed'
      }));
      return false;
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  // Biometric verification handler
  const verifyBiometric = async (biometricToken: string): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const response = await authService.verifyBiometric(biometricToken);

      if (response.success) {
        setState(prev => ({
          ...prev,
          biometricEnabled: true,
          sessionInfo: prev.sessionInfo ? {
            ...prev.sessionInfo,
            biometricVerified: true,
            lastActivity: new Date()
          } : null
        }));

        return true;
      }

      return false;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Biometric verification failed'
      }));
      return false;
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  // Session refresh handler
  const refreshSession = async (): Promise<void> => {
    try {
      const response = await authService.refreshToken();

      if (response.success) {
        setState(prev => ({
          ...prev,
          sessionInfo: prev.sessionInfo ? {
            ...prev.sessionInfo,
            lastActivity: new Date()
          } : null
        }));
      } else {
        await logout();
      }
    } catch (error) {
      console.error('Session refresh error:', error);
      await logout();
    }
  };

  // Logout handler
  const logout = async (): Promise<void> => {
    try {
      await authService.logout();
    } finally {
      setState({
        isAuthenticated: false,
        user: null,
        loading: false,
        error: null,
        mfaRequired: false,
        biometricEnabled: false,
        userRole: null,
        sessionInfo: null,
        securityContext: initialSecurityContext
      });
    }
  };

  // Security context update handler
  const updateSecurityContext = useCallback((updates: Partial<ISecurityContext>) => {
    setState(prev => ({
      ...prev,
      securityContext: {
        ...prev.securityContext,
        ...updates
      }
    }));
  }, []);

  // Session activity monitoring
  useEffect(() => {
    const activityHandler = () => {
      if (state.isAuthenticated && state.sessionInfo) {
        setState(prev => ({
          ...prev,
          sessionInfo: prev.sessionInfo ? {
            ...prev.sessionInfo,
            lastActivity: new Date()
          } : null
        }));
      }
    };

    window.addEventListener('mousemove', activityHandler);
    window.addEventListener('keydown', activityHandler);

    return () => {
      window.removeEventListener('mousemove', activityHandler);
      window.removeEventListener('keydown', activityHandler);
    };
  }, [state.isAuthenticated, state.sessionInfo]);

  const contextValue: IAuthContext = {
    ...state,
    login,
    logout,
    verifyMfa,
    verifyBiometric,
    refreshSession,
    updateSecurityContext
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for accessing auth context
export const useAuth = (): IAuthContext => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;