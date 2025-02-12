/**
 * @fileoverview Core service for processing training session data streams with real-time analytics
 * and enhanced performance monitoring capabilities. Implements comprehensive biomechanical analysis
 * and parallel processing for optimal performance.
 * 
 * @version 1.0.0
 */

import { injectable } from 'inversify';
import { Subject, Observable, from, merge } from 'rxjs'; // v7.8.0
import { map, catchError, bufferTime, mergeMap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import now from 'performance-now'; // v2.1.0

import { ISession, ISessionConfig, ISessionMetrics } from '../../interfaces/session.interface';
import { ISensorData } from '../../interfaces/sensor.interface';
import { SensorDataProcessor } from '../sensor/data.processor';
import { BiomechanicsAnalyzer } from '../analytics/biomechanics.analyzer';

/**
 * Interface for session performance monitoring
 */
interface ISessionPerformance {
    processingLatency: number;
    dataQuality: number;
    bufferUtilization: number;
    errorRate: number;
    lastUpdate: Date;
}

/**
 * Core session processor service with enhanced real-time capabilities
 */
@injectable()
export class SessionProcessor {
    private readonly _dataStream: Subject<ISensorData>;
    private readonly _activeSessions: Map<string, ISession>;
    private readonly _performanceMetrics: Map<string, ISessionPerformance>;
    private readonly _processingBuffer: Map<string, ISensorData[]>;
    private readonly _bufferSize = 1024; // 1KB buffer as per specs

    /**
     * Initializes the session processor with required dependencies
     */
    constructor(
        private readonly sensorProcessor: SensorDataProcessor,
        private readonly biomechanicsAnalyzer: BiomechanicsAnalyzer
    ) {
        this._dataStream = new Subject<ISensorData>();
        this._activeSessions = new Map();
        this._performanceMetrics = new Map();
        this._processingBuffer = new Map();

        this.initializeProcessingPipeline();
    }

    /**
     * Starts a new training session with enhanced monitoring
     * @param athleteId - Unique identifier for the athlete
     * @param config - Session configuration parameters
     * @returns Promise resolving to created session
     */
    public async startSession(athleteId: string, config: ISessionConfig): Promise<ISession> {
        const startTime = now();

        try {
            const sessionId = uuidv4();
            const session: ISession = {
                id: sessionId,
                athleteId,
                startTime: new Date(),
                endTime: null,
                config,
                metrics: this.initializeSessionMetrics(),
                sensorData: [],
                status: {
                    current: 'active',
                    timestamp: new Date(),
                    history: [{
                        status: 'initialized',
                        timestamp: new Date()
                    }]
                }
            };

            // Initialize performance monitoring
            this._performanceMetrics.set(sessionId, {
                processingLatency: 0,
                dataQuality: 100,
                bufferUtilization: 0,
                errorRate: 0,
                lastUpdate: new Date()
            });

            this._activeSessions.set(sessionId, session);
            this._processingBuffer.set(sessionId, []);

            return session;

        } catch (error) {
            this.handleSessionError(error, 'Session initialization failed');
            throw error;
        }
    }

    /**
     * Processes incoming sensor data for active session
     * @param sessionId - Session identifier
     * @param sensorData - Incoming sensor data
     */
    public async processSessionData(sessionId: string, sensorData: ISensorData): Promise<void> {
        const startTime = now();

        try {
            const session = this._activeSessions.get(sessionId);
            if (!session) {
                throw new Error(`Session ${sessionId} not found`);
            }

            // Update processing buffer
            const buffer = this._processingBuffer.get(sessionId) || [];
            buffer.push(sensorData);
            this._processingBuffer.set(sessionId, buffer);

            // Process data if buffer threshold reached
            if (buffer.length >= this._bufferSize) {
                await this.processBatch(sessionId);
            }

            // Update performance metrics
            this.updatePerformanceMetrics(sessionId, startTime);

        } catch (error) {
            this.handleSessionError(error, 'Data processing failed');
            throw error;
        }
    }

    /**
     * Ends an active training session
     * @param sessionId - Session identifier
     * @returns Promise resolving to completed session
     */
    public async endSession(sessionId: string): Promise<ISession> {
        try {
            const session = this._activeSessions.get(sessionId);
            if (!session) {
                throw new Error(`Session ${sessionId} not found`);
            }

            // Process any remaining data
            await this.processBatch(sessionId);

            // Update session status
            session.endTime = new Date();
            session.status.current = 'completed';
            session.status.history.push({
                status: 'completed',
                timestamp: new Date()
            });

            // Cleanup
            this._activeSessions.delete(sessionId);
            this._processingBuffer.delete(sessionId);
            this._performanceMetrics.delete(sessionId);

            return session;

        } catch (error) {
            this.handleSessionError(error, 'Session termination failed');
            throw error;
        }
    }

    /**
     * Retrieves current session metrics
     * @param sessionId - Session identifier
     * @returns Current session metrics
     */
    public getSessionMetrics(sessionId: string): ISessionMetrics {
        const session = this._activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        return session.metrics;
    }

    /**
     * Initializes the real-time processing pipeline
     */
    private initializeProcessingPipeline(): void {
        this._dataStream.pipe(
            bufferTime(100), // 100ms buffer as per latency requirements
            mergeMap(async data => {
                const processedData = await Promise.all(
                    data.map(item => this.sensorProcessor.processData(item))
                );
                return processedData;
            }),
            catchError(error => {
                this.handleSessionError(error, 'Pipeline processing failed');
                return from([]);
            })
        ).subscribe();
    }

    /**
     * Processes a batch of buffered sensor data
     * @param sessionId - Session identifier
     */
    private async processBatch(sessionId: string): Promise<void> {
        const buffer = this._processingBuffer.get(sessionId);
        if (!buffer || buffer.length === 0) return;

        try {
            // Process sensor data
            const processedData = await Promise.all(
                buffer.map(data => this.sensorProcessor.processData(data))
            );

            // Analyze biomechanics
            const biomechanicalAnalysis = await this.biomechanicsAnalyzer.analyzeMuscleActivity(buffer);

            // Update session metrics
            const session = this._activeSessions.get(sessionId);
            session.metrics = await this.updateSessionMetrics(session.metrics, processedData, biomechanicalAnalysis);

            // Clear buffer
            this._processingBuffer.set(sessionId, []);

        } catch (error) {
            this.handleSessionError(error, 'Batch processing failed');
            throw error;
        }
    }

    /**
     * Initializes session metrics structure
     */
    private initializeSessionMetrics(): ISessionMetrics {
        return {
            muscleActivity: {},
            forceDistribution: {},
            rangeOfMotion: {},
            anomalyScores: {},
            performanceIndicators: {}
        };
    }

    /**
     * Updates session performance metrics
     * @param sessionId - Session identifier
     * @param startTime - Processing start time
     */
    private updatePerformanceMetrics(sessionId: string, startTime: number): void {
        const metrics = this._performanceMetrics.get(sessionId);
        if (!metrics) return;

        const latency = now() - startTime;
        metrics.processingLatency = (metrics.processingLatency + latency) / 2;
        metrics.bufferUtilization = (this._processingBuffer.get(sessionId)?.length || 0) / this._bufferSize;
        metrics.lastUpdate = new Date();

        this._performanceMetrics.set(sessionId, metrics);
    }

    /**
     * Handles session-related errors
     * @param error - Error object
     * @param context - Error context
     */
    private handleSessionError(error: Error, context: string): void {
        console.error(`Session Error - ${context}:`, error);
        // Additional error handling logic would be implemented here
    }
}