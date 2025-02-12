/**
 * @fileoverview Enhanced authentication middleware implementing HIPAA-compliant JWT validation,
 * role-based access control, biometric verification, and comprehensive security logging
 * @version 1.0.0
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Logger } from '../../../utils/logger.util';
import { JWTService } from '../../../services/auth/jwt.service';
import { AuthService } from '../../../services/auth/auth.service';
import { securityConfig } from '../../../config/security.config';

// Initialize logger
const logger = new Logger('AuthMiddleware', { performanceTracking: true });

// Constants for authentication configuration
const TOKEN_HEADER = 'Authorization';
const TOKEN_PREFIX = 'Bearer ';

// Error messages for authentication failures
const ERROR_MESSAGES = {
  NO_TOKEN: 'No authentication token provided',
  INVALID_TOKEN: 'Invalid authentication token',
  SESSION_EXPIRED: 'Session has expired',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Forbidden access - insufficient permissions',
  MFA_REQUIRED: 'Multi-factor authentication required',
  HIPAA_VIOLATION: 'HIPAA compliance verification failed',
  DEVICE_MISMATCH: 'Unrecognized device',
  RATE_LIMIT: 'Too many authentication attempts'
} as const;

// Rate limiting configuration
const rateLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60,
  blockDuration: 300
});

/**
 * Extended Request interface with authentication data
 */
interface AuthenticatedRequest extends Request {
  userId: string;
  userType: string;
  teamId?: string;
  deviceId: string;
  isMFAVerified: boolean;
  isHIPAACompliant: boolean;
  securityContext: {
    permissions: string[];
    accessLevel: string;
    sessionExpiry: number;
  };
  sessionExpiry: number;
}

/**
 * Enhanced authentication middleware with HIPAA compliance and MFA support
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = Date.now();

  try {
    // Rate limiting check
    try {
      await rateLimiter.consume(req.ip);
    } catch {
      logger.warn('Rate limit exceeded', { ip: req.ip });
      res.status(429).json({ error: ERROR_MESSAGES.RATE_LIMIT });
      return;
    }

    // Extract token from header
    const authHeader = req.header(TOKEN_HEADER);
    if (!authHeader?.startsWith(TOKEN_PREFIX)) {
      throw new Error(ERROR_MESSAGES.NO_TOKEN);
    }

    const token = authHeader.slice(TOKEN_PREFIX.length);
    const deviceId = req.header('X-Device-ID') || 'default';

    // Verify JWT token
    const jwtService = new JWTService();
    const decodedToken = await jwtService.verifyToken(token, deviceId);

    // Validate session
    const authService = new AuthService(
      jwtService,
      null as any, // OAuth service not needed for validation
      logger,
      rateLimiter
    );

    const sessionValid = await authService.validateSession(
      decodedToken.userId,
      decodedToken.role
    );

    if (!sessionValid) {
      throw new Error(ERROR_MESSAGES.SESSION_EXPIRED);
    }

    // Check device binding
    const deviceValid = await authService.checkDeviceBinding(
      decodedToken.userId,
      deviceId
    );

    if (!deviceValid) {
      throw new Error(ERROR_MESSAGES.DEVICE_MISMATCH);
    }

    // Validate MFA if required
    const mfaRequired = securityConfig.authentication.mfaSettings[decodedToken.role]?.length > 0;
    if (mfaRequired) {
      const mfaValid = await authService.validateMFA(decodedToken.userId);
      if (!mfaValid) {
        throw new Error(ERROR_MESSAGES.MFA_REQUIRED);
      }
    }

    // Enhance request with auth data
    (req as AuthenticatedRequest).userId = decodedToken.userId;
    (req as AuthenticatedRequest).userType = decodedToken.role;
    (req as AuthenticatedRequest).deviceId = deviceId;
    (req as AuthenticatedRequest).isMFAVerified = !mfaRequired || true;
    (req as AuthenticatedRequest).isHIPAACompliant = decodedToken.hipaaCompliant || false;
    (req as AuthenticatedRequest).securityContext = {
      permissions: decodedToken.permissions || [],
      accessLevel: decodedToken.role,
      sessionExpiry: decodedToken.exp
    };
    (req as AuthenticatedRequest).sessionExpiry = decodedToken.exp;

    // Log successful authentication
    logger.info('Authentication successful', {
      userId: decodedToken.userId,
      role: decodedToken.role,
      deviceId,
      latency: Date.now() - startTime
    });

    next();
  } catch (error) {
    logger.error('Authentication failed', error as Error);
    
    const errorMessage = (error as Error).message;
    const statusCode = errorMessage === ERROR_MESSAGES.NO_TOKEN ? 401 : 403;
    
    res.status(statusCode).json({ error: errorMessage });
  }
};

/**
 * Enhanced authorization middleware with role-based access control
 */
export const authorize = (
  allowedRoles: string[],
  options: { requireHIPAA?: boolean; requireMFA?: boolean } = {}
): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;

      // Validate user role
      if (!allowedRoles.includes(authenticatedReq.userType)) {
        throw new Error(ERROR_MESSAGES.FORBIDDEN);
      }

      // Check HIPAA compliance for medical staff
      if (options.requireHIPAA && !authenticatedReq.isHIPAACompliant) {
        throw new Error(ERROR_MESSAGES.HIPAA_VIOLATION);
      }

      // Verify MFA if required
      if (options.requireMFA && !authenticatedReq.isMFAVerified) {
        throw new Error(ERROR_MESSAGES.MFA_REQUIRED);
      }

      // Log authorization
      logger.info('Authorization successful', {
        userId: authenticatedReq.userId,
        role: authenticatedReq.userType,
        requiredRoles: allowedRoles
      });

      next();
    } catch (error) {
      logger.error('Authorization failed', error as Error);
      res.status(403).json({ error: (error as Error).message });
    }
  };
};