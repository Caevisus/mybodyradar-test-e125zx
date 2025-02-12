/**
 * @fileoverview Express router configuration for session management endpoints
 * Implements real-time data processing with <100ms latency and comprehensive security
 * @version 1.0.0
 */

import { Router } from 'express'; // ^4.18.2
import { rateLimit } from 'express-rate-limit'; // ^6.7.0
import compression from 'compression'; // ^1.7.4
import swaggerJsdoc from 'swagger-jsdoc'; // ^6.2.8
import { SessionController } from '../controllers/session.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';
import { PERFORMANCE_THRESHOLDS, SYSTEM_TIMEOUTS } from '../../../constants/system.constants';
import { Logger } from '../../../utils/logger.util';

// Initialize logger
const logger = new Logger('SessionRoutes');

// Configure rate limiting
const sessionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many session requests, please try again later'
});

// Configure performance monitoring
const performanceMonitor = (req: any, res: any, next: any) => {
  const startTime = performance.now();
  res.on('finish', () => {
    const duration = performance.now() - startTime;
    if (duration > PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS) {
      logger.warn('Performance threshold exceeded', {
        path: req.path,
        duration,
        threshold: PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS
      });
    }
  });
  next();
};

/**
 * Configures and returns session management router
 */
export const configureSessionRoutes = (sessionController: SessionController): Router => {
  const router = Router();

  // Apply global middleware
  router.use(compression());
  router.use(performanceMonitor);

  /**
   * @swagger
   * /sessions:
   *   post:
   *     summary: Create new training session
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/SessionConfig'
   */
  router.post('/',
    authenticate,
    sessionRateLimiter,
    validateRequest,
    async (req, res, next) => {
      try {
        const session = await sessionController.createSession(req, res);
        res.status(201).json(session);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * @swagger
   * /sessions/{id}:
   *   get:
   *     summary: Retrieve session details
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   */
  router.get('/:id',
    authenticate,
    validateRequest,
    async (req, res, next) => {
      try {
        const session = await sessionController.getSession(req, res);
        res.status(200).json(session);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * @swagger
   * /sessions/{id}/data:
   *   put:
   *     summary: Update session with sensor data
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/SensorData'
   */
  router.put('/:id/data',
    authenticate,
    validateRequest,
    compression(),
    async (req, res, next) => {
      try {
        await sessionController.updateSessionData(req, res);
        res.status(200).json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * @swagger
   * /sessions/{id}:
   *   delete:
   *     summary: End training session
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   */
  router.delete('/:id',
    authenticate,
    validateRequest,
    async (req, res, next) => {
      try {
        await sessionController.endSession(req, res);
        res.status(200).json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
};

// Export configured router
export const sessionRouter = configureSessionRoutes(new SessionController());