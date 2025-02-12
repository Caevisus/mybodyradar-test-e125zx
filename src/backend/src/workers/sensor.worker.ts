/**
 * @fileoverview Worker process for handling sensor data processing tasks with real-time stream processing,
 * data compression, calibration management, and comprehensive error handling.
 * 
 * @version 1.0.0
 */

import { injectable } from 'inversify';
import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs'; // v2.2.4
import { Subject, Observable, from } from 'rxjs'; // v7.8.0
import { bufferTime, catchError, map, retryWhen, delay, take } from 'rxjs/operators';
import { Queue, Worker, QueueScheduler } from 'bullmq'; // v3.15.0
import { Registry, Counter, Histogram } from 'prom-client'; // v14.2.0

import { SensorDataProcessor } from '../services/sensor/data.processor';
import { ISensorData, ISensorReading } from '../interfaces/sensor.interface';
import { SENSOR_STATUS_CODES } from '../constants/sensor.constants';

/**
 * Background worker for processing sensor data streams with comprehensive error handling
 */
@injectable()
export class SensorWorker {
    private readonly _dataProcessor: SensorDataProcessor;
    private readonly _producer: Producer;
    private readonly _consumer: Consumer;
    private readonly _taskQueue: Queue;
    private readonly _dataSubject: Subject<ISensorData>;
    private readonly _metricsRegistry: Registry;
    private readonly _processedCounter: Counter;
    private readonly _processingLatency: Histogram;
    private readonly _errorCounter: Counter;
    private readonly _bufferUtilization: Histogram;

    /**
     * Initializes the sensor worker with required dependencies
     */
    constructor(
        dataProcessor: SensorDataProcessor,
        private readonly kafkaConfig: {
            clientId: string;
            brokers: string[];
            groupId: string;
        },
        private readonly redisConfig: {
            host: string;
            port: number;
            password: string;
        },
        private readonly metricsConfig: {
            prefix: string;
            labels: Record<string, string>;
        }
    ) {
        this._dataProcessor = dataProcessor;
        this._dataSubject = new Subject<ISensorData>();

        // Initialize Kafka client
        const kafka = new Kafka({
            clientId: this.kafkaConfig.clientId,
            brokers: this.kafkaConfig.brokers,
            retry: {
                initialRetryTime: 100,
                retries: 8
            }
        });

        this._producer = kafka.producer({
            allowAutoTopicCreation: false,
            transactionTimeout: 30000
        });

        this._consumer = kafka.consumer({
            groupId: this.kafkaConfig.groupId,
            maxBytes: 5242880, // 5MB
            sessionTimeout: 30000
        });

        // Initialize Redis-backed queue
        this._taskQueue = new Queue('sensor-processing', {
            connection: {
                host: this.redisConfig.host,
                port: this.redisConfig.port,
                password: this.redisConfig.password
            },
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000
                }
            }
        });

        // Initialize metrics
        this._metricsRegistry = new Registry();
        this._processedCounter = new Counter({
            name: `${metricsConfig.prefix}_processed_total`,
            help: 'Total number of processed sensor readings',
            labelNames: Object.keys(metricsConfig.labels),
            registers: [this._metricsRegistry]
        });

        this._processingLatency = new Histogram({
            name: `${metricsConfig.prefix}_processing_latency`,
            help: 'Sensor data processing latency in milliseconds',
            labelNames: Object.keys(metricsConfig.labels),
            buckets: [10, 50, 100, 200, 500, 1000],
            registers: [this._metricsRegistry]
        });

        this._errorCounter = new Counter({
            name: `${metricsConfig.prefix}_errors_total`,
            help: 'Total number of processing errors',
            labelNames: [...Object.keys(metricsConfig.labels), 'error_type'],
            registers: [this._metricsRegistry]
        });

        this._bufferUtilization = new Histogram({
            name: `${metricsConfig.prefix}_buffer_utilization`,
            help: 'Buffer utilization percentage',
            labelNames: Object.keys(metricsConfig.labels),
            buckets: [10, 25, 50, 75, 90, 100],
            registers: [this._metricsRegistry]
        });
    }

    /**
     * Starts the sensor worker process
     */
    public async start(): Promise<void> {
        try {
            // Connect to Kafka
            await this._producer.connect();
            await this._consumer.connect();

            // Subscribe to sensor data topic
            await this._consumer.subscribe({
                topic: 'sensor-data',
                fromBeginning: false
            });

            // Initialize processing pipeline
            this.initializeProcessingPipeline();

            // Start consuming messages
            await this._consumer.run({
                partitionsConsumedConcurrently: 3,
                eachMessage: async (payload: EachMessagePayload) => {
                    const startTime = Date.now();
                    try {
                        const sensorData = JSON.parse(payload.message.value.toString()) as ISensorData;
                        await this.processDataBatch([sensorData]);
                        
                        this._processingLatency.observe(
                            this.metricsConfig.labels,
                            Date.now() - startTime
                        );
                        this._processedCounter.inc(this.metricsConfig.labels);
                    } catch (error) {
                        this._errorCounter.inc({
                            ...this.metricsConfig.labels,
                            error_type: error.name
                        });
                        throw error;
                    }
                }
            });

        } catch (error) {
            this._errorCounter.inc({
                ...this.metricsConfig.labels,
                error_type: 'StartupError'
            });
            throw new Error(`Failed to start sensor worker: ${error.message}`);
        }
    }

    /**
     * Processes a batch of sensor data
     */
    private async processDataBatch(dataBatch: ISensorData[]): Promise<void> {
        const batchStartTime = Date.now();

        try {
            // Validate batch data
            this.validateBatch(dataBatch);

            // Process each reading
            const processedData = await Promise.all(
                dataBatch.map(async (data) => {
                    const processed = await this._dataProcessor.processData(data);
                    return processed;
                })
            );

            // Queue processed data for persistence
            await this._taskQueue.add('persist-data', {
                data: processedData,
                timestamp: Date.now()
            });

            // Publish processed data to Kafka
            await this._producer.send({
                topic: 'processed-sensor-data',
                messages: processedData.map(data => ({
                    key: data.sensorId,
                    value: JSON.stringify(data)
                }))
            });

            // Update metrics
            this._bufferUtilization.observe(
                this.metricsConfig.labels,
                (dataBatch.length / 1000) * 100 // Assuming max batch size of 1000
            );

        } catch (error) {
            this._errorCounter.inc({
                ...this.metricsConfig.labels,
                error_type: 'ProcessingError'
            });
            throw error;
        }
    }

    /**
     * Initializes the real-time processing pipeline
     */
    private initializeProcessingPipeline(): void {
        this._dataSubject.pipe(
            bufferTime(100), // Buffer for 100ms as per latency requirements
            map(async (batch) => {
                if (batch.length > 0) {
                    await this.processDataBatch(batch);
                }
            }),
            catchError((error) => {
                this._errorCounter.inc({
                    ...this.metricsConfig.labels,
                    error_type: 'PipelineError'
                });
                throw error;
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
     * Validates a batch of sensor data
     */
    private validateBatch(batch: ISensorData[]): void {
        if (!Array.isArray(batch) || batch.length === 0) {
            throw new Error('Invalid batch format');
        }

        batch.forEach(data => {
            if (!data.sensorId || !Array.isArray(data.readings)) {
                throw new Error('Invalid sensor data format');
            }
        });
    }

    /**
     * Performs graceful shutdown of the worker
     */
    public async shutdown(): Promise<void> {
        try {
            // Stop accepting new data
            this._dataSubject.complete();

            // Disconnect from Kafka
            await this._producer.disconnect();
            await this._consumer.disconnect();

            // Close queue connections
            await this._taskQueue.close();

            // Final metrics flush
            await this._metricsRegistry.clear();

        } catch (error) {
            this._errorCounter.inc({
                ...this.metricsConfig.labels,
                error_type: 'ShutdownError'
            });
            throw error;
        }
    }
}