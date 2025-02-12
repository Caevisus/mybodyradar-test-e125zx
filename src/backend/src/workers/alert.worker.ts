/**
 * @fileoverview High-performance background worker for real-time alert processing and distribution
 * Implements parallel processing, caching optimization, and monitoring to achieve <100ms latency
 * and >85% injury prediction accuracy as specified in technical requirements.
 * @version 1.0.0
 */

import { KafkaConsumer } from 'kafkajs'; // ^2.2.4
import Redis from 'ioredis'; // ^5.3.2
import CircuitBreaker from 'opossum'; // ^7.1.0

import { AlertService } from '../services/alert/alert.service';
import { AnomalyDetector } from '../services/alert/processors/anomaly.detector';
import { ThresholdAnalyzer } from '../services/alert/processors/threshold.analyzer';
import { Logger } from '../utils/logger.util';
import { ISensorData } from '../interfaces/sensor.interface';
import { IAlert } from '../interfaces/alert.interface';
import { ALERT_BATCH_SIZE, ALERT_REFRESH_INTERVAL } from '../constants/alert.constants';
import { SYSTEM_TIMEOUTS, PERFORMANCE_THRESHOLDS } from '../constants/system.constants';

/**
 * Configuration interface for the alert worker
 */
interface WorkerConfig {
  kafkaConfig: {
    brokers: string[];
    groupId: string;
    clientId: string;
  };
  redisConfig: {
    nodes: { host: string; port: number }[];
    password: string;
  };
  batchSize: number;
  processingTimeout: number;
}

/**
 * High-performance background worker implementing parallel processing and optimization
 * for real-time alert generation with <100ms latency requirement
 */
export class AlertWorker {
  private readonly kafkaConsumer: KafkaConsumer;
  private readonly redisClient: Redis.Cluster;
  private readonly alertService: AlertService;
  private readonly anomalyDetector: AnomalyDetector;
  private readonly thresholdAnalyzer: ThresholdAnalyzer;
  private readonly logger: Logger;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly processingMetrics: Map<string, any>;
  private readonly batchSize: number;
  private readonly processingTimeout: number;
  private isRunning: boolean;

  constructor(
    alertService: AlertService,
    anomalyDetector: AnomalyDetector,
    thresholdAnalyzer: ThresholdAnalyzer,
    config: WorkerConfig
  ) {
    this.alertService = alertService;
    this.anomalyDetector = anomalyDetector;
    this.thresholdAnalyzer = thresholdAnalyzer;
    this.batchSize = config.batchSize || ALERT_BATCH_SIZE;
    this.processingTimeout = config.processingTimeout || SYSTEM_TIMEOUTS.KAFKA_CONSUMER_MS;
    this.isRunning = false;

    // Initialize enhanced logging
    this.logger = new Logger('AlertWorker', {
      performanceTracking: true,
      sampling: true
    });

    // Initialize Redis cluster with failover
    this.redisClient = new Redis.Cluster(config.redisConfig.nodes, {
      redisOptions: {
        password: config.redisConfig.password,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3
      },
      clusterRetryStrategy: (times: number) => Math.min(times * 50, 2000)
    });

    // Initialize Kafka consumer with parallel processing
    this.kafkaConsumer = new KafkaConsumer({
      ...config.kafkaConfig,
      maxInFlightRequests: 10,
      sessionTimeout: this.processingTimeout
    });

    // Configure circuit breaker for fault tolerance
    this.circuitBreaker = new CircuitBreaker(this.processSensorData.bind(this), {
      timeout: PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS,
      errorThresholdPercentage: 50,
      resetTimeout: 10000
    });

    // Initialize processing metrics
    this.processingMetrics = new Map();
  }

  /**
   * Starts the alert worker with enhanced monitoring and fault tolerance
   */
  public async start(): Promise<void> {
    try {
      this.isRunning = true;
      await this.kafkaConsumer.connect();
      
      // Subscribe to sensor data topics
      await this.kafkaConsumer.subscribe({
        topics: ['sensor.data', 'sensor.anomalies'],
        fromBeginning: false
      });

      // Start parallel processing with batching
      await this.kafkaConsumer.run({
        partitionsConsumedConcurrently: 3,
        eachBatchAutoResolve: true,
        eachBatch: async ({ batch, resolveOffset, heartbeat }) => {
          const startTime = Date.now();
          const messages = batch.messages;

          try {
            // Process messages in optimized batches
            for (let i = 0; i < messages.length; i += this.batchSize) {
              const messageBatch = messages.slice(i, i + this.batchSize);
              const sensorDataBatch = messageBatch.map(msg => JSON.parse(msg.value.toString()));

              // Process batch through circuit breaker
              await this.circuitBreaker.fire(sensorDataBatch);

              // Update offsets and send heartbeat
              await resolveOffset(messageBatch[messageBatch.length - 1].offset);
              await heartbeat();
            }

            // Track processing metrics
            const processingTime = Date.now() - startTime;
            this.logger.performance('batch_processing_time', processingTime, {
              batchSize: messages.length,
              topic: batch.topic
            });

          } catch (error) {
            this.logger.error('Error processing message batch', error as Error);
            throw error;
          }
        }
      });

      this.logger.info('Alert worker started successfully');
    } catch (error) {
      this.logger.error('Failed to start alert worker', error as Error);
      throw error;
    }
  }

  /**
   * Processes sensor data streams with optimization and monitoring
   */
  private async processSensorData(sensorDataBatch: ISensorData[]): Promise<void> {
    const startTime = Date.now();
    const alerts: IAlert[] = [];

    try {
      // Process data in parallel
      const processingPromises = sensorDataBatch.map(async (sensorData) => {
        // Parallel anomaly and threshold analysis
        const [anomalyAlerts, thresholdAlerts] = await Promise.all([
          this.anomalyDetector.detectAnomalies(sensorData),
          this.thresholdAnalyzer.analyzeBiomechanicalData(sensorData)
        ]);

        return [...anomalyAlerts, ...thresholdAlerts];
      });

      // Collect all alerts
      const alertArrays = await Promise.all(processingPromises);
      alertArrays.forEach(alertArray => alerts.push(...alertArray));

      // Distribute alerts through Redis
      if (alerts.length > 0) {
        await this.alertService.processIncomingData(alerts[0], alerts[0].sessionId);
      }

      // Track processing metrics
      const processingTime = Date.now() - startTime;
      this.logger.performance('alert_processing_latency', processingTime, {
        batchSize: sensorDataBatch.length,
        alertsGenerated: alerts.length
      });

    } catch (error) {
      this.logger.error('Error processing sensor data batch', error as Error);
      throw error;
    }
  }

  /**
   * Gracefully stops the worker with cleanup
   */
  public async stop(): Promise<void> {
    try {
      this.isRunning = false;
      await this.kafkaConsumer.disconnect();
      await this.redisClient.quit();
      this.logger.info('Alert worker stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping alert worker', error as Error);
      throw error;
    }
  }

  /**
   * Retrieves current processing metrics
   */
  public getMetrics(): Map<string, any> {
    return this.processingMetrics;
  }
}