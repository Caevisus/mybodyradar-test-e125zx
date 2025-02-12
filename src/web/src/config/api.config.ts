/**
 * @fileoverview API Configuration for Smart Apparel System
 * @version 1.0.0
 * 
 * Centralizes API configuration settings with enhanced security, monitoring,
 * and compliance features for the smart-apparel web application.
 */

import { API_VERSION, API_ENDPOINTS, REQUEST_CONFIG, WEBSOCKET_CONFIG } from '../constants/api.constants';
import process from 'process'; // v0.11.10

// Constants for URL validation and configuration
const DEFAULT_API_URL = 'http://localhost:3000';
const DEFAULT_GRAPHQL_URL = 'http://localhost:3000/graphql';
const DEFAULT_WEBSOCKET_URL = 'ws://localhost:3000/ws';
const URL_VALIDATION_REGEX = /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/;

/**
 * Validates URL format and accessibility
 * @param url - URL to validate
 * @returns boolean indicating URL validity
 */
const validateUrl = (url: string): boolean => {
  if (!url) return false;
  return URL_VALIDATION_REGEX.test(url);
};

/**
 * Retrieves and validates the appropriate base URL
 * @throws Error if production URL is invalid
 * @returns Validated base URL for API requests
 */
const getBaseUrl = (): string => {
  const isProd = process.env.NODE_ENV === 'production';
  const configuredUrl = process.env.API_BASE_URL;

  if (isProd && !configuredUrl) {
    throw new Error('Production API URL must be configured via environment variable API_BASE_URL');
  }

  if (configuredUrl && !validateUrl(configuredUrl)) {
    throw new Error(`Invalid API URL format: ${configuredUrl}`);
  }

  return configuredUrl || DEFAULT_API_URL;
};

/**
 * Comprehensive API configuration object with security, monitoring,
 * and compliance features
 */
export const apiConfig = {
  // Core API Configuration
  baseURL: getBaseUrl(),
  graphqlURL: process.env.GRAPHQL_URL || DEFAULT_GRAPHQL_URL,
  websocketURL: process.env.WEBSOCKET_URL || DEFAULT_WEBSOCKET_URL,
  version: API_VERSION,
  endpoints: API_ENDPOINTS,

  // Request Configuration
  timeout: REQUEST_CONFIG.TIMEOUT,
  retryAttempts: REQUEST_CONFIG.RETRY_ATTEMPTS,
  retryDelay: REQUEST_CONFIG.RETRY_DELAY,

  // WebSocket Configuration
  websocket: {
    ...WEBSOCKET_CONFIG,
    protocols: ['v1.smart-apparel.protocol'],
    keepAlive: true
  },

  // Security Configuration
  security: {
    requireSSL: process.env.NODE_ENV === 'production',
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", getBaseUrl()]
    },
    rateLimiting: REQUEST_CONFIG.RATE_LIMIT,
    cors: {
      allowedOrigins: process.env.NODE_ENV === 'production' 
        ? [getBaseUrl()]
        : ['http://localhost:3000'],
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['X-Total-Count'],
      maxAge: 86400
    }
  },

  // Monitoring Configuration
  monitoring: {
    enableMetrics: true,
    metricsEndpoint: '/metrics',
    logLevel: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
    performance: {
      slowRequestThreshold: 5000,
      errorThreshold: 0.05
    },
    healthCheck: {
      enabled: true,
      interval: 30000,
      endpoint: '/health'
    }
  },

  // Compliance Configuration
  compliance: {
    hipaa: {
      enabled: true,
      dataRetention: {
        enabled: true,
        duration: 7 * 365 * 24 * 60 * 60 * 1000 // 7 years in milliseconds
      },
      audit: {
        enabled: true,
        logAccess: true,
        logModification: true
      }
    },
    gdpr: {
      enabled: true,
      dataProtection: {
        encryption: true,
        pseudonymization: true
      },
      userRights: {
        dataPortability: true,
        rightToErasure: true
      }
    }
  }
} as const;

// Type definition for the API configuration
export type ApiConfig = typeof apiConfig;