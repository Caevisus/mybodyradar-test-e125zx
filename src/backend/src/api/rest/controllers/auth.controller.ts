/**
 * @fileoverview Authentication controller implementing comprehensive security features
 * including multi-factor authentication, role-based access control, and HIPAA compliance.
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimiterFlexible } from 'rate-limiter-flexible';
import * as passport from 'passport';
import * as winston from 'winston';
import { AuthService } from '../../../services/auth/auth.service';
import { validateRequest } from '../middlewares/validation.middleware';
import { HttpError, ErrorCodes } from '../middlewares/error.middleware';
import { SecurityConfig } from '../../../config/security.config';
import { Logger } from '../../../utils/logger.util';

/**
 * Enhanced authentication controller with HIPAA compliance and security features
 */
export class AuthController {
  private authService: AuthService;
  private rateLimiter: RateLimiterFlexible;
  private logger: Logger;
  private securityConfig: SecurityConfig;

  constructor(authService: AuthService, securityConfig: SecurityConfig) {
    this.authService = authService;
    this.securityConfig = securityConfig;
    this.logger = new Logger('AuthController');
    this.initializeRateLimiter();
  }

  /**
   * Handles user login with role-based authentication and MFA
   */
  @validateRequest
  public async login(req: Request, res: Response, next: NextFunction): Promise<Response> {
    try {
      // Check rate limiting
      await this.rateLimiter.consume(req.ip);

      const { email, password, mfaCode, biometricToken, deviceId } = req.body;

      const authResponse = await this.authService.login({
        email,
        password,
        mfaCode,
        biometricToken,
        deviceId
      });

      // Set secure session cookie with role-based expiry
      if (authResponse.accessToken) {
        res.cookie('session', authResponse.accessToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: authResponse.sessionDuration,
          path: '/'
        });
      }

      this.logger.info('Login successful', {
        userId: authResponse.user.id,
        role: authResponse.user.role
      });

      return res.status(200).json(authResponse);

    } catch (error) {
      this.logger.error('Login failed', error as Error);
      next(new HttpError(
        401,
        'Authentication failed',
        ErrorCodes.AUTHENTICATION_ERROR,
        error
      ));
    }
  }

  /**
   * Handles SAML SSO authentication flow
   */
  @validateRequest
  public async samlLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      passport.authenticate('saml', {
        successRedirect: '/dashboard',
        failureRedirect: '/login',
        failureFlash: true
      })(req, res, next);
    } catch (error) {
      this.logger.error('SAML authentication failed', error as Error);
      next(new HttpError(
        401,
        'SAML authentication failed',
        ErrorCodes.AUTHENTICATION_ERROR,
        error
      ));
    }
  }

  /**
   * Handles SAML SSO callback
   */
  public async samlCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { SAMLResponse } = req.body;
      
      const authResponse = await this.authService.authenticateWithSAML(SAMLResponse);

      res.cookie('session', authResponse.accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: authResponse.sessionDuration,
        path: '/'
      });

      res.redirect('/dashboard');
    } catch (error) {
      this.logger.error('SAML callback failed', error as Error);
      next(new HttpError(
        401,
        'SAML callback failed',
        ErrorCodes.AUTHENTICATION_ERROR,
        error
      ));
    }
  }

  /**
   * Handles OAuth authentication flow
   */
  @validateRequest
  public async oauthLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { provider } = req.params;
      
      passport.authenticate(provider, {
        scope: ['profile', 'email']
      })(req, res, next);
    } catch (error) {
      this.logger.error('OAuth authentication failed', error as Error);
      next(new HttpError(
        401,
        'OAuth authentication failed',
        ErrorCodes.AUTHENTICATION_ERROR,
        error
      ));
    }
  }

  /**
   * Validates multi-factor authentication tokens
   */
  @validateRequest
  public async validateMFA(req: Request, res: Response, next: NextFunction): Promise<Response> {
    try {
      const { userId, mfaCode, mfaType } = req.body;

      const isValid = await this.authService.validateMFA(userId, mfaCode, mfaType);

      if (!isValid) {
        throw new Error('Invalid MFA code');
      }

      this.logger.info('MFA validation successful', { userId, mfaType });

      return res.status(200).json({ success: true });

    } catch (error) {
      this.logger.error('MFA validation failed', error as Error);
      next(new HttpError(
        401,
        'MFA validation failed',
        ErrorCodes.AUTHENTICATION_ERROR,
        error
      ));
    }
  }

  /**
   * Handles user logout and session cleanup
   */
  public async logout(req: Request, res: Response, next: NextFunction): Promise<Response> {
    try {
      const sessionToken = req.cookies['session'];
      
      if (sessionToken) {
        await this.authService.logout(sessionToken);
        
        res.clearCookie('session', {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          path: '/'
        });
      }

      this.logger.info('Logout successful');

      return res.status(200).json({ success: true });

    } catch (error) {
      this.logger.error('Logout failed', error as Error);
      next(new HttpError(
        500,
        'Logout failed',
        ErrorCodes.INTERNAL_ERROR,
        error
      ));
    }
  }

  /**
   * Initializes rate limiter with progressive thresholds
   */
  private initializeRateLimiter(): void {
    this.rateLimiter = new RateLimiterFlexible({
      points: 5, // Number of attempts
      duration: 60, // Per minute
      blockDuration: 300, // 5 minutes block
      keyPrefix: 'login_attempt'
    });
  }
}

export default AuthController;