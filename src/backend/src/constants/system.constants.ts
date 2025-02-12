/**
 * @fileoverview Core system-wide constants for the smart-apparel platform
 * Defines environment types, performance thresholds, data retention policies,
 * and system timeouts used throughout the application.
 */

/**
 * Environment type definitions for system configuration
 */
export enum ENVIRONMENT {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production'
}

/**
 * Current environment based on NODE_ENV
 */
export const CURRENT_ENV = process.env.NODE_ENV || ENVIRONMENT.DEVELOPMENT;

/**
 * System performance and scaling thresholds
 * Based on technical requirements for real-time processing and system uptime
 */
export const PERFORMANCE_THRESHOLDS = {
  /** Maximum allowed processing latency in milliseconds */
  MAX_LATENCY_MS: 100,
  /** Minimum required system uptime percentage */
  MIN_UPTIME_PERCENTAGE: 99.9,
  /** Maximum number of concurrent users supported */
  MAX_CONCURRENT_USERS: 100000
} as const;

/**
 * Data retention configuration for different storage tiers
 * Implements the 5-year historical data retention policy
 */
export const DATA_RETENTION = {
  /** Number of days to keep data in hot storage for immediate access */
  HOT_STORAGE_DAYS: 7,
  /** Number of days to keep data in warm storage for medium-term access */
  WARM_STORAGE_DAYS: 30,
  /** Number of years to keep data in cold storage for long-term retention */
  COLD_STORAGE_YEARS: 5
} as const;

/**
 * Timeout configurations for various system operations
 * Ensures system responsiveness and reliability
 */
export const SYSTEM_TIMEOUTS = {
  /** Database operation timeout in milliseconds */
  DATABASE_MS: 5000,
  /** API request timeout in milliseconds */
  API_REQUEST_MS: 30000,
  /** WebSocket connection timeout in milliseconds */
  WEBSOCKET_MS: 45000,
  /** Kafka consumer timeout in milliseconds */
  KAFKA_CONSUMER_MS: 60000
} as const;

/**
 * Auto-scaling configuration parameters
 * Supports horizontal scaling up to 100k concurrent users
 */
export const SCALING_CONFIG = {
  /** Minimum number of service instances for high availability */
  MIN_INSTANCES: 2,
  /** Maximum number of service instances for peak load */
  MAX_INSTANCES: 20,
  /** CPU utilization percentage threshold for scaling */
  CPU_THRESHOLD: 70,
  /** Memory utilization percentage threshold for scaling */
  MEMORY_THRESHOLD: 80
} as const;