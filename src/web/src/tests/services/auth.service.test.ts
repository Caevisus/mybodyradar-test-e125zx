import { AuthService } from '../../services/auth.service';
import { apiConfig } from '../../config/api.config';
import MockAdapter from 'axios-mock-adapter';
import { mockSecureStorage } from '@testing-library/mock-secure-storage';
import jwt from 'jsonwebtoken'; // v9.0.0
import CryptoJS from 'crypto-js'; // v4.1.1

describe('AuthService', () => {
  let authService: AuthService;
  let mockAxios: MockAdapter;
  let mockStorage: any;
  const testEncryptionKey = 'test-encryption-key-123';

  // Test data
  const mockUser = {
    email: 'athlete@test.com',
    password: 'SecurePass123!',
    deviceId: 'test-device-123'
  };

  const mockAuthResponse = {
    success: true,
    data: {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      user: {
        id: 'test-user-id',
        email: 'athlete@test.com',
        roles: ['athlete']
      },
      roles: ['athlete'],
      requiresMfa: true,
      sessionId: 'test-session-123'
    },
    timestamp: new Date(),
    latency: 50,
    requestId: 'test-request-123'
  };

  beforeEach(() => {
    // Initialize mocks
    mockStorage = mockSecureStorage();
    mockAxios = new MockAdapter(authService?.axiosInstance);

    // Initialize AuthService with test configuration
    authService = new AuthService(
      {
        encryptionKey: testEncryptionKey,
        storageType: 'session'
      },
      {
        maxRetries: 3,
        requestTimeout: 5000,
        tokenRefreshThreshold: 300000
      }
    );

    // Clear storage and reset mocks
    mockStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockAxios.reset();
  });

  describe('Login Flow', () => {
    test('should handle successful login with MFA requirement', async () => {
      // Mock login API response
      mockAxios.onPost(apiConfig.endpoints.AUTH.LOGIN).reply(200, mockAuthResponse);

      const response = await authService.login(mockUser);

      expect(response.success).toBe(true);
      expect(response.data.requiresMfa).toBe(true);
      expect(mockStorage.getItem('sessionId')).toBe('test-session-123');
      expect(mockStorage.getItem('accessToken')).toBe('mock-access-token');
    });

    test('should handle login with biometric authentication', async () => {
      const biometricToken = 'mock-biometric-token';
      mockAxios.onPost(`${apiConfig.endpoints.AUTH.VERIFY}/biometric`)
        .reply(200, { success: true, data: true });

      const response = await authService.handleBiometric(biometricToken);

      expect(response.success).toBe(true);
      const securityContext = JSON.parse(mockStorage.getItem('securityContext'));
      expect(securityContext.biometricVerified).toBe(true);
    });

    test('should handle invalid credentials', async () => {
      mockAxios.onPost(apiConfig.endpoints.AUTH.LOGIN)
        .reply(401, {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password'
          }
        });

      await expect(authService.login({
        email: 'invalid@test.com',
        password: 'wrong'
      })).rejects.toThrow('Authentication error: Invalid email or password');
    });
  });

  describe('MFA Verification', () => {
    test('should verify valid TOTP code', async () => {
      const totpCode = '123456';
      const sessionId = 'test-session-123';

      mockAxios.onPost(apiConfig.endpoints.AUTH.MFA)
        .reply(200, { success: true, data: true });

      const response = await authService.verifyMfa(totpCode, sessionId);

      expect(response.success).toBe(true);
      const authState = JSON.parse(mockStorage.getItem('authState'));
      expect(authState.mfaVerified).toBe(true);
    });

    test('should reject invalid TOTP code', async () => {
      const invalidCode = '12345'; // Invalid length
      const sessionId = 'test-session-123';

      await expect(authService.verifyMfa(invalidCode, sessionId))
        .rejects.toThrow('Invalid TOTP code format');
    });
  });

  describe('Session Management', () => {
    test('should handle session cleanup on logout', async () => {
      // Setup active session
      mockStorage.setItem('sessionId', 'test-session-123');
      mockStorage.setItem('accessToken', 'mock-access-token');

      mockAxios.onPost(apiConfig.endpoints.AUTH.LOGOUT)
        .reply(200, { success: true });

      await authService.logout();

      expect(mockStorage.getItem('sessionId')).toBeNull();
      expect(mockStorage.getItem('accessToken')).toBeNull();
    });

    test('should handle token refresh', async () => {
      const mockNewTokens = {
        success: true,
        data: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          sessionId: 'test-session-123'
        }
      };

      mockStorage.setItem('refreshToken', 'old-refresh-token');
      mockAxios.onPost(apiConfig.endpoints.AUTH.REFRESH)
        .reply(200, mockNewTokens);

      // Simulate token refresh
      await authService['handleTokenRefresh']({ config: {} });

      expect(mockStorage.getItem('accessToken')).toBe('new-access-token');
      expect(mockStorage.getItem('refreshToken')).toBe('new-refresh-token');
    });
  });

  describe('Security Compliance', () => {
    test('should enforce password complexity requirements', async () => {
      const weakPassword = {
        email: 'test@test.com',
        password: 'weak'
      };

      await expect(authService.login(weakPassword))
        .rejects.toThrow('Password must be at least 8 characters long');
    });

    test('should properly encrypt sensitive data', () => {
      mockStorage.setItem('encryptionKey', testEncryptionKey);
      const credentials = {
        email: 'test@test.com',
        password: 'SecurePass123!'
      };

      const encrypted = authService['encryptCredentials'](credentials);
      expect(encrypted.email).toBe(credentials.email);
      expect(encrypted.password).not.toBe(credentials.password);

      // Verify encryption
      const decrypted = CryptoJS.AES.decrypt(
        encrypted.password,
        testEncryptionKey
      ).toString(CryptoJS.enc.Utf8);
      expect(decrypted).toBe(credentials.password);
    });

    test('should handle concurrent session monitoring', async () => {
      const sessionId = 'test-session-123';
      mockAxios.onPost(`${apiConfig.endpoints.AUTH.LOGOUT}/session`)
        .reply(200, { success: true });

      // Initialize session monitoring
      authService['initializeSessionMonitoring'](sessionId);
      expect(authService['activeSessionIds'].has(sessionId)).toBe(true);

      // Cleanup session
      await authService['cleanupSession'](sessionId);
      expect(authService['activeSessionIds'].has(sessionId)).toBe(false);
    });
  });
});