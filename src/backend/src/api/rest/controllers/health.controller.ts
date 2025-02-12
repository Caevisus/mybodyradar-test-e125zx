import { Request, Response } from 'express';
import { Registry, Gauge, Histogram } from 'prom-client';
import { Logger } from '../../../utils/logger.util';
import { PERFORMANCE_THRESHOLDS, SYSTEM_TIMEOUTS } from '../../../constants/system.constants';

/**
 * Controller handling system health monitoring and metrics collection
 * Implements comprehensive health checks with Prometheus integration
 */
export class HealthController {
  private readonly logger: Logger;
  private readonly metricsRegistry: Registry;
  private readonly uptimeGauge: Gauge<string>;
  private readonly latencyHistogram: Histogram<string>;
  private readonly startTime: number;

  // Component health gauges
  private readonly dbHealthGauge: Gauge<string>;
  private readonly sensorHealthGauge: Gauge<string>;
  private readonly apiGatewayHealthGauge: Gauge<string>;
  private readonly messageQueueHealthGauge: Gauge<string>;

  constructor() {
    this.logger = new Logger('HealthController');
    this.startTime = Date.now();
    
    // Initialize Prometheus registry and metrics
    this.metricsRegistry = new Registry();
    
    this.uptimeGauge = new Gauge({
      name: 'system_uptime_seconds',
      help: 'System uptime in seconds',
      registers: [this.metricsRegistry]
    });

    this.latencyHistogram = new Histogram({
      name: 'health_check_duration_seconds',
      help: 'Health check duration in seconds',
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
      registers: [this.metricsRegistry]
    });

    this.dbHealthGauge = new Gauge({
      name: 'database_health_status',
      help: 'Database health status (1 = healthy, 0 = unhealthy)',
      registers: [this.metricsRegistry]
    });

    this.sensorHealthGauge = new Gauge({
      name: 'sensor_system_health_status',
      help: 'Sensor system health status (1 = healthy, 0 = unhealthy)',
      registers: [this.metricsRegistry]
    });

    this.apiGatewayHealthGauge = new Gauge({
      name: 'api_gateway_health_status',
      help: 'API Gateway health status (1 = healthy, 0 = unhealthy)',
      registers: [this.metricsRegistry]
    });

    this.messageQueueHealthGauge = new Gauge({
      name: 'message_queue_health_status',
      help: 'Message queue health status (1 = healthy, 0 = unhealthy)',
      registers: [this.metricsRegistry]
    });
  }

  /**
   * Comprehensive system health check endpoint
   * Monitors all critical components and collects performance metrics
   */
  public async checkHealth(req: Request, res: Response): Promise<Response> {
    const checkStartTime = Date.now();
    const histogramTimer = this.latencyHistogram.startTimer();

    try {
      // Update system uptime metric
      const uptimeSeconds = (Date.now() - this.startTime) / 1000;
      this.uptimeGauge.set(uptimeSeconds);

      // Check component health statuses
      const [
        dbHealth,
        sensorHealth,
        messageQueueHealth,
        apiGatewayHealth
      ] = await Promise.all([
        this.checkDatabaseHealth(),
        this.checkSensorSystemHealth(),
        this.checkMessageQueueHealth(),
        this.checkApiGatewayHealth()
      ]);

      // Update component health gauges
      this.dbHealthGauge.set(dbHealth.healthy ? 1 : 0);
      this.sensorHealthGauge.set(sensorHealth.healthy ? 1 : 0);
      this.messageQueueHealthGauge.set(messageQueueHealth.healthy ? 1 : 0);
      this.apiGatewayHealthGauge.set(apiGatewayHealth.healthy ? 1 : 0);

      // Calculate response time
      const responseTime = Date.now() - checkStartTime;
      const withinSla = responseTime <= PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS;

      // Generate health report
      const healthStatus = {
        status: 'ok',
        uptime: uptimeSeconds,
        responseTime,
        withinSla,
        components: {
          database: dbHealth,
          sensorSystem: sensorHealth,
          messageQueue: messageQueueHealth,
          apiGateway: apiGatewayHealth
        },
        timestamp: new Date().toISOString()
      };

      // Log health check results
      this.logger.info('Health check completed', { 
        responseTime,
        withinSla,
        componentStatuses: healthStatus.components 
      });

      // Stop histogram timer
      histogramTimer();

      return res.status(200).json(healthStatus);

    } catch (error) {
      this.logger.error('Health check failed', error as Error);
      histogramTimer();
      return res.status(500).json({
        status: 'error',
        message: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Checks database health including connection pool and performance metrics
   */
  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    try {
      const startTime = Date.now();
      
      // Implement database health check logic here
      // This is a placeholder for the actual implementation
      const isHealthy = true;
      const latency = Date.now() - startTime;

      return {
        healthy: isHealthy,
        latency,
        lastChecked: new Date().toISOString(),
        details: {
          connectionPool: 'active',
          replicaStatus: 'synchronized'
        }
      };
    } catch (error) {
      this.logger.error('Database health check failed', error as Error);
      return {
        healthy: false,
        latency: 0,
        lastChecked: new Date().toISOString(),
        error: 'Database health check failed'
      };
    }
  }

  /**
   * Checks sensor system health and data processing pipeline
   */
  private async checkSensorSystemHealth(): Promise<ComponentHealth> {
    try {
      const startTime = Date.now();
      
      // Implement sensor system health check logic here
      // This is a placeholder for the actual implementation
      const isHealthy = true;
      const latency = Date.now() - startTime;

      return {
        healthy: isHealthy,
        latency,
        lastChecked: new Date().toISOString(),
        details: {
          activeSensors: 'operational',
          dataStream: 'active',
          processingPipeline: 'running'
        }
      };
    } catch (error) {
      this.logger.error('Sensor system health check failed', error as Error);
      return {
        healthy: false,
        latency: 0,
        lastChecked: new Date().toISOString(),
        error: 'Sensor system health check failed'
      };
    }
  }

  /**
   * Checks message queue health and performance
   */
  private async checkMessageQueueHealth(): Promise<ComponentHealth> {
    try {
      const startTime = Date.now();
      
      // Implement message queue health check logic here
      // This is a placeholder for the actual implementation
      const isHealthy = true;
      const latency = Date.now() - startTime;

      return {
        healthy: isHealthy,
        latency,
        lastChecked: new Date().toISOString(),
        details: {
          queueStatus: 'operational',
          messageBacklog: 0
        }
      };
    } catch (error) {
      this.logger.error('Message queue health check failed', error as Error);
      return {
        healthy: false,
        latency: 0,
        lastChecked: new Date().toISOString(),
        error: 'Message queue health check failed'
      };
    }
  }

  /**
   * Checks API gateway health and connectivity
   */
  private async checkApiGatewayHealth(): Promise<ComponentHealth> {
    try {
      const startTime = Date.now();
      
      // Implement API gateway health check logic here
      // This is a placeholder for the actual implementation
      const isHealthy = true;
      const latency = Date.now() - startTime;

      return {
        healthy: isHealthy,
        latency,
        lastChecked: new Date().toISOString(),
        details: {
          gatewayStatus: 'operational',
          activeConnections: 0
        }
      };
    } catch (error) {
      this.logger.error('API gateway health check failed', error as Error);
      return {
        healthy: false,
        latency: 0,
        lastChecked: new Date().toISOString(),
        error: 'API gateway health check failed'
      };
    }
  }
}

/**
 * Interface for component health check results
 */
interface ComponentHealth {
  healthy: boolean;
  latency: number;
  lastChecked: string;
  details?: Record<string, any>;
  error?: string;
}