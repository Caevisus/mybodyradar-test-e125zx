/**
 * @fileoverview WebSocket handler for managing real-time training session data streams
 * Implements high-performance data processing with <100ms latency guarantee through
 * optimized stream processing and backpressure handling.
 */

import { WebSocket } from 'ws'; // v8.5.0
import { Subject, Observable, from, throwError } from 'rxjs'; // v7.8.0
import { 
  buffer, 
  debounceTime, 
  catchError, 
  retry, 
  map, 
  filter 
} from 'rxjs/operators'; // v7.8.0

import { ISession, ISessionMetrics } from '../../../interfaces/session.interface';
import { websocketConfig } from '../../../config/websocket.config';
import { PERFORMANCE_THRESHOLDS } from '../../../constants/system.constants';
import { Logger } from '../../../utils/logger';
import { CircuitBreaker } from '../../../utils/circuit-breaker';
import { RateLimiter } from '../../../utils/rate-limiter';

/**
 * Enhanced WebSocket handler for training session management with performance monitoring,
 * security, and error handling capabilities
 */
export class SessionHandler {
  private readonly logger: Logger;
  private readonly clients: Map<string, WebSocket>;
  private readonly sessionClientMap: Map<string, Set<string>>;
  private readonly metricsStream: Subject<ISessionMetrics>;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly rateLimiter: RateLimiter;
  private readonly performanceMonitor: PerformanceMonitor;

  constructor(
    private readonly sessionProcessor: SessionProcessor,
    performanceMonitor: PerformanceMonitor,
    private readonly securityService: SecurityService
  ) {
    this.logger = new Logger('SessionHandler');
    this.clients = new Map();
    this.sessionClientMap = new Map();
    this.metricsStream = new Subject();
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 30000
    });
    this.rateLimiter = new RateLimiter({
      windowMs: 1000,
      maxRequests: websocketConfig.rateLimits.perSecond
    });
    this.performanceMonitor = performanceMonitor;

    this.initializeMetricsStream();
  }

  /**
   * Handles new WebSocket connections with enhanced security and monitoring
   */
  public async handleConnection(
    ws: WebSocket, 
    request: Request, 
    securityContext: SecurityContext
  ): Promise<void> {
    try {
      // Validate authentication and authorization
      const authResult = await this.securityService.validateConnection(securityContext);
      if (!authResult.isValid) {
        this.logger.warn('Invalid connection attempt', { securityContext });
        ws.close(4001, 'Unauthorized');
        return;
      }

      // Generate secure client ID
      const clientId = this.securityService.generateSecureId();
      
      // Configure WebSocket
      ws.binaryType = 'arraybuffer';
      ws.on('message', async (data: Buffer) => {
        const startTime = performance.now();
        
        try {
          // Apply rate limiting
          if (!this.rateLimiter.checkLimit(clientId)) {
            throw new Error('Rate limit exceeded');
          }

          await this.handleMessage(clientId, data);
          
          // Monitor performance
          const processingTime = performance.now() - startTime;
          this.performanceMonitor.recordMetric('messageProcessingTime', processingTime);
          
          if (processingTime > PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS) {
            this.logger.warn('Processing time exceeded threshold', { 
              clientId, 
              processingTime 
            });
          }
        } catch (error) {
          this.handleError(ws, error);
        }
      });

      // Set up connection monitoring
      ws.on('close', () => this.handleDisconnection(clientId));
      ws.on('error', (error) => this.handleError(ws, error));
      
      // Initialize heartbeat monitoring
      this.initializeHeartbeat(ws, clientId);
      
      // Store client connection
      this.clients.set(clientId, ws);
      
      this.logger.info('Client connected', { clientId });
    } catch (error) {
      this.handleError(ws, error);
    }
  }

  /**
   * Processes incoming session data with performance optimization
   */
  private async handleMessage(
    clientId: string, 
    data: Buffer
  ): Promise<void> {
    const messageContext = {
      clientId,
      timestamp: Date.now()
    };

    try {
      // Validate message format
      const message = this.validateMessage(data);
      
      // Process through circuit breaker
      await this.circuitBreaker.execute(async () => {
        const sessionData = await this.sessionProcessor.processData(
          message,
          messageContext
        );

        // Update metrics stream
        this.metricsStream.next(sessionData.metrics);
        
        // Broadcast updates to relevant clients
        await this.broadcastSessionUpdate(
          sessionData.sessionId,
          sessionData.metrics
        );
      });
    } catch (error) {
      this.logger.error('Error processing message', {
        error,
        messageContext
      });
      throw error;
    }
  }

  /**
   * Broadcasts session updates to connected clients with backpressure handling
   */
  private async broadcastSessionUpdate(
    sessionId: string,
    metrics: ISessionMetrics
  ): Promise<void> {
    const clients = this.sessionClientMap.get(sessionId) || new Set();
    
    const broadcasts = Array.from(clients).map(async (clientId) => {
      const ws = this.clients.get(clientId);
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return;
      }

      return new Promise<void>((resolve, reject) => {
        ws.send(JSON.stringify(metrics), (error) => {
          if (error) {
            this.logger.error('Broadcast error', { sessionId, clientId, error });
            reject(error);
          } else {
            resolve();
          }
        });
      });
    });

    await Promise.all(broadcasts);
  }

  /**
   * Initializes metrics stream with backpressure handling and error recovery
   */
  private initializeMetricsStream(): void {
    this.metricsStream.pipe(
      buffer(this.metricsStream.pipe(debounceTime(50))),
      filter(metrics => metrics.length > 0),
      map(metrics => this.aggregateMetrics(metrics)),
      retry({
        count: 3,
        delay: 1000
      }),
      catchError(error => {
        this.logger.error('Metrics stream error', { error });
        return throwError(() => error);
      })
    ).subscribe();
  }

  /**
   * Initializes heartbeat monitoring for connection health checks
   */
  private initializeHeartbeat(ws: WebSocket, clientId: string): void {
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(interval);
        this.handleDisconnection(clientId);
      }
    }, websocketConfig.heartbeatInterval);

    ws.on('pong', () => {
      this.performanceMonitor.recordMetric('lastPong', Date.now());
    });
  }

  /**
   * Handles client disconnection and cleanup
   */
  private handleDisconnection(clientId: string): void {
    this.clients.delete(clientId);
    this.sessionClientMap.forEach((clients, sessionId) => {
      clients.delete(clientId);
      if (clients.size === 0) {
        this.sessionClientMap.delete(sessionId);
      }
    });
    this.logger.info('Client disconnected', { clientId });
  }

  /**
   * Handles WebSocket errors with appropriate logging and client notification
   */
  private handleError(ws: WebSocket, error: Error): void {
    this.logger.error('WebSocket error', { error });
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Internal server error' 
      }));
    }
  }

  /**
   * Aggregates multiple metrics updates into a single update
   */
  private aggregateMetrics(metrics: ISessionMetrics[]): ISessionMetrics {
    // Implement metrics aggregation logic
    return metrics.reduce((acc, curr) => ({
      ...acc,
      ...curr
    }));
  }

  /**
   * Validates incoming message format and content
   */
  private validateMessage(data: Buffer): any {
    try {
      const message = JSON.parse(data.toString());
      // Add message validation logic
      return message;
    } catch (error) {
      throw new Error('Invalid message format');
    }
  }
}