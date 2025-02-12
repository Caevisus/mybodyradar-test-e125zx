/**
 * @fileoverview High-performance sensor data stream processor implementing real-time 
 * processing with Kafka and RxJS for backpressure handling and comprehensive monitoring.
 * 
 * @version 1.0.0
 */

import { injectable } from 'inversify';
import { Kafka, Producer, Consumer, CompressionTypes, logLevel } from 'kafkajs'; // v2.2.4
import { Subject, Observable, from, throwError } from 'rxjs'; // v7.8.0
import { catchError, map, bufferTime, retryWhen, delay, take } from 'rxjs/operators';

import { ISensorData } from '../../interfaces/sensor.interface';
import { SENSOR_TYPES } from '../../constants/sensor.constants';
import { SensorDataProcessor } from './data.processor';

/**
 * Interface for stream processing metrics
 */
interface StreamMetrics {
    processedCount: number;
    averageLatency: number;
    errorCount: number;
    lastProcessedTimestamp: number;
    bufferUtilization: number;
    backpressureLevel: number;
}

/**
 * High-performance sensor stream processor with comprehensive monitoring
 */
@injectable()
export class SensorStreamProcessor {
    private readonly _producer: Producer;
    private readonly _consumer: Consumer;
    private readonly _streamSubject: Subject<ISensorData>;
    private readonly _metrics: Map<string, StreamMetrics>;
    private readonly _kafka: Kafka;
    private readonly _topicName = 'sensor-data-stream';
    private readonly _consumerGroup = 'sensor-processor-group';
    private readonly _batchSize = 100;
    private readonly _compressionThreshold = 1024; // 1KB

    /**
     * Initializes the stream processor with optimized configuration
     */
    constructor(
        private readonly dataProcessor: SensorDataProcessor
    ) {
        // Initialize Kafka with optimized configuration
        this._kafka = new Kafka({
            clientId: 'sensor-stream-processor',
            brokers: ['localhost:9092'],
            logLevel: logLevel.ERROR,
            retry: {
                initialRetryTime: 100,
                retries: 3
            }
        });

        // Configure producer with compression and batching
        this._producer = this._kafka.producer({
            allowAutoTopicCreation: false,
            transactionTimeout: 30000,
            maxInFlightRequests: 5,
            idempotent: true
        });

        // Configure consumer with optimized fetch settings
        this._consumer = this._kafka.consumer({
            groupId: this._consumerGroup,
            maxBytes: 5242880, // 5MB
            maxWaitTimeInMs: 100,
            sessionTimeout: 30000
        });

        this._streamSubject = new Subject<ISensorData>();
        this._metrics = new Map<string, StreamMetrics>();

        // Initialize processing pipeline
        this.initializeProcessingPipeline();
    }

    /**
     * Starts the stream processing pipeline with monitoring
     */
    public async startProcessing(): Promise<void> {
        try {
            // Connect to Kafka
            await this._producer.connect();
            await this._consumer.connect();

            // Subscribe to topic
            await this._consumer.subscribe({
                topic: this._topicName,
                fromBeginning: false
            });

            // Start consuming with backpressure handling
            await this._consumer.run({
                autoCommit: true,
                autoCommitInterval: 5000,
                autoCommitThreshold: 100,
                eachBatchAutoResolve: true,
                partitionsConsumedConcurrently: 3,
                eachBatch: async ({ batch, resolveOffset, heartbeat }) => {
                    const startTime = performance.now();

                    try {
                        // Process messages in batch
                        for (const message of batch.messages) {
                            const sensorData = JSON.parse(message.value.toString());
                            await this.processStream(sensorData);
                            await resolveOffset(message.offset);
                            await heartbeat();
                        }

                        // Update metrics
                        this.updateBatchMetrics(batch.messages.length, startTime);
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
     * Processes incoming sensor data stream with validation and monitoring
     */
    public async processStream(data: ISensorData): Promise<void> {
        const startTime = performance.now();

        try {
            // Validate data structure
            this.validateSensorData(data);

            // Process data through optimized pipeline
            const processedData = await this.dataProcessor.processData(data);

            // Apply compression if needed
            const compressedData = this.shouldCompress(processedData) 
                ? await this.compressData(processedData)
                : processedData;

            // Publish processed data
            await this._producer.send({
                topic: this._topicName,
                compression: CompressionTypes.GZIP,
                messages: [{
                    key: data.sensorId,
                    value: JSON.stringify(compressedData),
                    timestamp: Date.now().toString()
                }]
            });

            // Update processing metrics
            this.updateMetrics(data.sensorId, startTime);

        } catch (error) {
            await this.handleError(error);
            throw error;
        }
    }

    /**
     * Enhanced error handling with monitoring and recovery
     */
    private async handleError(error: Error): Promise<void> {
        console.error('Stream processing error:', error);

        try {
            // Update error metrics
            this.updateErrorMetrics(error);

            // Attempt recovery based on error type
            if (this.isConnectionError(error)) {
                await this.reconnectKafka();
            } else if (this.isProcessingError(error)) {
                await this.resetProcessingPipeline();
            }

            // Log error for monitoring
            console.error('Error details:', {
                type: error.name,
                message: error.message,
                timestamp: new Date().toISOString()
            });
        } catch (recoveryError) {
            console.error('Error recovery failed:', recoveryError);
            throw recoveryError;
        }
    }

    /**
     * Initializes the processing pipeline with RxJS
     */
    private initializeProcessingPipeline(): void {
        this._streamSubject.pipe(
            bufferTime(100), // Buffer for 100ms as per latency requirements
            map(async (batch) => {
                return await Promise.all(
                    batch.map(data => this.processStream(data))
                );
            }),
            catchError(error => {
                this.handleError(error);
                return throwError(() => error);
            }),
            retryWhen(errors =>
                errors.pipe(
                    delay(1000),
                    take(3)
                )
            )
        ).subscribe();
    }

    /**
     * Validates sensor data structure
     */
    private validateSensorData(data: ISensorData): void {
        if (!data.sensorId || !Array.isArray(data.readings)) {
            throw new Error('Invalid sensor data structure');
        }

        if (!data.readings.every(reading => 
            reading.type in SENSOR_TYPES && 
            Array.isArray(reading.value)
        )) {
            throw new Error('Invalid sensor readings format');
        }
    }

    /**
     * Updates processing metrics
     */
    private updateMetrics(sensorId: string, startTime: number): void {
        const latency = performance.now() - startTime;
        const metrics = this._metrics.get(sensorId) || {
            processedCount: 0,
            averageLatency: 0,
            errorCount: 0,
            lastProcessedTimestamp: 0,
            bufferUtilization: 0,
            backpressureLevel: 0
        };

        metrics.processedCount++;
        metrics.averageLatency = (metrics.averageLatency * (metrics.processedCount - 1) + latency) / metrics.processedCount;
        metrics.lastProcessedTimestamp = Date.now();

        this._metrics.set(sensorId, metrics);
    }

    /**
     * Updates batch processing metrics
     */
    private updateBatchMetrics(batchSize: number, startTime: number): void {
        const latency = performance.now() - startTime;
        console.info('Batch processing metrics:', {
            batchSize,
            processingTime: latency,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Checks if data should be compressed
     */
    private shouldCompress(data: any): boolean {
        return JSON.stringify(data).length > this._compressionThreshold;
    }

    /**
     * Compresses data using GZIP
     */
    private async compressData(data: any): Promise<any> {
        // Implement compression logic here
        return data;
    }

    /**
     * Checks if error is connection-related
     */
    private isConnectionError(error: Error): boolean {
        return error.message.includes('connection') || 
               error.message.includes('network') ||
               error.message.includes('timeout');
    }

    /**
     * Checks if error is processing-related
     */
    private isProcessingError(error: Error): boolean {
        return error.message.includes('processing') || 
               error.message.includes('validation');
    }

    /**
     * Attempts to reconnect to Kafka
     */
    private async reconnectKafka(): Promise<void> {
        await this._producer.disconnect();
        await this._consumer.disconnect();
        await this.startProcessing();
    }

    /**
     * Resets the processing pipeline
     */
    private async resetProcessingPipeline(): Promise<void> {
        this._streamSubject.complete();
        this.initializeProcessingPipeline();
    }
}