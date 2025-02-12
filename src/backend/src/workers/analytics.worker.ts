/**
 * @fileoverview Analytics worker for real-time sensor data processing and analysis
 * Implements <100ms latency requirement through optimized batch processing and parallel execution
 * @version 1.0.0
 */

import { Kafka, Consumer, Producer } from 'kafkajs'; // v2.2.4
import Bull from 'bull'; // v4.10.4
import { BiomechanicsAnalyzer } from '../services/analytics/biomechanics.analyzer';
import { HeatMapGenerator } from '../services/analytics/heatmap.generator';
import { PerformanceAnalyzer } from '../services/analytics/performance.analyzer';
import { kafkaConfig } from '../config/kafka.config';
import { validateSensorData } from '../utils/validation.util';
import { ISensorData } from '../interfaces/sensor.interface';
import { ISessionMetrics } from '../interfaces/session.interface';
import { PERFORMANCE_THRESHOLDS } from '../constants/system.constants';

/**
 * Analytics worker class for real-time sensor data processing
 */
export class AnalyticsWorker {
    private kafkaConsumer: Consumer;
    private kafkaProducer: Producer;
    private biomechanicsAnalyzer: BiomechanicsAnalyzer;
    private heatMapGenerator: HeatMapGenerator;
    private performanceAnalyzer: PerformanceAnalyzer;
    private analyticsQueue: Bull.Queue;
    private metricsCollector: any;
    private dataCache: Map<string, any>;
    private isRunning: boolean;
    private processingLatencies: number[];

    /**
     * Initializes the analytics worker with required services
     */
    constructor(
        biomechanicsAnalyzer: BiomechanicsAnalyzer,
        heatMapGenerator: HeatMapGenerator,
        performanceAnalyzer: PerformanceAnalyzer
    ) {
        const kafka = new Kafka(kafkaConfig);

        this.kafkaConsumer = kafka.consumer({
            ...kafkaConfig.consumerConfig,
            maxWaitTimeInMs: PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS
        });

        this.kafkaProducer = kafka.producer(kafkaConfig.producerConfig);

        this.biomechanicsAnalyzer = biomechanicsAnalyzer;
        this.heatMapGenerator = heatMapGenerator;
        this.performanceAnalyzer = performanceAnalyzer;

        this.analyticsQueue = new Bull('analytics-processing', {
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000
                },
                timeout: PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS
            }
        });

        this.dataCache = new Map();
        this.processingLatencies = [];
        this.isRunning = false;
    }

    /**
     * Starts the analytics worker with enhanced monitoring
     */
    public async start(): Promise<void> {
        try {
            await this.kafkaConsumer.connect();
            await this.kafkaProducer.connect();

            await this.kafkaConsumer.subscribe({
                topic: kafkaConfig.topics.SENSOR_DATA,
                fromBeginning: false
            });

            this.isRunning = true;

            await this.kafkaConsumer.run({
                partitionsConsumedConcurrently: 3,
                eachBatchAutoResolve: true,
                eachBatch: async ({ batch, resolveOffset, heartbeat }) => {
                    const startTime = Date.now();

                    try {
                        const messages = batch.messages.map(m => JSON.parse(m.value.toString()));
                        
                        // Process messages in parallel with batching
                        const processingPromises = messages.map(async message => {
                            try {
                                await this.processSensorData(message);
                                resolveOffset(message.offset);
                                await heartbeat();
                            } catch (error) {
                                await this.handleError(error);
                            }
                        });

                        await Promise.all(processingPromises);

                        // Track processing latency
                        const latency = Date.now() - startTime;
                        this.processingLatencies.push(latency);

                        // Maintain latency history
                        if (this.processingLatencies.length > 1000) {
                            this.processingLatencies.shift();
                        }

                        // Monitor performance
                        if (latency > PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS) {
                            console.warn(`Processing latency exceeded threshold: ${latency}ms`);
                        }
                    } catch (error) {
                        await this.handleError(error);
                    }
                }
            });

        } catch (error) {
            await this.handleError(error);
            throw error;
        }
    }

    /**
     * Stops the analytics worker gracefully
     */
    public async stop(): Promise<void> {
        try {
            this.isRunning = false;
            await this.kafkaConsumer.disconnect();
            await this.kafkaProducer.disconnect();
            await this.analyticsQueue.close();
            this.dataCache.clear();
        } catch (error) {
            await this.handleError(error);
            throw error;
        }
    }

    /**
     * Processes incoming sensor data with enhanced error handling
     */
    private async processSensorData(message: ISensorData): Promise<void> {
        const startTime = Date.now();

        try {
            // Validate incoming data
            await validateSensorData(message);

            // Check cache for recent similar data
            const cacheKey = `${message.sensorId}_${message.sessionId}`;
            const cachedData = this.dataCache.get(cacheKey);

            if (cachedData && Date.now() - cachedData.timestamp < 1000) {
                return; // Skip duplicate processing within 1 second
            }

            // Process data in parallel
            const [biomechanicsResults, performanceMetrics] = await Promise.all([
                this.biomechanicsAnalyzer.analyzeMuscleActivity(message.readings),
                this.performanceAnalyzer.analyzeSensorData(message)
            ]);

            // Generate heat map
            await this.heatMapGenerator.updateRealTimeHeatMap(message, {
                transitionDuration: 100,
                preserveScale: true,
                updateInterval: 100
            });

            // Publish results
            await this.kafkaProducer.send({
                topic: kafkaConfig.topics.ANALYTICS,
                messages: [{
                    key: message.sessionId,
                    value: JSON.stringify({
                        biomechanics: biomechanicsResults,
                        performance: performanceMetrics,
                        timestamp: Date.now()
                    })
                }]
            });

            // Update cache
            this.dataCache.set(cacheKey, {
                timestamp: Date.now(),
                data: message
            });

            // Clean old cache entries
            if (this.dataCache.size > 10000) {
                const oldestKey = Array.from(this.dataCache.keys())[0];
                this.dataCache.delete(oldestKey);
            }

        } catch (error) {
            await this.handleError(error);
        }

        // Track processing time
        const processingTime = Date.now() - startTime;
        if (processingTime > PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS) {
            console.warn(`Processing time exceeded threshold: ${processingTime}ms`);
        }
    }

    /**
     * Enhanced error handling with retry mechanisms
     */
    private async handleError(error: Error): Promise<void> {
        console.error('Analytics worker error:', error);

        try {
            await this.kafkaProducer.send({
                topic: kafkaConfig.topics.ALERTS,
                messages: [{
                    key: 'analytics_error',
                    value: JSON.stringify({
                        error: error.message,
                        timestamp: Date.now(),
                        type: 'SYSTEM',
                        severity: 'HIGH'
                    })
                }]
            });
        } catch (producerError) {
            console.error('Error publishing error alert:', producerError);
        }
    }

    /**
     * Returns current worker health metrics
     */
    public getHealthMetrics(): object {
        const avgLatency = this.processingLatencies.length > 0
            ? this.processingLatencies.reduce((a, b) => a + b) / this.processingLatencies.length
            : 0;

        return {
            isRunning: this.isRunning,
            averageLatency: avgLatency,
            cacheSize: this.dataCache.size,
            queueSize: this.analyticsQueue.count(),
            latencyThresholdExceeded: avgLatency > PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS
        };
    }
}