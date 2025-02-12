/**
 * @fileoverview Central router configuration aggregating all REST API routes
 * with comprehensive security, performance monitoring, and error handling.
 * Implements <100ms latency requirement and tiered rate limiting.
 * @version 1.0.0
 */

import { Router } from 'express'; // ^4.18.2
import rateLimit from 'express-rate-limit'; // ^6.9.0
import helmet from 'helmet'; // ^7.0.0
import compression from 'compression'; // ^1.7.4
import errorHandler from 'express-error-handler'; // ^1.1.0
import performanceMonitor from 'express-performance-monitor'; // ^2.0.0

import { alertRouter } from './alert.routes';
import { authRouter } from './auth.routes';
import { sensorRouter } from './sensor.routes';
import { healthRouter } from './health.routes';
import { sessionRouter } from './session.routes';
import { teamRouter } from './team.routes';
import { Logger } from '../../../utils/logger.util';
import { PERFORMANCE_THRESHOLDS } from '../../../constants/system.constants';

// Initialize logger
const logger = new Logger('APIRouter', { performanceTracking: true });

// Configure rate limits based on endpoint type
const queryRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute
  message: 'Query API rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false
});

const integrationRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 500, // 500 requests per minute
  message: 'Integration API rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false
});

const adminRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Admin API rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Configures and combines all API routes with security middleware,
 * rate limiting, and performance monitoring
 */
export function configureAPIRoutes(): Router {
  const router = Router();

  // Apply security headers
  router.use(helmet({
    contentSecurityPolicy: true,
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: true,
    dnsPrefetchControl: true,
    frameguard: true,
    hidePoweredBy: true,
    hsts: true,
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: true,
    referrerPolicy: true,
    xssFilter: true
  }));

  // Apply compression
  router.use(compression());

  // Performance monitoring middleware
  router.use(performanceMonitor({
    path: '/metrics',
    threshold: PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS,
    onLatencyThresholdExceeded: (latency, path) => {
      logger.warn('Latency threshold exceeded', {
        path,
        latency,
        threshold: PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS
      });
    }
  }));

  // Mount routes with appropriate rate limits
  router.use('/health', integrationRateLimit, healthRouter);
  router.use('/auth', adminRateLimit, authRouter);
  router.use('/alerts', integrationRateLimit, alertRouter);
  router.use('/sensors', queryRateLimit, sensorRouter);
  router.use('/sessions', queryRateLimit, sessionRouter);
  router.use('/teams', queryRateLimit, teamRouter);

  // Error handling middleware
  router.use(errorHandler({
    logger: (err, str, req) => {
      logger.error('API Error', err, {
        path: req.path,
        method: req.method,
        correlationId: req.headers['x-correlation-id']
      });
    },
    includeErr: process.env.NODE_ENV !== 'production',
    formatters: {
      json: (err, options) => ({
        error: {
          message: err.message,
          code: err.code || 'INTERNAL_ERROR',
          correlationId: options.req.headers['x-correlation-id'],
          timestamp: new Date().toISOString()
        }
      })
    }
  }));

  return router;
}

// Export configured router
export const router = configureAPIRoutes();