/**
 * @fileoverview OAuth service implementation for handling third-party authentication flows
 * in the smart-apparel system with enhanced security features and compliance controls.
 * @version 1.0.0
 */

import { Strategy as OAuth2Strategy } from 'passport-oauth2'; // ^1.7.0
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'; // ^2.0.0
import axios from 'axios'; // ^1.4.0
import { createHash, randomBytes } from 'crypto';
import { Logger } from '../../utils/logger.util';
import { AthleteRepository } from '../../db/repositories/athlete.repository';
import { securityConfig } from '../../config/security.config';
import { SYSTEM_TIMEOUTS } from '../../constants/system.constants';

/**
 * Interface defining OAuth provider configuration with security settings
 */
interface IOAuthProvider {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  authorizationURL: string;
  tokenURL: string;
  userInfoURL: string;
  scope: string[];
  tokenExpiryWindow: number;
  requirePKCE: boolean;
  allowedDomains: string[];
  securitySettings: {
    validateNonce: boolean;
    validateHostedDomain: boolean;
    enforceHttps: boolean;
    validateTokenHash: boolean;
  };
}

/**
 * Interface for normalized OAuth user profile data
 */
interface IOAuthUserProfile {
  id: string;
  email: string;
  name: string;
  provider: string;
  rawProfile: any;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;
  emailVerified: boolean;
  permissions: string[];
  securityMetadata: {
    lastLogin: Date;
    loginAttempts: number;
    mfaEnabled: boolean;
    lastTokenRefresh: Date;
  };
}

/**
 * Constants for OAuth service configuration
 */
const OAUTH_TIMEOUT_MS = 300000;
const STATE_PARAM_LENGTH = 32;
const TOKEN_REFRESH_WINDOW_MS = 300000;
const SUPPORTED_PROVIDERS = ['google', 'apple'];
const MAX_TOKEN_REFRESH_ATTEMPTS = 3;
const TOKEN_ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const PKCE_CHALLENGE_METHOD = 'S256';
const MAX_AUTH_ATTEMPTS_PER_HOUR = 5;

/**
 * OAuth service implementation with enhanced security features
 */
export class OAuthService {
  private providers: Map<string, IOAuthProvider>;
  private athleteRepository: AthleteRepository;
  private logger: Logger;
  private tokenCache: Map<string, { token: string; expiry: number }>;
  private rateLimiter: Map<string, { attempts: number; resetTime: number }>;

  constructor(athleteRepository: AthleteRepository) {
    this.athleteRepository = athleteRepository;
    this.logger = new Logger('OAuthService');
    this.providers = new Map();
    this.tokenCache = new Map();
    this.rateLimiter = new Map();

    this.initializeProviders();
    this.setupTokenCleanup();
  }

  /**
   * Initializes OAuth providers with security configurations
   */
  private initializeProviders(): void {
    // Configure Google OAuth
    this.providers.set('google', {
      id: 'google',
      name: 'Google',
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorizationURL: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenURL: 'https://oauth2.googleapis.com/token',
      userInfoURL: 'https://www.googleapis.com/oauth2/v3/userinfo',
      scope: ['profile', 'email'],
      tokenExpiryWindow: 3600,
      requirePKCE: true,
      allowedDomains: [],
      securitySettings: {
        validateNonce: true,
        validateHostedDomain: true,
        enforceHttps: true,
        validateTokenHash: true
      }
    });

    // Additional providers can be configured here
  }

  /**
   * Initiates OAuth authentication flow with security measures
   */
  async authenticateWithProvider(
    providerId: string,
    options: { state?: string; nonce?: string } = {}
  ): Promise<void> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Unsupported OAuth provider: ${providerId}`);
    }

    // Rate limiting check
    if (!this.checkRateLimit(providerId)) {
      throw new Error('Authentication rate limit exceeded');
    }

    // Generate PKCE challenge
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256')
      .update(verifier)
      .digest('base64url');

    // Generate secure state parameter
    const state = options.state || randomBytes(STATE_PARAM_LENGTH).toString('hex');

    // Store PKCE and state parameters securely
    this.tokenCache.set(`pkce_${state}`, {
      token: verifier,
      expiry: Date.now() + OAUTH_TIMEOUT_MS
    });

    const authParams = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: process.env.OAUTH_REDIRECT_URI!,
      response_type: 'code',
      scope: provider.scope.join(' '),
      state,
      code_challenge: challenge,
      code_challenge_method: PKCE_CHALLENGE_METHOD,
      nonce: options.nonce || randomBytes(16).toString('hex')
    });

    this.logger.info('Initiating OAuth flow', {
      provider: providerId,
      state,
      scope: provider.scope
    });

    return authParams.toString();
  }

  /**
   * Handles OAuth provider callback with enhanced security
   */
  async handleProviderCallback(
    providerId: string,
    params: { code: string; state: string }
  ): Promise<IOAuthUserProfile> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Unsupported OAuth provider: ${providerId}`);
    }

    // Validate state parameter and retrieve PKCE verifier
    const pkceData = this.tokenCache.get(`pkce_${params.state}`);
    if (!pkceData || Date.now() > pkceData.expiry) {
      throw new Error('Invalid or expired state parameter');
    }

    try {
      // Exchange code for tokens with PKCE
      const tokenResponse = await axios.post(
        provider.tokenURL,
        {
          client_id: provider.clientId,
          client_secret: provider.clientSecret,
          code: params.code,
          grant_type: 'authorization_code',
          redirect_uri: process.env.OAUTH_REDIRECT_URI,
          code_verifier: pkceData.token
        },
        {
          timeout: SYSTEM_TIMEOUTS.API_REQUEST_MS,
          headers: { Accept: 'application/json' }
        }
      );

      // Validate token response
      if (!tokenResponse.data.access_token) {
        throw new Error('Invalid token response');
      }

      // Fetch user profile
      const userResponse = await axios.get(provider.userInfoURL, {
        headers: {
          Authorization: `Bearer ${tokenResponse.data.access_token}`
        },
        timeout: SYSTEM_TIMEOUTS.API_REQUEST_MS
      });

      // Validate email verification if required
      if (provider.securitySettings.validateHostedDomain && 
          !userResponse.data.email_verified) {
        throw new Error('Email verification required');
      }

      // Create normalized user profile
      const profile: IOAuthUserProfile = {
        id: userResponse.data.sub || userResponse.data.id,
        email: userResponse.data.email,
        name: userResponse.data.name,
        provider: providerId,
        rawProfile: userResponse.data,
        accessToken: tokenResponse.data.access_token,
        refreshToken: tokenResponse.data.refresh_token,
        tokenExpiry: Date.now() + (tokenResponse.data.expires_in * 1000),
        emailVerified: userResponse.data.email_verified,
        permissions: [],
        securityMetadata: {
          lastLogin: new Date(),
          loginAttempts: 0,
          mfaEnabled: false,
          lastTokenRefresh: new Date()
        }
      };

      // Update or create athlete record
      await this.updateAthleteRecord(profile);

      this.logger.info('OAuth authentication successful', {
        provider: providerId,
        userId: profile.id
      });

      return profile;

    } catch (error) {
      this.logger.error('OAuth callback failed', error as Error, {
        provider: providerId
      });
      throw error;
    } finally {
      // Cleanup PKCE data
      this.tokenCache.delete(`pkce_${params.state}`);
    }
  }

  /**
   * Validates OAuth token with security checks
   */
  async validateOAuthToken(
    providerId: string,
    accessToken: string
  ): Promise<boolean> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Unsupported OAuth provider: ${providerId}`);
    }

    try {
      const response = await axios.get(provider.userInfoURL, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: SYSTEM_TIMEOUTS.API_REQUEST_MS
      });

      return response.status === 200;
    } catch (error) {
      this.logger.warn('Token validation failed', {
        provider: providerId,
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * Refreshes OAuth token with security measures
   */
  async refreshOAuthToken(
    providerId: string,
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Unsupported OAuth provider: ${providerId}`);
    }

    try {
      const response = await axios.post(
        provider.tokenURL,
        {
          client_id: provider.clientId,
          client_secret: provider.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        },
        {
          timeout: SYSTEM_TIMEOUTS.API_REQUEST_MS,
          headers: { Accept: 'application/json' }
        }
      );

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || refreshToken,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      this.logger.error('Token refresh failed', error as Error, {
        provider: providerId
      });
      throw error;
    }
  }

  /**
   * Updates or creates athlete record with OAuth data
   */
  private async updateAthleteRecord(profile: IOAuthUserProfile): Promise<void> {
    const existingAthlete = await this.athleteRepository.findByEmail(profile.email);

    if (existingAthlete) {
      await this.athleteRepository.updateAuthData(existingAthlete.id, {
        lastLogin: new Date(),
        oauthProvider: profile.provider,
        oauthId: profile.id
      });
    } else {
      await this.athleteRepository.createAthlete({
        email: profile.email,
        name: profile.name,
        oauthProvider: profile.provider,
        oauthId: profile.id
      });
    }
  }

  /**
   * Checks rate limiting for authentication attempts
   */
  private checkRateLimit(key: string): boolean {
    const now = Date.now();
    const limit = this.rateLimiter.get(key);

    if (!limit || now > limit.resetTime) {
      this.rateLimiter.set(key, {
        attempts: 1,
        resetTime: now + 3600000 // 1 hour
      });
      return true;
    }

    if (limit.attempts >= MAX_AUTH_ATTEMPTS_PER_HOUR) {
      return false;
    }

    limit.attempts++;
    return true;
  }

  /**
   * Sets up periodic cleanup of expired tokens
   */
  private setupTokenCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.tokenCache.entries()) {
        if (now > value.expiry) {
          this.tokenCache.delete(key);
        }
      }
    }, TOKEN_REFRESH_WINDOW_MS);
  }
}