/**
 * @fileoverview REST API controller for managing real-time biomechanical and physiological alerts
 * in the smart apparel system. Implements comprehensive alert management with enhanced security,
 * performance optimization, and monitoring capabilities.
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { AlertService } from '../../../services/alert/alert.service';
import { IAlert } from '../../../interfaces/alert.interface';
import { Logger } from '../../../utils/logger.util';
import { ALERT_TYPES, ALERT_SEVERITY, ALERT_STATUS } from '../../../constants/alert.constants';
import { PERFORMANCE_THRESHOLDS } from '../../../constants/system.constants';

/**
 * Enhanced controller for alert management with real-time capabilities
 */
export class AlertController {
  private readonly alertService: AlertService;
  private readonly logger: Logger;
  private readonly sseClients: Set<Response>;
  private readonly maxConnections: number;

  constructor(alertService: AlertService) {
    this.alertService = alertService;
    this.logger = new Logger('AlertController', { performanceTracking: true });
    this.sseClients = new Set();
    this.maxConnections = 1000;

    // Setup SSE client cleanup interval
    setInterval(this.cleanupSseClients.bind(this), 30000);
  }

  /**
   * Retrieves paginated alerts with caching and compression
   * @route GET /api/alerts
   */
  @authenticate
  @authorize(['coach', 'medical', 'admin'])
  async getAlerts(req: Request, res: Response): Promise<void> {
    const startTime = process.hrtime();

    try {
      // Parse and validate query parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const type = req.query.type as ALERT_TYPES;
      const minSeverity = req.query.minSeverity as ALERT_SEVERITY;
      const status = req.query.status as ALERT_STATUS;

      // Get alerts with pagination
      const alerts = await this.alertService.getActiveAlerts({
        page,
        limit,
        type,
        minSeverity,
        status
      });

      // Calculate processing time
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const processingTime = seconds * 1000 + nanoseconds / 1000000;

      // Log performance metrics
      this.logger.performance('alert_retrieval_latency', processingTime, {
        alertCount: alerts.length,
        threshold: PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS
      });

      res.status(httpStatus.OK).json({
        data: alerts,
        pagination: {
          page,
          limit,
          total: alerts.length
        },
        metadata: {
          processingTime,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      this.logger.error('Failed to retrieve alerts', error as Error);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to retrieve alerts'
      });
    }
  }

  /**
   * Updates alert status with validation and audit logging
   * @route PUT /api/alerts/:alertId
   */
  @authenticate
  @authorize(['medical', 'admin'])
  async updateAlert(req: Request, res: Response): Promise<void> {
    const startTime = process.hrtime();

    try {
      const { alertId } = req.params;
      const { status, notes } = req.body;

      // Validate status update
      if (!Object.values(ALERT_STATUS).includes(status)) {
        res.status(httpStatus.BAD_REQUEST).json({
          error: 'Invalid alert status'
        });
        return;
      }

      // Update alert status
      const updatedAlert = await this.alertService.updateAlertStatus(
        alertId,
        status,
        {
          userId: (req as any).userId,
          notes,
          timestamp: new Date()
        }
      );

      if (!updatedAlert) {
        res.status(httpStatus.NOT_FOUND).json({
          error: 'Alert not found'
        });
        return;
      }

      // Notify SSE clients
      this.notifySseClients({
        type: 'ALERT_UPDATE',
        data: updatedAlert
      });

      // Calculate and log processing time
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const processingTime = seconds * 1000 + nanoseconds / 1000000;

      this.logger.performance('alert_update_latency', processingTime, {
        alertId,
        status,
        threshold: PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS
      });

      res.status(httpStatus.OK).json({
        data: updatedAlert,
        metadata: {
          processingTime,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      this.logger.error('Failed to update alert', error as Error);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to update alert'
      });
    }
  }

  /**
   * Establishes SSE connection for real-time alert updates
   * @route GET /api/alerts/subscribe
   */
  @authenticate
  @authorize(['coach', 'medical', 'admin'])
  async subscribeToAlerts(req: Request, res: Response): Promise<void> {
    try {
      // Check connection limit
      if (this.sseClients.size >= this.maxConnections) {
        res.status(httpStatus.SERVICE_UNAVAILABLE).json({
          error: 'Maximum SSE connections reached'
        });
        return;
      }

      // Setup SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      // Subscribe to alert service events
      const unsubscribe = await this.alertService.subscribeToAlerts({
        types: req.query.types as ALERT_TYPES[],
        minSeverity: req.query.minSeverity as ALERT_SEVERITY
      });

      // Add client to active connections
      this.sseClients.add(res);

      // Setup heartbeat
      const heartbeat = setInterval(() => {
        res.write(':\n\n');
      }, 30000);

      // Handle client disconnect
      req.on('close', () => {
        clearInterval(heartbeat);
        this.sseClients.delete(res);
        unsubscribe();
        
        this.logger.info('SSE client disconnected', {
          clientCount: this.sseClients.size
        });
      });

      this.logger.info('SSE client connected', {
        clientCount: this.sseClients.size
      });
    } catch (error) {
      this.logger.error('Failed to establish SSE connection', error as Error);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to establish SSE connection'
      });
    }
  }

  /**
   * Notifies all SSE clients with new alert data
   */
  private notifySseClients(event: { type: string; data: any }): void {
    const message = `data: ${JSON.stringify(event)}\n\n`;
    
    this.sseClients.forEach(client => {
      try {
        client.write(message);
      } catch (error) {
        this.logger.error('Failed to send SSE message', error as Error);
        this.sseClients.delete(client);
      }
    });
  }

  /**
   * Cleans up stale SSE connections
   */
  private cleanupSseClients(): void {
    this.sseClients.forEach(client => {
      if (!client.writable) {
        this.sseClients.delete(client);
      }
    });
  }
}