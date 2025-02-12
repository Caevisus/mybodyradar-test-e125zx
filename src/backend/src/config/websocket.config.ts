/**
 * @fileoverview WebSocket server configuration for real-time sensor data streaming
 * Provides environment-specific optimizations for handling high-throughput 
 * sensor data with sub-100ms latency and support for up to 100k concurrent users.
 */

import { WebSocket } from 'ws';
import { ENVIRONMENT, SYSTEM_TIMEOUTS } from '../constants/system.constants';

/**
 * Environment-specific WebSocket server configurations
 * Optimized for different deployment scenarios while maintaining
 * performance requirements across environments
 */
const WEBSOCKET_CONFIG: Record<ENVIRONMENT, WebSocket.ServerOptions> = {
  [ENVIRONMENT.DEVELOPMENT]: {
    port: 8080,
    path: '/ws/sensor-data',
    maxPayload: 1024 * 1024, // 1MB max payload for development
    perMessageDeflate: true,
    clientTracking: true,
    backpressureThreshold: 16 * 1024, // 16KB threshold for development
    maxBackpressure: 1024 * 1024, // 1MB max backpressure
    handleProtocols: (protocols) => {
      return protocols.includes('sensor-data') ? 'sensor-data' : false;
    },
    verifyClient: (info, callback) => {
      // Less strict verification for development
      callback(true);
    },
    skipUTF8Validation: false,
  },
  [ENVIRONMENT.PRODUCTION]: {
    port: Number(process.env.WS_PORT) || 8080,
    path: '/ws/sensor-data',
    maxPayload: 512 * 1024, // 512KB max payload for production
    perMessageDeflate: {
      zlibDeflateOptions: {
        level: 6, // Balanced compression
        memLevel: 8,
      },
      zlibInflateOptions: {
        chunkSize: 16 * 1024
      },
      clientNoContextTakeover: true,
      serverNoContextTakeover: true,
      threshold: 1024, // Only compress messages larger than 1KB
    },
    clientTracking: true,
    backpressureThreshold: 32 * 1024, // 32KB threshold for production
    maxBackpressure: 512 * 1024, // 512KB max backpressure
    handleProtocols: (protocols) => {
      return protocols.includes('sensor-data') ? 'sensor-data' : false;
    },
    verifyClient: (info, callback) => {
      // Strict client verification for production
      const isSecure = info.req.headers['x-forwarded-proto'] === 'wss';
      const hasValidOrigin = validateOrigin(info.origin);
      callback(isSecure && hasValidOrigin);
    },
    skipUTF8Validation: false,
  }
};

/**
 * Validates WebSocket connection origin
 * @param origin - The origin of the WebSocket connection request
 * @returns boolean indicating if the origin is valid
 */
const validateOrigin = (origin: string): boolean => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  return allowedOrigins.includes(origin);
};

/**
 * Retrieves environment-specific WebSocket configuration
 * with optimized parameters for performance and scaling
 * @returns WebSocket.ServerOptions - Configured WebSocket server options
 */
export const getWebSocketConfig = (): WebSocket.ServerOptions => {
  const currentEnv = process.env.NODE_ENV as ENVIRONMENT || ENVIRONMENT.DEVELOPMENT;
  const config = WEBSOCKET_CONFIG[currentEnv];

  return {
    ...config,
    // Apply system-wide timeout configuration
    clientTimeout: SYSTEM_TIMEOUTS.WEBSOCKET_MS,
    // Add ping/pong for connection health monitoring
    pingInterval: Math.floor(SYSTEM_TIMEOUTS.WEBSOCKET_MS / 3),
    pingTimeout: Math.floor(SYSTEM_TIMEOUTS.WEBSOCKET_MS / 2),
  };
};

/**
 * Exported WebSocket configuration with optimized settings
 * for real-time sensor data streaming
 */
export const websocketConfig = getWebSocketConfig();