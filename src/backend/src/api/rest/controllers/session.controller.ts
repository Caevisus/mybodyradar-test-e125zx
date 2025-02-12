/**
 * @fileoverview REST API controller for managing training sessions with real-time data processing,
 * comprehensive error handling, performance monitoring, and HIPAA compliance.
 * @version 1.0.0
 */

import { Request, Response } from 'express'; // ^4.18.2
import { StatusCodes } from 'http-status'; // ^1.6.2
import { SessionManager } from '../../../services/session/session.manager';
import { ISession } from '../../../interfaces/session.interface';
import { authenticate } from '../middlewares/auth.middleware';
import { validateSensorData } from '../../../utils/validation.util';
import { Logger } from '../../../utils/logger.util';
import { PERFORMANCE_THRESHOLDS } from '../../../constants/system.constants';

// Initialize logger
const logger = new Logger('SessionController', { performanceTracking: true });

/**
 * Controller class implementing session management endpoints with HIPAA compliance
 */
class SessionController {
  private sessionManager: SessionManager;

  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
  }

  /**
   * Creates a new training session with comprehensive validation and monitoring
   */
  @authenticate
  public async createSession(req: Request, res: Response): Promise<void> {
    const startTime = performance.now();
    const correlationId = req.headers['x-correlation-id'] as string;

    try {
      // Extract athlete ID from authenticated request
      const athleteId = (req as any).userId;
      if (!athleteId) {
        throw new Error('Athlete ID not found in request');
      }

      // Validate session configuration
      const sessionConfig = req.body;
      if (!sessionConfig || !sessionConfig.type) {
        throw new Error('Invalid session configuration');
      }

      // Create session with performance monitoring
      const session = await this.sessionManager.createSession({
        athleteId,
        config: sessionConfig,
        startTime: new Date(),
        metrics: {},
        status: {
          current: 'active',
          timestamp: new Date(),
          history: []
        }
      });

      // Log success with performance metrics
      const latency = performance.now() - startTime;
      logger.info('Session created successfully', {
        sessionId: session.id,
        athleteId,
        latency,
        correlationId
      });

      // Return success response
      res.status(StatusCodes.CREATED).json({
        success: true,
        data: session,
        metadata: {
          latency,
          timestamp: new Date()
        }
      });

    } catch (error) {
      logger.error('Failed to create session', error as Error, {
        correlationId,
        latency: performance.now() - startTime
      });

      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  /**
   * Updates session with real-time sensor data and performance monitoring
   */
  @authenticate
  public async updateSessionData(req: Request, res: Response): Promise<void> {
    const startTime = performance.now();
    const correlationId = req.headers['x-correlation-id'] as string;
    const { sessionId } = req.params;

    try {
      // Validate session ID
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      // Validate sensor data
      const sensorData = req.body;
      await validateSensorData(sensorData);

      // Process sensor data with latency monitoring
      await this.sessionManager.handleSensorData(sessionId, sensorData);

      const latency = performance.now() - startTime;
      if (latency > PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS) {
        logger.warn('High latency in data processing', {
          sessionId,
          latency,
          threshold: PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS,
          correlationId
        });
      }

      res.status(StatusCodes.OK).json({
        success: true,
        metadata: {
          latency,
          timestamp: new Date()
        }
      });

    } catch (error) {
      logger.error('Failed to update session data', error as Error, {
        sessionId,
        correlationId,
        latency: performance.now() - startTime
      });

      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  /**
   * Retrieves session metrics with HIPAA compliance checks
   */
  @authenticate
  public async getSession(req: Request, res: Response): Promise<void> {
    const startTime = performance.now();
    const correlationId = req.headers['x-correlation-id'] as string;
    const { sessionId } = req.params;

    try {
      // Validate session ID
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      // Get session metrics with HIPAA compliance
      const metrics = await this.sessionManager.getSessionMetrics(sessionId);

      const latency = performance.now() - startTime;
      logger.info('Session metrics retrieved', {
        sessionId,
        latency,
        correlationId
      });

      res.status(StatusCodes.OK).json({
        success: true,
        data: metrics,
        metadata: {
          latency,
          timestamp: new Date()
        }
      });

    } catch (error) {
      logger.error('Failed to retrieve session', error as Error, {
        sessionId,
        correlationId,
        latency: performance.now() - startTime
      });

      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: (error as Error).message
      });
    }
  }

  /**
   * Ends active training session with final metrics collection
   */
  @authenticate
  public async endSession(req: Request, res: Response): Promise<void> {
    const startTime = performance.now();
    const correlationId = req.headers['x-correlation-id'] as string;
    const { sessionId } = req.params;

    try {
      // Validate session ID
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      // End session and collect final metrics
      await this.sessionManager.endSession(sessionId);

      const latency = performance.now() - startTime;
      logger.info('Session ended successfully', {
        sessionId,
        latency,
        correlationId
      });

      res.status(StatusCodes.OK).json({
        success: true,
        metadata: {
          latency,
          timestamp: new Date()
        }
      });

    } catch (error) {
      logger.error('Failed to end session', error as Error, {
        sessionId,
        correlationId,
        latency: performance.now() - startTime
      });

      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: (error as Error).message
      });
    }
  }
}

export default SessionController;