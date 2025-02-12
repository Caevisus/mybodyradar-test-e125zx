/**
 * @fileoverview Enhanced Authentication Service for Smart Apparel System
 * @version 1.0.0
 * 
 * Implements comprehensive authentication and authorization features including
 * multi-factor authentication, biometric verification, and role-based access control
 * with advanced security measures and session management.
 */

import axios, { AxiosInstance } from 'axios'; // v1.4.0
import jwtDecode from 'jwt-decode'; // v3.1.2
import CryptoJS from 'crypto-js'; // v4.1.1
import SecureWebStorage from 'secure-web-storage'; // v1.0.2
import { apiConfig } from '../../config/api.config';
import { IApiResponse } from '../../interfaces/common.interface';

// Authentication interfaces
interface IAuthCredentials {
  email: string;
  password: string;
  totpCode?: string;
  biometricToken?: string;
  deviceId?: string;
}

interface IAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: IAthlete;
  roles: string[];
  requiresMfa: boolean;
  sessionId: string;
}

interface IAuthState {
  isAuthenticated: boolean;
  user: IAthlete | null;
  accessToken: string | null;
  roles: string[];
  mfaVerified: boolean;
  sessionId: string;
}

interface SecureStorageConfig {
  encryptionKey: string;
  storageType: 'local' | 'session';
}

interface AuthServiceConfig {
  maxRetries: number;
  requestTimeout: number;
  tokenRefreshThreshold: number;
}

/**
 * Enhanced Authentication Service with advanced security features
 */
export class AuthService {
  private readonly axiosInstance: AxiosInstance;
  private readonly tokenStorage: SecureWebStorage;
  private readonly maxRetries: number;
  private readonly requestTimeout: number;
  private activeSessionIds: Set<string>;
  private refreshTokenTimeout?: NodeJS.Timeout;

  constructor(
    storageConfig: SecureStorageConfig,
    serviceConfig: AuthServiceConfig
  ) {
    // Initialize secure token storage
    this.tokenStorage = new SecureWebStorage(
      storageConfig.storageType === 'local' ? localStorage : sessionStorage,
      {
        hash: (key: string) => CryptoJS.SHA256(key).toString(),
        encrypt: (data: string) => CryptoJS.AES.encrypt(data, storageConfig.encryptionKey).toString(),
        decrypt: (data: string) => CryptoJS.AES.decrypt(data, storageConfig.encryptionKey).toString(CryptoJS.enc.Utf8)
      }
    );

    // Initialize service configuration
    this.maxRetries = serviceConfig.maxRetries;
    this.requestTimeout = serviceConfig.requestTimeout;
    this.activeSessionIds = new Set<string>();

    // Initialize axios instance with interceptors
    this.axiosInstance = axios.create({
      baseURL: apiConfig.baseURL,
      timeout: this.requestTimeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  /**
   * Authenticates user with enhanced security measures
   * @param credentials User login credentials
   * @returns Authentication response with security context
   */
  public async login(credentials: IAuthCredentials): Promise<IApiResponse<IAuthResponse>> {
    try {
      // Validate credentials format
      this.validateCredentials(credentials);

      // Encrypt sensitive data
      const encryptedCredentials = this.encryptCredentials(credentials);

      // Make authentication request
      const response = await this.axiosInstance.post<IApiResponse<IAuthResponse>>(
        apiConfig.endpoints.AUTH.LOGIN,
        encryptedCredentials
      );

      if (response.data.success) {
        const authResponse = response.data.data;

        // Handle MFA if required
        if (authResponse.requiresMfa && !credentials.totpCode) {
          return response.data;
        }

        // Store tokens securely
        await this.storeTokens(authResponse);

        // Initialize session monitoring
        this.initializeSessionMonitoring(authResponse.sessionId);

        // Setup token refresh
        this.setupTokenRefresh(authResponse.accessToken);
      }

      return response.data;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Handles multi-factor authentication verification
   * @param totpCode TOTP verification code
   * @param sessionId Active session identifier
   * @returns MFA verification result
   */
  public async verifyMfa(totpCode: string, sessionId: string): Promise<IApiResponse<boolean>> {
    try {
      // Validate TOTP code format
      if (!this.validateTotpCode(totpCode)) {
        throw new Error('Invalid TOTP code format');
      }

      const response = await this.axiosInstance.post<IApiResponse<boolean>>(
        apiConfig.endpoints.AUTH.MFA,
        {
          totpCode,
          sessionId
        }
      );

      if (response.data.success) {
        // Update session state
        this.updateSessionState(sessionId, { mfaVerified: true });
      }

      return response.data;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Processes biometric authentication
   * @param biometricToken Biometric verification token
   * @returns Biometric verification result
   */
  public async handleBiometric(biometricToken: string): Promise<IApiResponse<boolean>> {
    try {
      const response = await this.axiosInstance.post<IApiResponse<boolean>>(
        `${apiConfig.endpoints.AUTH.VERIFY}/biometric`,
        { biometricToken }
      );

      if (response.data.success) {
        // Update security context with biometric verification
        this.updateSecurityContext({ biometricVerified: true });
      }

      return response.data;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Logs out user and cleans up security context
   */
  public async logout(): Promise<void> {
    try {
      const sessionId = this.tokenStorage.getItem('sessionId');
      if (sessionId) {
        await this.axiosInstance.post(apiConfig.endpoints.AUTH.LOGOUT, { sessionId });
        this.cleanupSession(sessionId);
      }
    } finally {
      this.clearSecurityContext();
    }
  }

  // Private helper methods
  private setupInterceptors(): void {
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = this.tokenStorage.getItem('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && !error.config._retry) {
          return this.handleTokenRefresh(error);
        }
        return Promise.reject(error);
      }
    );
  }

  private async handleTokenRefresh(error: any): Promise<any> {
    try {
      const refreshToken = this.tokenStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await this.axiosInstance.post<IApiResponse<IAuthResponse>>(
        apiConfig.endpoints.AUTH.REFRESH,
        { refreshToken }
      );

      if (response.data.success) {
        await this.storeTokens(response.data.data);
        error.config._retry = true;
        return this.axiosInstance(error.config);
      }
    } catch (refreshError) {
      this.clearSecurityContext();
      throw refreshError;
    }
  }

  private validateCredentials(credentials: IAuthCredentials): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(credentials.email)) {
      throw new Error('Invalid email format');
    }
    if (credentials.password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
  }

  private encryptCredentials(credentials: IAuthCredentials): any {
    return {
      email: credentials.email,
      password: CryptoJS.AES.encrypt(
        credentials.password,
        this.tokenStorage.getItem('encryptionKey') || ''
      ).toString(),
      totpCode: credentials.totpCode,
      biometricToken: credentials.biometricToken,
      deviceId: credentials.deviceId
    };
  }

  private async storeTokens(authResponse: IAuthResponse): Promise<void> {
    this.tokenStorage.setItem('accessToken', authResponse.accessToken);
    this.tokenStorage.setItem('refreshToken', authResponse.refreshToken);
    this.tokenStorage.setItem('sessionId', authResponse.sessionId);
    this.tokenStorage.setItem('roles', JSON.stringify(authResponse.roles));
  }

  private setupTokenRefresh(accessToken: string): void {
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }

    const decodedToken: any = jwtDecode(accessToken);
    const expiresIn = (decodedToken.exp * 1000) - Date.now() - 60000; // Refresh 1 minute before expiry

    this.refreshTokenTimeout = setTimeout(
      () => this.handleTokenRefresh({}),
      expiresIn
    );
  }

  private clearSecurityContext(): void {
    this.tokenStorage.clear();
    this.activeSessionIds.clear();
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }
  }

  private validateTotpCode(totpCode: string): boolean {
    return /^\d{6}$/.test(totpCode);
  }

  private updateSessionState(sessionId: string, updates: Partial<IAuthState>): void {
    const currentState = JSON.parse(this.tokenStorage.getItem('authState') || '{}');
    this.tokenStorage.setItem('authState', JSON.stringify({
      ...currentState,
      ...updates
    }));
  }

  private updateSecurityContext(updates: Record<string, any>): void {
    const context = JSON.parse(this.tokenStorage.getItem('securityContext') || '{}');
    this.tokenStorage.setItem('securityContext', JSON.stringify({
      ...context,
      ...updates,
      lastUpdated: new Date().toISOString()
    }));
  }

  private handleAuthError(error: any): Error {
    const errorMessage = error.response?.data?.error?.message || error.message;
    return new Error(`Authentication error: ${errorMessage}`);
  }

  private initializeSessionMonitoring(sessionId: string): void {
    this.activeSessionIds.add(sessionId);
    window.addEventListener('beforeunload', () => {
      this.cleanupSession(sessionId);
    });
  }

  private async cleanupSession(sessionId: string): Promise<void> {
    if (this.activeSessionIds.has(sessionId)) {
      await this.axiosInstance.post(`${apiConfig.endpoints.AUTH.LOGOUT}/session`, { sessionId });
      this.activeSessionIds.delete(sessionId);
    }
  }
}