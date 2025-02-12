/**
 * @fileoverview Express router configuration for alert-related REST API endpoints
 * Implements real-time biomechanical and physiological alerts with HIPAA compliance
 * and <100ms latency requirement.
 * @version 1.0.0
 */

import { Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import now from 'performance-now';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { AlertController } from '../controllers/alert.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateAlertRequest } from '../middlewares/validation.middleware';
import { PERFORMANCE_THRESHOLDS } from '../../../constants/system.constants';

/**
 * Rate limiter configuration for alert endpoints
 */
const alertRateLimiter = new RateLimiterMemory({
  points: 100,
  duration: 60, // 1 minute
  blockDuration: 300 // 5 minutes block duration
});

/**
 * Configures alert routes with comprehensive security and performance features
 * @param alertController - Initialized AlertController instance
 * @returns Configured Express router
 */
export function initializeRoutes(alertController: AlertController): Router {
  const router = Router();

  // Apply global security middleware
  router.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(','),
    methods: ['GET', 'PATCH'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Correlation-ID'],
    maxAge: 900 // 15 minutes
  }));

  router.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
        connectSrc: ["'self'"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // Performance monitoring middleware
  router.use((req, res, next) => {
    const startTime = now();
    res.on('finish', () => {
      const processingTime = now() - startTime;
      if (processingTime > PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS) {
        console.warn(`Alert endpoint latency exceeded threshold: ${processingTime}ms`);
      }
    });
    next();
  });

  /**
   * GET /alerts
   * Retrieves alerts with filtering and pagination
   * Requires coach, medical, or admin role
   */
  router.get('/alerts',
    async (req, res, next) => {
      try {
        await alertRateLimiter.consume(req.ip);
        next();
      } catch {
        res.status(429).json({ error: 'Too many requests' });
      }
    },
    authenticate,
    authorize(['coach', 'medical', 'admin']),
    validateAlertRequest,
    alertController.getAlerts
  );

  /**
   * PATCH /alerts/:id
   * Updates alert status with audit logging
   * Requires medical or admin role
   */
  router.patch('/alerts/:id',
    async (req, res, next) => {
      try {
        await alertRateLimiter.consume(req.ip, 2); // Higher cost for updates
        next();
      } catch {
        res.status(429).json({ error: 'Too many requests' });
      }
    },
    authenticate,
    authorize(['medical', 'admin']),
    validateAlertRequest,
    alertController.updateAlert
  );

  /**
   * GET /alerts/subscribe
   * Establishes SSE connection for real-time alerts
   * Implements connection management and error handling
   */
  router.get('/alerts/subscribe',
    async (req, res, next) => {
      try {
        await alertRateLimiter.consume(req.ip, 5); // Higher cost for SSE
        next();
      } catch {
        res.status(429).json({ error: 'Too many requests' });
      }
    },
    authenticate,
    authorize(['coach', 'medical', 'admin']),
    alertController.subscribeToAlerts
  );

  /**
   * GET /alerts/metrics
   * Retrieves alert system performance metrics
   * Restricted to admin role
   */
  router.get('/alerts/metrics',
    async (req, res, next) => {
      try {
        await alertRateLimiter.consume(req.ip);
        next();
      } catch {
        res.status(429).json({ error: 'Too many requests' });
      }
    },
    authenticate,
    authorize(['admin']),
    alertController.getAlertMetrics
  );

  return router;
}

// Export configured router
export const alertRouter = initializeRoutes(new AlertController());