/**
 * @fileoverview Authentication routes configuration implementing secure, HIPAA-compliant
 * authentication flows with multi-factor authentication and comprehensive audit logging.
 * @version 1.0.0
 */

import { Router } from 'express'; // ^4.18.2
import { rateLimit } from 'express-rate-limit'; // ^6.7.0
import { AuthController } from '../controllers/auth.controller';
import { validateRequest, validateAlertRequest } from '../middlewares/validation.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import { Logger } from '../../../utils/logger.util';
import { securityConfig } from '../../../config/security.config';
import { SYSTEM_TIMEOUTS } from '../../../constants/system.constants';

// Initialize router and logger
const router = Router();
const logger = new Logger('AuthRoutes');

// Configure rate limiting for authentication endpoints
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: securityConfig.authentication.maxLoginAttempts,
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Configure authentication routes with security measures
 */
export const configureAuthRoutes = (authController: AuthController): Router => {
  // Login route with role-based authentication and MFA
  router.post('/login', 
    authRateLimiter,
    validateRequest,
    async (req, res, next) => {
      try {
        const response = await authController.login(req, res, next);
        logger.info('Login successful', { userId: response?.user?.id });
        return response;
      } catch (error) {
        next(error);
      }
    }
  );

  // Registration route with enhanced validation
  router.post('/register',
    authRateLimiter,
    validateRequest,
    async (req, res, next) => {
      try {
        const response = await authController.register(req, res, next);
        logger.info('Registration successful', { email: req.body.email });
        return response;
      } catch (error) {
        next(error);
      }
    }
  );

  // OAuth routes for multiple providers
  router.get('/oauth/:provider',
    validateRequest,
    async (req, res, next) => {
      try {
        await authController.oauthLogin(req, res, next);
      } catch (error) {
        next(error);
      }
    }
  );

  router.get('/oauth/callback/:provider',
    validateRequest,
    async (req, res, next) => {
      try {
        await authController.oauthLogin(req, res, next);
      } catch (error) {
        next(error);
      }
    }
  );

  // SAML SSO routes for medical staff
  router.post('/saml/login',
    validateRequest,
    async (req, res, next) => {
      try {
        await authController.samlLogin(req, res, next);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post('/saml/callback',
    validateRequest,
    async (req, res, next) => {
      try {
        await authController.samlCallback(req, res, next);
      } catch (error) {
        next(error);
      }
    }
  );

  // Token validation route
  router.get('/validate',
    authenticate,
    async (req, res, next) => {
      try {
        await authController.validateToken(req, res, next);
      } catch (error) {
        next(error);
      }
    }
  );

  // MFA validation route
  router.post('/mfa/validate',
    authenticate,
    validateRequest,
    async (req, res, next) => {
      try {
        await authController.validateMFA(req, res, next);
      } catch (error) {
        next(error);
      }
    }
  );

  // Logout route with audit logging
  router.post('/logout',
    authenticate,
    async (req, res, next) => {
      try {
        await authController.logout(req, res, next);
        logger.info('Logout successful', { userId: (req as any).userId });
      } catch (error) {
        next(error);
      }
    }
  );

  // Apply timeout to all routes
  router.use((req, res, next) => {
    res.setTimeout(SYSTEM_TIMEOUTS.API_REQUEST_MS, () => {
      const error = new Error('Request timeout');
      next(error);
    });
    next();
  });

  return router;
};

export default router;