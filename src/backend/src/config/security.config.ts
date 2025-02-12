/**
 * @fileoverview Security configuration module for the smart-apparel system
 * Implements enterprise-grade security standards for authentication, encryption,
 * and data protection policies.
 * @version 1.0.0
 */

import { ENVIRONMENT } from '../constants/system.constants';
import * as crypto from 'crypto'; // v16.0.0+

/**
 * Interface for data classification security policies
 */
interface DataClassificationPolicy {
  algorithm: string;
  keyRotationDays: number;
  backupEncryption?: boolean;
  fieldLevelEncryption?: boolean;
  hipaaCompliant?: boolean;
  auditLogging?: boolean;
  aggregationAllowed?: boolean;
}

/**
 * Interface for security configuration
 */
interface SecurityConfig {
  encryption: {
    algorithm: string;
    keyLength: number;
    ivLength: number;
    saltLength: number;
    tagLength: number;
    keyRotationDays: number;
    dataClassification: {
      pii: DataClassificationPolicy;
      medical: DataClassificationPolicy;
      performance: DataClassificationPolicy;
    };
  };
  authentication: {
    jwtExpiryHours: number;
    refreshTokenDays: number;
    maxLoginAttempts: number;
    lockoutMinutes: number;
    mfaTimeoutSeconds: number;
    sessionTimeoutMinutes: {
      [key: string]: number;
    };
    mfaSettings: {
      [key: string]: string[];
    };
  };
  passwords: {
    minLength: number;
    requireUppercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    hashIterations: number;
    hashAlgorithm: string;
    passwordHistory: number;
    expiryDays: number;
  };
  tls: {
    version: string;
    cipherSuites: string[];
    minDHSize: number;
    secureOptions: string;
    hsts: {
      maxAge: number;
      includeSubDomains: boolean;
      preload: boolean;
    };
    csp: {
      [key: string]: string[];
    };
  };
}

/**
 * Base security configuration
 */
const baseSecurityConfig: SecurityConfig = {
  encryption: {
    algorithm: 'AES-256-GCM',
    keyLength: 256,
    ivLength: 16,
    saltLength: 32,
    tagLength: 16,
    keyRotationDays: 90,
    dataClassification: {
      pii: {
        algorithm: 'AES-256-GCM',
        keyRotationDays: 30,
        backupEncryption: true,
        fieldLevelEncryption: true
      },
      medical: {
        algorithm: 'AES-256-GCM',
        keyRotationDays: 30,
        hipaaCompliant: true,
        auditLogging: true
      },
      performance: {
        algorithm: 'AES-256-GCM',
        keyRotationDays: 90,
        aggregationAllowed: true
      }
    }
  },
  authentication: {
    jwtExpiryHours: 24,
    refreshTokenDays: 30,
    maxLoginAttempts: 5,
    lockoutMinutes: 30,
    mfaTimeoutSeconds: 300,
    sessionTimeoutMinutes: {
      athlete: 240,
      coach: 180,
      medical: 120,
      admin: 60
    },
    mfaSettings: {
      athlete: ['biometric', 'push'],
      coach: ['totp', 'push'],
      medical: ['hardware', 'totp'],
      admin: ['hardware', 'certificate']
    }
  },
  passwords: {
    minLength: 12,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    hashIterations: 100000,
    hashAlgorithm: 'sha512',
    passwordHistory: 24,
    expiryDays: 90
  },
  tls: {
    version: '1.3',
    cipherSuites: [
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256'
    ],
    minDHSize: 2048,
    secureOptions: 'SSL_OP_NO_SSLv3 | SSL_OP_NO_TLSv1',
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    csp: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'"],
      connectSrc: ["'self'"]
    }
  }
};

/**
 * Returns environment-specific security configuration
 * @param environment - Current environment (development, staging, production)
 * @returns SecurityConfig - Environment-specific security configuration
 */
export function getSecurityConfig(environment: string): SecurityConfig {
  const config = { ...baseSecurityConfig };

  if (environment === ENVIRONMENT.PRODUCTION) {
    // Apply stricter security policies for production
    config.authentication.jwtExpiryHours = 12;
    config.authentication.maxLoginAttempts = 3;
    config.passwords.hashIterations = 200000;
    config.tls.csp = {
      ...config.tls.csp,
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'nonce-{nonce}'"],
      connectSrc: ["'self'", 'https://api.smartapparel.com']
    };
  }

  return config;
}

/**
 * Export the security configuration object
 */
export const securityConfig = {
  encryption: baseSecurityConfig.encryption,
  authentication: baseSecurityConfig.authentication,
  passwords: baseSecurityConfig.passwords,
  tls: baseSecurityConfig.tls
};

/**
 * Validate encryption key length against algorithm requirements
 * @throws Error if key length is insufficient
 */
(() => {
  const { keyLength, algorithm } = baseSecurityConfig.encryption;
  if (algorithm.includes('256') && keyLength < 256) {
    throw new Error('Insufficient key length for encryption algorithm');
  }
})();