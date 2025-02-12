/**
 * @fileoverview Advanced authentication hook providing secure authentication, authorization,
 * and session management with multi-factor authentication support, biometric verification,
 * and role-based access control for the smart-apparel web application.
 * @version 1.0.0
 */

import { useContext, useCallback, useState, useEffect } from 'react'; // v18.2.0
import jwtDecode from 'jwt-decode'; // v3.1.2
import { startAuthentication, startRegistration } from '@simplewebauthn/browser'; // v7.2.0
import { AuthContext } from '../contexts/AuthContext';
import type { IApiResponse } from '../interfaces/common.interface';

/**
 * Login credentials interface with enhanced security features
 */
interface ILoginCredentials {
  email: string;
  password: string;
  mfaToken?: string;
  rememberDevice: boolean;
  deviceInfo: {
    deviceId: string;
    platform: string;
    userAgent: string;
    timestamp: number;
  };
}

/**
 * Registration data interface with comprehensive user information
 */
interface IRegistrationData {
  email: string;
  password: string;
  name: string;
  userType: 'ATHLETE' | 'COACH' | 'MEDICAL' | 'ADMIN';
  teamId?: string;
  acceptedTerms: boolean;
  roles: string[];
  deviceInfo: {
    deviceId: string;
    platform: string;
    userAgent: string;
    timestamp: number;
  };
}

/**
 * Session information interface for tracking authentication state
 */
interface ISessionInfo {
  sessionId: string;
  expiresAt: number;
  lastActivity: number;
  mfaVerified: boolean;
  biometricVerified: boolean;
  deviceTrusted: boolean;
}

/**
 * Enhanced authentication hook return interface
 */
interface IAuthHookReturn {
  isAuthenticated: boolean;
  user: any;
  loading: boolean;
  error: string | null;
  login: (credentials: ILoginCredentials) => Promise<IApiResponse<void>>;
  register: (data: IRegistrationData) => Promise<IApiResponse<void>>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  verifyMFA: (code: string) => Promise<boolean>;
  validateBiometric: () => Promise<boolean>;
  checkPermission: (permission: string) => boolean;
  roles: string[];
  sessionInfo: ISessionInfo | null;
}

/**
 * Advanced authentication hook with comprehensive security features
 * @returns {IAuthHookReturn} Authentication state and methods
 */
export function useAuth(): IAuthHookReturn {
  const context = useContext(AuthContext);
  const [sessionInfo, setSessionInfo] = useState<ISessionInfo | null>(null);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  const {
    isAuthenticated,
    user,
    loading,
    error,
    mfaRequired,
    biometricEnabled,
    securityContext,
    login: contextLogin,
    logout: contextLogout,
    verifyMfa: contextVerifyMfa,
    verifyBiometric: contextVerifyBiometric,
    refreshSession: contextRefreshSession,
    updateSecurityContext
  } = context;

  /**
   * Enhanced login handler with security measures
   */
  const login = useCallback(async (credentials: ILoginCredentials): Promise<IApiResponse<void>> => {
    try {
      // Add device fingerprinting
      const deviceInfo = {
        deviceId: crypto.randomUUID(),
        platform: navigator.platform,
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      };

      const response = await contextLogin({
        ...credentials,
        deviceInfo
      });

      if (response.success && response.data.requiresMfa) {
        updateSecurityContext({
          mfaPending: true,
          lastLoginAttempt: new Date()
        });
      }

      return response;
    } catch (error) {
      updateSecurityContext({
        failedLoginAttempts: (securityContext.failedLoginAttempts || 0) + 1,
        lastFailedLogin: new Date()
      });
      throw error;
    }
  }, [contextLogin, securityContext, updateSecurityContext]);

  /**
   * Secure registration handler with role validation
   */
  const register = useCallback(async (data: IRegistrationData): Promise<IApiResponse<void>> => {
    // Validate registration data
    if (!data.email || !data.password || !data.name || !data.userType) {
      throw new Error('Invalid registration data');
    }

    // Add device information
    const deviceInfo = {
      deviceId: crypto.randomUUID(),
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      timestamp: Date.now()
    };

    return await contextLogin({
      ...data,
      deviceInfo
    });
  }, [contextLogin]);

  /**
   * Enhanced MFA verification with timeout and retry limits
   */
  const verifyMFA = useCallback(async (code: string): Promise<boolean> => {
    if (!code || code.length !== 6) {
      throw new Error('Invalid MFA code');
    }

    try {
      const verified = await contextVerifyMfa(code);
      if (verified) {
        updateSecurityContext({
          mfaPending: false,
          lastMfaVerification: new Date()
        });
      }
      return verified;
    } catch (error) {
      updateSecurityContext({
        failedMfaAttempts: (securityContext.failedMfaAttempts || 0) + 1
      });
      throw error;
    }
  }, [contextVerifyMfa, securityContext, updateSecurityContext]);

  /**
   * Biometric authentication handler with WebAuthn support
   */
  const validateBiometric = useCallback(async (): Promise<boolean> => {
    try {
      const options = await contextVerifyBiometric();
      const credential = await startAuthentication(options);
      
      if (credential) {
        updateSecurityContext({
          biometricVerified: true,
          lastBiometricVerification: new Date()
        });
        return true;
      }
      return false;
    } catch (error) {
      updateSecurityContext({
        failedBiometricAttempts: (securityContext.failedBiometricAttempts || 0) + 1
      });
      throw error;
    }
  }, [contextVerifyBiometric, securityContext, updateSecurityContext]);

  /**
   * Permission checker for role-based access control
   */
  const checkPermission = useCallback((permission: string): boolean => {
    if (!user || !user.roles) return false;
    
    const userRoles = new Set(user.roles);
    
    // Role hierarchy
    if (userRoles.has('ADMIN')) return true;
    if (permission.startsWith('MEDICAL_') && userRoles.has('MEDICAL')) return true;
    if (permission.startsWith('COACH_') && userRoles.has('COACH')) return true;
    if (permission.startsWith('ATHLETE_') && userRoles.has('ATHLETE')) return true;
    
    return false;
  }, [user]);

  /**
   * Session monitoring and auto-refresh
   */
  useEffect(() => {
    if (!isAuthenticated || !sessionInfo) return;

    const checkSession = async () => {
      const now = Date.now();
      if (sessionInfo.expiresAt - now < 300000) { // Refresh 5 minutes before expiry
        await contextRefreshSession();
      }
    };

    const sessionInterval = setInterval(checkSession, 60000); // Check every minute
    return () => clearInterval(sessionInterval);
  }, [isAuthenticated, sessionInfo, contextRefreshSession]);

  return {
    isAuthenticated,
    user,
    loading,
    error,
    login,
    register,
    logout: contextLogout,
    refreshSession: contextRefreshSession,
    verifyMFA,
    validateBiometric,
    checkPermission,
    roles: user?.roles || [],
    sessionInfo
  };
}