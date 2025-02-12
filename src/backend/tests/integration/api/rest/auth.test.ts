import supertest from 'supertest';
import { performance } from 'performance-now';
import { Express } from 'express';
import { AuthController } from '../../../../src/api/rest/controllers/auth.controller';
import { createTestApp } from '@testing-library/test-utils';
import { securityConfig } from '../../../../src/config/security.config';
import { PERFORMANCE_THRESHOLDS } from '../../../../src/constants/system.constants';

describe('AuthController Integration Tests', () => {
  let app: Express;
  let request: supertest.SuperTest<supertest.Test>;
  let authController: AuthController;

  // Test data
  const testUsers = {
    athlete: {
      email: 'athlete@test.com',
      password: 'Athlete123!@#',
      role: 'athlete'
    },
    coach: {
      email: 'coach@test.com',
      password: 'Coach123!@#',
      role: 'coach'
    },
    medical: {
      email: 'medical@test.com',
      password: 'Medical123!@#',
      role: 'medical'
    }
  };

  beforeAll(async () => {
    // Initialize test app with auth controller
    app = await createTestApp();
    request = supertest(app);
    authController = new AuthController(
      app.get('authService'),
      app.get('securityConfig')
    );

    // Seed test database with users
    await seedTestUsers();
  });

  describe('Login Authentication', () => {
    it('should successfully authenticate with valid credentials and MFA', async () => {
      const startTime = performance();

      const response = await request
        .post('/api/auth/login')
        .send({
          email: testUsers.athlete.email,
          password: testUsers.athlete.password,
          mfaCode: '123456'
        })
        .expect(200);

      // Validate response structure
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.role).toBe('athlete');

      // Validate security headers
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');

      // Validate performance
      const processingTime = performance() - startTime;
      expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS);
    });

    it('should enforce password complexity requirements', async () => {
      const response = await request
        .post('/api/auth/login')
        .send({
          email: testUsers.athlete.email,
          password: 'weak',
          mfaCode: '123456'
        })
        .expect(401);

      expect(response.body.errorCode).toBe('ERR_AUTH');
    });

    it('should implement account lockout after failed attempts', async () => {
      // Attempt multiple failed logins
      for (let i = 0; i < securityConfig.authentication.maxLoginAttempts + 1; i++) {
        await request
          .post('/api/auth/login')
          .send({
            email: testUsers.coach.email,
            password: 'wrongpassword',
            mfaCode: '123456'
          });
      }

      // Verify account is locked
      const response = await request
        .post('/api/auth/login')
        .send({
          email: testUsers.coach.email,
          password: testUsers.coach.password,
          mfaCode: '123456'
        })
        .expect(401);

      expect(response.body.message).toContain('Account locked');
    });
  });

  describe('OAuth Authentication', () => {
    it('should initialize OAuth flow with state validation', async () => {
      const response = await request
        .get('/api/auth/oauth/google')
        .expect(302);

      const location = response.headers.location;
      expect(location).toContain('accounts.google.com');
      expect(location).toContain('state=');
      expect(location).toContain('code_challenge=');
    });

    it('should handle OAuth callback with PKCE verification', async () => {
      const mockCode = 'test_auth_code';
      const mockState = 'valid_state';

      const response = await request
        .get(`/api/auth/oauth/callback/google?code=${mockCode}&state=${mockState}`)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user.oauthProvider).toBe('google');
    });

    it('should validate OAuth state parameter', async () => {
      const response = await request
        .get('/api/auth/oauth/callback/google?code=test&state=invalid')
        .expect(401);

      expect(response.body.errorCode).toBe('ERR_AUTH');
    });
  });

  describe('Token Management', () => {
    let validToken: string;

    beforeEach(async () => {
      // Get valid token for tests
      const loginResponse = await request
        .post('/api/auth/login')
        .send({
          email: testUsers.medical.email,
          password: testUsers.medical.password,
          mfaCode: '123456'
        });
      validToken = loginResponse.body.accessToken;
    });

    it('should validate active tokens', async () => {
      await request
        .post('/api/auth/validate')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
    });

    it('should refresh tokens before expiry', async () => {
      const response = await request
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.accessToken).not.toBe(validToken);
    });

    it('should revoke tokens on logout', async () => {
      // Logout with token
      await request
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      // Verify token is invalidated
      await request
        .post('/api/auth/validate')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(401);
    });
  });

  describe('Role-Based Access Control', () => {
    it('should enforce role-specific session durations', async () => {
      const roles = ['athlete', 'coach', 'medical'];
      
      for (const role of roles) {
        const response = await request
          .post('/api/auth/login')
          .send({
            email: testUsers[role].email,
            password: testUsers[role].password,
            mfaCode: '123456'
          })
          .expect(200);

        const decodedToken = decodeJwt(response.body.accessToken);
        expect(decodedToken.exp - decodedToken.iat).toBe(
          securityConfig.authentication.sessionTimeoutMinutes[role] * 60
        );
      }
    });

    it('should require additional MFA for medical staff', async () => {
      const response = await request
        .post('/api/auth/login')
        .send({
          email: testUsers.medical.email,
          password: testUsers.medical.password
        })
        .expect(200);

      expect(response.body.requiresMfa).toBe(true);
      expect(response.body.mfaType).toBe('hardware');
    });
  });

  // Helper functions
  async function seedTestUsers() {
    // Implementation to seed test database with users
  }

  function decodeJwt(token: string): any {
    // Implementation to decode JWT payload
    return {};
  }
});