/**
 * @fileoverview API Constants for Smart Apparel System
 * @version 1.0.0
 * 
 * Contains core API-related constants including endpoints, headers,
 * request configurations, and WebSocket settings for the smart-apparel
 * web application.
 */

/**
 * Current API version identifier
 */
export const API_VERSION = 'v1';

/**
 * API endpoint configurations organized by domain
 */
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    SIGNUP: '/auth/signup',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    VERIFY: '/auth/verify',
    RESET_PASSWORD: '/auth/reset-password',
    MFA: '/auth/mfa'
  },
  SENSOR: {
    CALIBRATE: '/sensor/calibrate',
    DATA: '/sensor/data',
    STATUS: '/sensor/status',
    CONFIGURE: '/sensor/configure',
    DIAGNOSTICS: '/sensor/diagnostics',
    FIRMWARE: '/sensor/firmware'
  },
  SESSION: {
    CREATE: '/session/create',
    UPDATE: '/session/update',
    END: '/session/end',
    LIST: '/session/list',
    DETAILS: '/session/details',
    EXPORT: '/session/export',
    SHARE: '/session/share'
  },
  ATHLETE: {
    PROFILE: '/athlete/profile',
    METRICS: '/athlete/metrics',
    HISTORY: '/athlete/history',
    GOALS: '/athlete/goals',
    PROGRESS: '/athlete/progress',
    RECOMMENDATIONS: '/athlete/recommendations'
  },
  TEAM: {
    LIST: '/team/list',
    MEMBERS: '/team/members',
    STATS: '/team/stats',
    SCHEDULE: '/team/schedule',
    PERFORMANCE: '/team/performance',
    COMPARISON: '/team/comparison'
  },
  ALERT: {
    LIST: '/alert/list',
    CREATE: '/alert/create',
    UPDATE: '/alert/update',
    DELETE: '/alert/delete',
    SETTINGS: '/alert/settings',
    HISTORY: '/alert/history'
  },
  ANALYTICS: {
    HEATMAP: '/analytics/heatmap',
    PERFORMANCE: '/analytics/performance',
    BIOMECHANICS: '/analytics/biomechanics',
    TRENDS: '/analytics/trends',
    REPORTS: '/analytics/reports',
    EXPORT: '/analytics/export'
  }
} as const;

/**
 * Standard HTTP headers for API requests
 */
export const API_HEADERS = {
  CONTENT_TYPE: 'application/json',
  AUTHORIZATION: 'Authorization',
  ACCEPT: 'application/json',
  API_KEY: 'X-API-Key',
  CORRELATION_ID: 'X-Correlation-ID',
  CLIENT_VERSION: 'X-Client-Version'
} as const;

/**
 * API request configuration parameters
 */
export const REQUEST_CONFIG = {
  /** Request timeout in milliseconds */
  TIMEOUT: 30000,
  /** Number of retry attempts for failed requests */
  RETRY_ATTEMPTS: 3,
  /** Delay between retry attempts in milliseconds */
  RETRY_DELAY: 1000,
  /** Rate limiting configurations per endpoint type */
  RATE_LIMIT: {
    REAL_TIME: 100, // requests per second
    QUERY: 1000, // requests per minute
    INTEGRATION: 500, // requests per minute
    ANALYTICS: 200, // requests per minute
    EXPORT: 50 // requests per minute
  },
  /** Maximum number of items in batch requests */
  BATCH_SIZE: 100,
  /** Cache duration in milliseconds */
  CACHE_DURATION: 300000
} as const;

/**
 * WebSocket configuration for real-time data streaming
 */
export const WEBSOCKET_CONFIG = {
  /** Maximum number of reconnection attempts */
  RECONNECT_ATTEMPTS: 5,
  /** Interval between reconnection attempts in milliseconds */
  RECONNECT_INTERVAL: 5000,
  /** Interval for ping messages in milliseconds */
  PING_INTERVAL: 30000,
  /** Timeout for heartbeat messages in milliseconds */
  HEARTBEAT_TIMEOUT: 60000,
  /** Maximum message size in bytes (1MB) */
  MESSAGE_SIZE_LIMIT: 1048576,
  /** Threshold for message compression in bytes (1KB) */
  COMPRESSION_THRESHOLD: 1024
} as const;

// Type definitions for better TypeScript support
export type ApiEndpoints = typeof API_ENDPOINTS;
export type ApiHeaders = typeof API_HEADERS;
export type RequestConfig = typeof REQUEST_CONFIG;
export type WebSocketConfig = typeof WEBSOCKET_CONFIG;