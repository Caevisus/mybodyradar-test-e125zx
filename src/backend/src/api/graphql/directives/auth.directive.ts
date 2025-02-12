/**
 * @fileoverview Enhanced GraphQL schema directive for authentication and authorization
 * Implements comprehensive role-based access control with HIPAA compliance and MFA support
 * @version 1.0.0
 */

import { SchemaDirectiveVisitor } from '@graphql-tools/utils'; // v9.0.0
import { AuthenticationError } from 'apollo-server-express'; // v3.12.0
import { AuthService } from '../../../services/auth/auth.service';
import { JWTService } from '../../../services/auth/jwt.service';
import { securityConfig } from '../../../config/security.config';
import { Logger } from '../../../utils/logger.util';

/**
 * Constants for authentication and authorization
 */
const ERROR_MESSAGES = {
  MISSING_TOKEN: 'Authentication token is required',
  INVALID_TOKEN: 'Invalid or expired authentication token',
  UNAUTHORIZED: 'Unauthorized access to resource',
  INVALID_SESSION: 'Invalid or expired session',
  MFA_REQUIRED: 'Multi-factor authentication required',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded for this operation',
  TOKEN_ROTATION_REQUIRED: 'Token rotation required',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions for this operation'
} as const;

/**
 * Role-specific session durations in milliseconds
 */
const SESSION_DURATIONS = {
  ATHLETE: 86400000,  // 24 hours
  COACH: 43200000,    // 12 hours
  MEDICAL: 28800000,  // 8 hours
  ADMIN: 14400000     // 4 hours
} as const;

/**
 * Audit event types for security logging
 */
const AUDIT_EVENTS = {
  AUTH_ATTEMPT: 'authentication_attempt',
  AUTH_SUCCESS: 'authentication_success',
  AUTH_FAILURE: 'authentication_failure',
  MFA_REQUIRED: 'mfa_verification_required',
  MFA_SUCCESS: 'mfa_verification_success',
  MFA_FAILURE: 'mfa_verification_failure'
} as const;

/**
 * Enhanced GraphQL directive for authentication and authorization
 */
export class AuthDirective extends SchemaDirectiveVisitor {
  private authService: AuthService;
  private jwtService: JWTService;
  private logger: Logger;

  constructor(authService: AuthService, jwtService: JWTService) {
    super();
    this.authService = authService;
    this.jwtService = jwtService;
    this.logger = new Logger('AuthDirective', { performanceTracking: true });
  }

  /**
   * Visits field definition to wrap resolver with authentication checks
   */
  visitFieldDefinition(field: any): void {
    const { resolve = defaultFieldResolver } = field;
    const directiveArgs = this.args;

    field.resolve = async (parent: any, args: any, context: any, info: any) => {
      try {
        // Log authentication attempt
        this.logger.info(AUDIT_EVENTS.AUTH_ATTEMPT, {
          operation: info.fieldName,
          ip: context.ip
        });

        // Extract and validate authorization header
        const token = this.extractToken(context);
        if (!token) {
          throw new AuthenticationError(ERROR_MESSAGES.MISSING_TOKEN);
        }

        // Verify token and check rotation status
        const payload = await this.jwtService.verifyToken(token, context.deviceId);
        await this.jwtService.checkTokenRotation(token);

        // Validate session based on role-specific duration
        const sessionValid = await this.authService.validateSession(
          payload.userId,
          SESSION_DURATIONS[payload.role.toUpperCase()]
        );
        if (!sessionValid) {
          throw new AuthenticationError(ERROR_MESSAGES.INVALID_SESSION);
        }

        // Check MFA requirement for role
        const mfaRequired = securityConfig.authentication.mfaSettings[payload.role].length > 0;
        if (mfaRequired && !context.mfaVerified) {
          const mfaVerified = await this.authService.validateMFA(
            payload.userId,
            context.mfaToken,
            payload.role
          );
          if (!mfaVerified) {
            this.logger.warn(AUDIT_EVENTS.MFA_REQUIRED, {
              userId: payload.userId,
              role: payload.role
            });
            throw new AuthenticationError(ERROR_MESSAGES.MFA_REQUIRED);
          }
        }

        // Check permissions for operation
        if (directiveArgs.requires) {
          const hasPermission = payload.permissions.includes(directiveArgs.requires);
          if (!hasPermission) {
            throw new AuthenticationError(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS);
          }
        }

        // Add user context for resolver
        context.user = {
          id: payload.userId,
          role: payload.role,
          permissions: payload.permissions
        };

        // Log successful authentication
        this.logger.info(AUDIT_EVENTS.AUTH_SUCCESS, {
          userId: payload.userId,
          role: payload.role,
          operation: info.fieldName
        });

        // Execute resolver with enhanced security context
        const result = await resolve.call(this, parent, args, context, info);

        // Log security event for medical data access
        if (payload.role === 'medical') {
          await this.authService.logSecurityEvent('medical_data_access', {
            userId: payload.userId,
            operation: info.fieldName,
            dataAccessed: info.fieldName
          });
        }

        return result;

      } catch (error) {
        // Log authentication failure
        this.logger.error(AUDIT_EVENTS.AUTH_FAILURE, error as Error, {
          operation: info.fieldName,
          errorType: error.constructor.name
        });

        throw error;
      }
    };
  }

  /**
   * Extracts JWT token from authorization header
   */
  private extractToken(context: any): string | null {
    const authHeader = context.req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.split(' ')[1];
  }
}

export default AuthDirective;