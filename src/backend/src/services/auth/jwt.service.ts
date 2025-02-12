/**
 * @fileoverview Enhanced JWT service implementing role-based token management,
 * HIPAA compliance, and advanced security features for authentication and authorization
 * @version 1.0.0
 */

import * as jwt from 'jsonwebtoken'; // v9.0.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { securityConfig } from '../../config/security.config';
import { Logger } from '../../utils/logger.util';
import { encrypt } from '../../utils/encryption.util';

// Initialize logger
const logger = new Logger('JWTService', { performanceTracking: true });

/**
 * Enhanced JWT token payload with role-specific and HIPAA compliance features
 */
interface TokenPayload {
  userId: string;
  role: string;
  permissions: string[];
  exp: number;
  jti: string;
  roleSpecificExpiry: number;
  hipaaCompliant: boolean;
  lastRotated: number;
  deviceId: string;
  issuer: string;
}

/**
 * Enhanced refresh token with additional security features
 */
interface RefreshToken {
  token: string;
  userId: string;
  expiresAt: Date;
  deviceId: string;
  isRevoked: boolean;
  lastUsed: Date;
  rotationCount: number;
}

/**
 * JWT Service class implementing secure token management
 */
export class JWTService {
  private static readonly TOKEN_BLACKLIST = new Set<string>();
  private static readonly ISSUER = 'smart-apparel-auth';
  private static readonly SIGNING_ALGORITHM = 'RS256';

  /**
   * Generates a secure JWT access token with role-specific configuration
   * @param payload Token payload data
   * @param deviceId Device identifier for binding
   * @returns Promise<string> Generated JWT token
   */
  public async generateAccessToken(
    payload: Omit<TokenPayload, 'exp' | 'jti' | 'lastRotated' | 'issuer'>,
    deviceId: string
  ): Promise<string> {
    try {
      // Calculate role-specific expiration
      const expiryHours = securityConfig.authentication.sessionTimeoutMinutes[payload.role] / 60;
      const exp = Math.floor(Date.now() / 1000) + expiryHours * 3600;

      // Generate unique token ID
      const jti = uuidv4();

      // Add HIPAA compliance for medical staff
      const hipaaCompliant = payload.role === 'medical';

      // Encrypt sensitive claims for medical data
      const encryptedPayload = hipaaCompliant ? 
        await this.encryptSensitiveClaims(payload) : payload;

      const tokenPayload: TokenPayload = {
        ...encryptedPayload,
        exp,
        jti,
        roleSpecificExpiry: expiryHours * 3600,
        hipaaCompliant,
        lastRotated: Date.now(),
        deviceId,
        issuer: JWTService.ISSUER
      };

      // Sign token with role-specific private key
      const token = jwt.sign(tokenPayload, this.getSigningKey(payload.role), {
        algorithm: JWTService.SIGNING_ALGORITHM,
        issuer: JWTService.ISSUER
      });

      logger.info('Access token generated', {
        userId: payload.userId,
        role: payload.role,
        jti,
        deviceId
      });

      return token;
    } catch (error) {
      logger.error('Token generation failed', error as Error);
      throw error;
    }
  }

  /**
   * Verifies JWT token with enhanced security checks
   * @param token JWT token to verify
   * @param deviceId Device identifier for binding validation
   * @returns Promise<TokenPayload> Validated token payload
   */
  public async verifyToken(token: string, deviceId: string): Promise<TokenPayload> {
    try {
      // Verify token hasn't been blacklisted
      if (JWTService.TOKEN_BLACKLIST.has(token)) {
        throw new Error('Token has been revoked');
      }

      // Decode token without verification to get role
      const decoded = jwt.decode(token) as TokenPayload;
      if (!decoded) {
        throw new Error('Invalid token format');
      }

      // Verify token with role-specific public key
      const verified = jwt.verify(token, this.getVerificationKey(decoded.role), {
        algorithms: [JWTService.SIGNING_ALGORITHM],
        issuer: JWTService.ISSUER
      }) as TokenPayload;

      // Validate device binding
      if (verified.deviceId !== deviceId) {
        throw new Error('Token not bound to this device');
      }

      // Validate HIPAA compliance for medical staff
      if (verified.role === 'medical' && !verified.hipaaCompliant) {
        throw new Error('Non-compliant medical staff token');
      }

      logger.info('Token verified successfully', {
        userId: verified.userId,
        role: verified.role,
        jti: verified.jti
      });

      return verified;
    } catch (error) {
      logger.error('Token verification failed', error as Error);
      throw error;
    }
  }

  /**
   * Revokes token with cascade and compliance logging
   * @param tokenId Token identifier to revoke
   * @param userId Associated user ID
   * @param role User role
   */
  public async revokeToken(tokenId: string, userId: string, role: string): Promise<void> {
    try {
      // Add to blacklist
      JWTService.TOKEN_BLACKLIST.add(tokenId);

      // Log revocation with HIPAA compliance if medical
      if (role === 'medical') {
        logger.info('Medical staff token revoked', {
          userId,
          tokenId,
          hipaaEvent: true
        });
      } else {
        logger.info('Token revoked', {
          userId,
          tokenId
        });
      }

      // Clean up expired blacklist entries periodically
      this.cleanupBlacklist();
    } catch (error) {
      logger.error('Token revocation failed', error as Error);
      throw error;
    }
  }

  /**
   * Encrypts sensitive claims for HIPAA compliance
   * @param payload Token payload
   * @returns Encrypted payload
   */
  private async encryptSensitiveClaims(
    payload: Partial<TokenPayload>
  ): Promise<Partial<TokenPayload>> {
    const sensitiveData = JSON.stringify({
      permissions: payload.permissions,
      userId: payload.userId
    });

    const encrypted = await encrypt(
      sensitiveData,
      Buffer.from(this.getEncryptionKey()),
      'MEDICAL',
      Date.now().toString()
    );

    return {
      ...payload,
      permissions: undefined,
      userId: encrypted.data.toString('base64')
    };
  }

  /**
   * Cleans up expired entries from token blacklist
   */
  private cleanupBlacklist(): void {
    const now = Math.floor(Date.now() / 1000);
    JWTService.TOKEN_BLACKLIST.forEach(token => {
      try {
        const decoded = jwt.decode(token) as TokenPayload;
        if (decoded && decoded.exp < now) {
          JWTService.TOKEN_BLACKLIST.delete(token);
        }
      } catch (error) {
        // Invalid token format, safe to remove
        JWTService.TOKEN_BLACKLIST.delete(token);
      }
    });
  }

  /**
   * Gets role-specific signing key
   * @param role User role
   * @returns Signing key
   */
  private getSigningKey(role: string): string {
    // Implementation would retrieve role-specific private key from secure storage
    return process.env[`JWT_PRIVATE_KEY_${role.toUpperCase()}`] || '';
  }

  /**
   * Gets role-specific verification key
   * @param role User role
   * @returns Verification key
   */
  private getVerificationKey(role: string): string {
    // Implementation would retrieve role-specific public key from secure storage
    return process.env[`JWT_PUBLIC_KEY_${role.toUpperCase()}`] || '';
  }

  /**
   * Gets encryption key for sensitive claims
   * @returns Encryption key
   */
  private getEncryptionKey(): string {
    // Implementation would retrieve encryption key from secure storage
    return process.env.JWT_ENCRYPTION_KEY || '';
  }
}