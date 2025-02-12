/**
 * @fileoverview Express router configuration for team management endpoints
 * Implements secure CRUD operations, athlete management, and team analytics
 * with comprehensive middleware chains for authentication, authorization, and validation
 * @version 1.0.0
 */

import { Router } from 'express';
import { TeamController } from '../controllers/team.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import validateRequest from '../middlewares/validation.middleware';
import { SYSTEM_TIMEOUTS } from '../../../constants/system.constants';
import { Logger } from '../../../utils/logger.util';
import { RateLimiterMemory } from 'rate-limiter-flexible';

// Initialize logger
const logger = new Logger('TeamRoutes', { performanceTracking: true });

// Rate limiter for sensitive operations
const rateLimiter = new RateLimiterMemory({
  points: 10, // Number of points
  duration: 60, // Per 60 seconds
  blockDuration: 300 // Block for 5 minutes if exceeded
});

/**
 * Configures and returns Express router with team management endpoints
 * @param teamController - Initialized team controller instance
 * @returns Configured Express router
 */
export const configureTeamRoutes = (teamController: TeamController): Router => {
  const router = Router({ mergeParams: true });

  /**
   * POST /teams
   * Creates a new team with comprehensive validation
   */
  router.post('/teams',
    authenticate,
    authorize(['admin', 'coach']),
    validateRequest,
    async (req, res, next) => {
      try {
        // Rate limiting check
        await rateLimiter.consume(req.ip);
        await teamController.createTeam(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /teams/:teamId
   * Retrieves team data with role-based access control
   */
  router.get('/teams/:teamId',
    authenticate,
    authorize(['admin', 'coach', 'medical']),
    validateRequest,
    async (req, res, next) => {
      try {
        await teamController.getTeam(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PUT /teams/:teamId
   * Updates team settings with validation and authorization
   */
  router.put('/teams/:teamId',
    authenticate,
    authorize(['admin', 'coach']),
    validateRequest,
    async (req, res, next) => {
      try {
        await rateLimiter.consume(req.ip);
        await teamController.updateTeam(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /teams/:teamId
   * Deletes team with cascade operations and admin-only access
   */
  router.delete('/teams/:teamId',
    authenticate,
    authorize(['admin']),
    validateRequest,
    async (req, res, next) => {
      try {
        await rateLimiter.consume(req.ip);
        await teamController.deleteTeam(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /teams/:teamId/athletes
   * Adds athlete to team with validation and authorization
   */
  router.post('/teams/:teamId/athletes',
    authenticate,
    authorize(['admin', 'coach']),
    validateRequest,
    async (req, res, next) => {
      try {
        await teamController.addAthlete(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /teams/:teamId/athletes/:athleteId
   * Removes athlete from team with proper authorization
   */
  router.delete('/teams/:teamId/athletes/:athleteId',
    authenticate,
    authorize(['admin', 'coach']),
    validateRequest,
    async (req, res, next) => {
      try {
        await teamController.removeAthlete(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /teams/:teamId/stats
   * Retrieves team analytics with performance optimization
   */
  router.get('/teams/:teamId/stats',
    authenticate,
    authorize(['admin', 'coach', 'medical']),
    validateRequest,
    async (req, res, next) => {
      try {
        await teamController.getTeamStats(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  // Add timeout to all routes
  router.use((req, res, next) => {
    res.setTimeout(SYSTEM_TIMEOUTS.API_REQUEST_MS, () => {
      const error = new Error('Request timeout');
      next(error);
    });
    next();
  });

  return router;
};

// Export configured router
export const teamRouter = configureTeamRoutes(new TeamController());