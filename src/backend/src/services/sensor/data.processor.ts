/**
 * @fileoverview Advanced sensor data processing service implementing real-time stream processing,
 * signal filtering, and data optimization with comprehensive error handling and monitoring.
 * 
 * @version 1.0.0
 */

import { injectable } from 'inversify';
import { Subject, Observable, from, throwError } from 'rxjs'; // v7.8.0
import { catchError, map, bufferTime, retryWhen, delay, take } from 'rxjs/operators';

import { ISensorData, ISensorReading, ISensorMetadata } from '../../interfaces/sensor.interface';
import { SENSOR_TYPES, SAMPLING_RATES, CALIBRATION_PARAMS } from '../../constants/sensor.constants';
import { BiomechanicsAnalyzer } from '../analytics/biomechanics.analyzer';

/**
 * Interface for processing metrics tracking
 */
interface ProcessingMetrics {
    totalProcessed: number;
    averageLatency: number;
    errorRate: number;
    lastProcessed: Date;
    bufferUtilization: number;
}

/**
 * Interface for processed sensor data output
 */
interface ProcessedSensorData {
    sensorId: string;
    timestamp: number;
    processedReadings: Array<ProcessedReading>;
    quality: number;
    processingMetadata: ProcessingMetadata;
}

/**
 * Interface for processed individual readings
 */
interface ProcessedReading {
    type: SENSOR_TYPES;
    filteredValue: number[];
    confidence: number;
    timestamp: number;
}

/**
 * Interface for processing metadata
 */
interface ProcessingMetadata {
    processingLatency: number;
    filteringApplied: string[];
    qualityMetrics: {
        signalToNoise: number;
        dataCompleteness: number;
        outlierPercentage: number;
    };
}

/**
 * Advanced sensor data processing service with real-time stream processing capabilities
 */
@injectable()
export class SensorDataProcessor {
    private readonly _dataStream: Subject<ISensorData>;
    private readonly _bufferSize: number;
    private readonly _processingMetrics: Map<string, ProcessingMetrics>;
    private readonly _biomechanicsAnalyzer: BiomechanicsAnalyzer;
    private readonly _kalmanFilters: Map<string, any>;
    private readonly _medianBufferSize = 5;

    /**
     * Initializes the data processor with required dependencies
     */
    constructor(
        private readonly biomechanicsAnalyzer: BiomechanicsAnalyzer
    ) {
        this._dataStream = new Subject<ISensorData>();
        this._bufferSize = 1024; // 1KB buffer as per technical specs
        this._processingMetrics = new Map<string, ProcessingMetrics>();
        this._biomechanicsAnalyzer = biomechanicsAnalyzer;
        this._kalmanFilters = new Map();

        // Initialize processing pipeline
        this.initializeProcessingPipeline();
    }

    /**
     * Processes incoming sensor data with advanced filtering and optimization
     * @param rawData - Raw sensor data to process
     * @returns Promise resolving to processed sensor data
     */
    public async processData(rawData: ISensorData): Promise<ProcessedSensorData> {
        const startTime = performance.now();

        try {
            // Validate input data
            this.validateInputData(rawData);

            // Process each reading based on sensor type
            const processedReadings = await Promise.all(
                rawData.readings.map(async reading => this.processReading(reading))
            );

            // Calculate overall quality metrics
            const quality = this.calculateQualityScore(processedReadings);

            // Update processing metrics
            this.updateProcessingMetrics(rawData.sensorId, startTime);

            const processingMetadata: ProcessingMetadata = {
                processingLatency: performance.now() - startTime,
                filteringApplied: this.getAppliedFilters(rawData.sensorId),
                qualityMetrics: {
                    signalToNoise: this.calculateSignalToNoise(processedReadings),
                    dataCompleteness: this.calculateDataCompleteness(processedReadings),
                    outlierPercentage: this.calculateOutlierPercentage(processedReadings)
                }
            };

            return {
                sensorId: rawData.sensorId,
                timestamp: Date.now(),
                processedReadings,
                quality,
                processingMetadata
            };

        } catch (error) {
            this.handleProcessingError(error, rawData.sensorId);
            throw error;
        }
    }

    /**
     * Applies noise filtering based on sensor type and configuration
     * @param data - Raw sensor data array
     * @param sensorType - Type of sensor
     * @returns Filtered data array
     */
    public filterNoise(data: number[], sensorType: SENSOR_TYPES): number[] {
        try {
            switch (sensorType) {
                case SENSOR_TYPES.IMU:
                    return this.applyKalmanFilter(data, sensorType);
                case SENSOR_TYPES.TOF:
                    return this.applyMedianFilter(data);
                default:
                    throw new Error(`Unsupported sensor type: ${sensorType}`);
            }
        } catch (error) {
            this.handleFilteringError(error, sensorType);
            throw error;
        }
    }

    /**
     * Retrieves current processing metrics for monitoring
     * @param sensorId - Optional sensor ID to get specific metrics
     * @returns Processing metrics
     */
    public getProcessingMetrics(sensorId?: string): ProcessingMetrics | Map<string, ProcessingMetrics> {
        if (sensorId) {
            return this._processingMetrics.get(sensorId);
        }
        return this._processingMetrics;
    }

    /**
     * Initializes the real-time processing pipeline with RxJS
     */
    private initializeProcessingPipeline(): void {
        this._dataStream.pipe(
            bufferTime(100), // Buffer for 100ms as per latency requirements
            map(data => this.processBatch(data)),
            catchError(error => {
                this.handlePipelineError(error);
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
     * Processes a batch of sensor readings
     * @param readings - Array of sensor readings
     */
    private async processBatch(readings: ISensorData[]): Promise<void> {
        try {
            await Promise.all(
                readings.map(reading => this.processData(reading))
            );
        } catch (error) {
            this.handleBatchProcessingError(error);
        }
    }

    /**
     * Applies Kalman filtering to IMU data
     * @param data - Raw IMU data
     * @param sensorId - Sensor identifier
     * @returns Filtered data
     */
    private applyKalmanFilter(data: number[], sensorId: string): number[] {
        if (!this._kalmanFilters.has(sensorId)) {
            this._kalmanFilters.set(sensorId, this.initializeKalmanFilter());
        }

        const filter = this._kalmanFilters.get(sensorId);
        return data.map(value => filter.filter(value));
    }

    /**
     * Applies median filtering to ToF data
     * @param data - Raw ToF data
     * @returns Filtered data
     */
    private applyMedianFilter(data: number[]): number[] {
        const buffer = [...data];
        return buffer.map((_, index) => {
            const window = buffer.slice(
                Math.max(0, index - this._medianBufferSize),
                Math.min(buffer.length, index + this._medianBufferSize + 1)
            );
            return this.calculateMedian(window);
        });
    }

    /**
     * Calculates median value from array
     * @param values - Array of numbers
     * @returns Median value
     */
    private calculateMedian(values: number[]): number {
        const sorted = [...values].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[middle - 1] + sorted[middle]) / 2
            : sorted[middle];
    }

    /**
     * Validates input sensor data structure
     * @param data - Sensor data to validate
     */
    private validateInputData(data: ISensorData): void {
        if (!data.sensorId || !data.readings || !Array.isArray(data.readings)) {
            throw new Error('Invalid sensor data structure');
        }

        if (data.readings.some(reading => !this.isValidReading(reading))) {
            throw new Error('Invalid sensor reading format');
        }
    }

    /**
     * Validates individual sensor reading
     * @param reading - Sensor reading to validate
     * @returns Boolean indicating validity
     */
    private isValidReading(reading: ISensorReading): boolean {
        return (
            reading.type in SENSOR_TYPES &&
            Array.isArray(reading.value) &&
            typeof reading.timestamp === 'number' &&
            typeof reading.confidence === 'number'
        );
    }

    /**
     * Handles processing errors with logging and metrics update
     * @param error - Error object
     * @param sensorId - Sensor identifier
     */
    private handleProcessingError(error: Error, sensorId: string): void {
        console.error(`Processing error for sensor ${sensorId}:`, error);
        const metrics = this._processingMetrics.get(sensorId);
        if (metrics) {
            metrics.errorRate++;
        }
    }

    /**
     * Updates processing metrics for monitoring
     * @param sensorId - Sensor identifier
     * @param startTime - Processing start time
     */
    private updateProcessingMetrics(sensorId: string, startTime: number): void {
        const latency = performance.now() - startTime;
        const metrics = this._processingMetrics.get(sensorId) || {
            totalProcessed: 0,
            averageLatency: 0,
            errorRate: 0,
            lastProcessed: new Date(),
            bufferUtilization: 0
        };

        metrics.totalProcessed++;
        metrics.averageLatency = (metrics.averageLatency * (metrics.totalProcessed - 1) + latency) / metrics.totalProcessed;
        metrics.lastProcessed = new Date();

        this._processingMetrics.set(sensorId, metrics);
    }
}