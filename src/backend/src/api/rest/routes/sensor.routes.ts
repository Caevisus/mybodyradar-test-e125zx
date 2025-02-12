/**
 * @fileoverview Express router configuration for sensor-related REST API endpoints
 * with enhanced security, performance monitoring, and HIPAA compliance features.
 * Implements real-time data processing with <100ms latency requirement.
 * @version 1.0.0
 */

import { Router } from 'express';
import compression from 'compression';
import helmet from 'helmet';
import winston from 'winston';
import now from 'performance-now';
import rateLimit from 'express-rate-limit';

import { SensorController } from '../controllers/sensor.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateSensorRequest } from '../middlewares/validation.middleware';
import { Logger } from '../../../utils/logger.util';
import { PERFORMANCE_THRESHOLDS } from '../../../constants/system.constants';

// Initialize logger for sensor routes
const logger = new Logger('SensorRoutes');

// Rate limiting configurations
const configRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});

const dataRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // limit each IP to 1000 requests per windowMs for real-time data
  message: 'Data ingestion rate limit exceeded'
});

/**
 * Configures sensor routes with enhanced security and monitoring
 * @param controller - Initialized sensor controller instance
 * @returns Configured Express router
 */
const configureSensorRoutes = (controller: SensorController): Router => {
  const router = Router();

  // Apply security middleware
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

  // Apply compression for response optimization
  router.use(compression());

  // Performance monitoring middleware
  const performanceMonitor = (req: any, res: any, next: any) => {
    const startTime = now();
    res.on('finish', () => {
      const processingTime = now() - startTime;
      if (processingTime > PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS) {
        logger.warn('High latency detected', {
          path: req.path,
          method: req.method,
          latency: processingTime
        });
      }
      logger.performance('request_processing_time', processingTime, {
        path: req.path,
        method: req.method
      });
    });
    next();
  };

  // Configure routes with security and monitoring
  router.get(
    '/api/sensors/:sensorId/config',
    configRateLimit,
    authenticate,
    authorize(['admin', 'coach', 'athlete']),
    validateSensorRequest,
    performanceMonitor,
    async (req, res, next) => {
      try {
        const result = await controller.getSensorConfig(req.params.sensorId);
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.put(
    '/api/sensors/:sensorId/config',
    configRateLimit,
    authenticate,
    authorize(['admin', 'coach']),
    validateSensorRequest,
    performanceMonitor,
    async (req, res, next) => {
      try {
        const result = await controller.updateSensorConfig(
          req.params.sensorId,
          req.body
        );
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/api/sensors/:sensorId/calibrate',
    configRateLimit,
    authenticate,
    authorize(['admin', 'coach']),
    validateSensorRequest,
    performanceMonitor,
    async (req, res, next) => {
      try {
        const result = await controller.calibrateSensor(
          req.params.sensorId,
          req.body
        );
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/api/sensors/:sensorId/data',
    dataRateLimit,
    authenticate,
    authorize(['admin', 'coach', 'athlete']),
    validateSensorRequest,
    performanceMonitor,
    async (req, res, next) => {
      try {
        const startTime = now();
        const result = await controller.processSensorData(
          req.params.sensorId,
          req.body
        );
        
        const processingTime = now() - startTime;
        if (processingTime > PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS) {
          logger.warn('Data processing latency exceeded threshold', {
            sensorId: req.params.sensorId,
            latency: processingTime
          });
        }

        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
};

export default configureSensorRoutes;