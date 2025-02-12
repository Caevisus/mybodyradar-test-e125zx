/**
 * @fileoverview Express router configuration for athlete-related REST API endpoints
 * Implements secure, HIPAA-compliant routes with performance monitoring,
 * comprehensive validation, and role-based access control.
 * @version 1.0.0
 */

import { Router } from 'express'; // ^4.18.2
import winston from 'winston'; // ^3.8.2
import now from 'performance-now'; // ^2.1.0
import { RateLimiterMemory } from 'rate-limiter-flexible'; // ^2.4.1

import { AthleteController } from '../controllers/athlete.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';
import { errorHandler } from '../middlewares/error.middleware';
import { Logger } from '../../../utils/logger.util';
import { PERFORMANCE_THRESHOLDS } from '../../../constants/system.constants';

// Initialize logger
const logger = new Logger('AthleteRoutes', { performanceTracking: true });

// Configure rate limiter
const rateLimiter = new RateLimiterMemory({
  points: 100, // Number of requests
  duration: 60, // Per minute
  blockDuration: 300 // Block for 5 minutes if exceeded
});

/**
 * Configures athlete routes with comprehensive security and monitoring
 * @param controller AthleteController instance
 * @returns Configured Express router
 */
export const configureAthleteRoutes = (controller: AthleteController): Router => {
  const router = Router();

  // Apply global middleware
  router.use(async (req, res, next) => {
    try {
      await rateLimiter.consume(req.ip);
      next();
    } catch {
      res.status(429).json({ error: 'Too many requests' });
    }
  });

  // Create new athlete profile
  router.post('/athletes',
    authenticate,
    authorize(['coach', 'admin']),
    validateRequest,
    async (req, res, next) => {
      const startTime = now();
      try {
        await controller.createAthlete(req, res);
        
        const processingTime = now() - startTime;
        logger.performance('create_athlete_latency', processingTime, {
          correlationId: req.headers['x-correlation-id']
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Get athlete by ID
  router.get('/athletes/:id',
    authenticate,
    authorize(['athlete', 'coach', 'medical', 'admin']),
    async (req, res, next) => {
      const startTime = now();
      try {
        await controller.getAthleteById(req, res);
        
        const processingTime = now() - startTime;
        logger.performance('get_athlete_latency', processingTime, {
          correlationId: req.headers['x-correlation-id'],
          athleteId: req.params.id
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Get athletes by team
  router.get('/athletes/team/:teamId',
    authenticate,
    authorize(['coach', 'medical', 'admin']),
    async (req, res, next) => {
      const startTime = now();
      try {
        await controller.getAthletesByTeam(req, res);
        
        const processingTime = now() - startTime;
        logger.performance('get_team_athletes_latency', processingTime, {
          correlationId: req.headers['x-correlation-id'],
          teamId: req.params.teamId
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Update athlete profile
  router.put('/athletes/:id',
    authenticate,
    authorize(['athlete', 'coach', 'admin']),
    validateRequest,
    async (req, res, next) => {
      const startTime = now();
      try {
        await controller.updateAthlete(req, res);
        
        const processingTime = now() - startTime;
        logger.performance('update_athlete_latency', processingTime, {
          correlationId: req.headers['x-correlation-id'],
          athleteId: req.params.id
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Delete athlete profile
  router.delete('/athletes/:id',
    authenticate,
    authorize(['admin']),
    async (req, res, next) => {
      const startTime = now();
      try {
        await controller.deleteAthlete(req, res);
        
        const processingTime = now() - startTime;
        logger.performance('delete_athlete_latency', processingTime, {
          correlationId: req.headers['x-correlation-id'],
          athleteId: req.params.id
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Update athlete baseline data
  router.put('/athletes/:id/baseline',
    authenticate,
    authorize(['coach', 'medical', 'admin']),
    validateRequest,
    async (req, res, next) => {
      const startTime = now();
      try {
        await controller.updateBaselineData(req, res);
        
        const processingTime = now() - startTime;
        logger.performance('update_baseline_latency', processingTime, {
          correlationId: req.headers['x-correlation-id'],
          athleteId: req.params.id
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Update athlete preferences
  router.put('/athletes/:id/preferences',
    authenticate,
    authorize(['athlete', 'coach', 'admin']),
    validateRequest,
    async (req, res, next) => {
      const startTime = now();
      try {
        await controller.updatePreferences(req, res);
        
        const processingTime = now() - startTime;
        logger.performance('update_preferences_latency', processingTime, {
          correlationId: req.headers['x-correlation-id'],
          athleteId: req.params.id
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // Apply error handling middleware
  router.use(errorHandler);

  return router;
};

export default configureAthleteRoutes;