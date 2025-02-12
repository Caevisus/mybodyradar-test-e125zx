/**
 * @fileoverview WebSocket handler for real-time sensor data streams with enhanced security,
 * monitoring, and error handling capabilities. Implements <100ms latency requirements.
 * 
 * @version 1.0.0
 */

import WebSocket from 'ws'; // v8.13.0
import { Subject, Observable } from 'rxjs'; // v7.8.0
import { injectable, inject } from 'inversify';
import { performance } from 'perf_hooks';

import { ISensorData } from '../../../interfaces/sensor.interface';
import { SensorStreamProcessor } from '../../../services/sensor/stream.processor';
import { SENSOR_STATUS_CODES } from '../../../constants/sensor.constants';

/**
 * Interface for connection metrics tracking
 */
interface ConnectionMetrics {
    connectionId: string;
    connectedAt: number;
    messageCount: number;
    averageLatency: number;
    lastMessageAt: number;
    errors: number;
    bufferSize: number;
}

/**
 * WebSocket handler for real-time sensor data streaming
 */
@injectable()
export class SensorWebSocketHandler {
    private readonly _connections: Map<string, WebSocket>;
    private readonly _metrics: Map<string, ConnectionMetrics>;
    private readonly _dataStream: Subject<ISensorData>;
    private readonly _maxBufferSize = 1024 * 1024; // 1MB
    private readonly _maxConnections = 1000;
    private readonly _heartbeatInterval = 30000; // 30 seconds
    private readonly _latencyThreshold = 100; // 100ms as per requirements

    /**
     * Initializes the WebSocket handler with required dependencies
     */
    constructor(
        @inject(SensorStreamProcessor) private readonly streamProcessor: SensorStreamProcessor
    ) {
        this._connections = new Map();
        this._metrics = new Map();
        this._dataStream = new Subject<ISensorData>();

        // Initialize monitoring
        setInterval(() => this.monitorConnections(), 5000);
    }

    /**
     * Handles new WebSocket connection requests with security validation
     */
    public async handleConnection(ws: WebSocket, request: any): Promise<void> {
        try {
            // Validate connection request
            if (!this.validateConnection(request)) {
                ws.close(1008, 'Invalid connection request');
                return;
            }

            // Check connection limits
            if (this._connections.size >= this._maxBufferSize) {
                ws.close(1013, 'Maximum connections reached');
                return;
            }

            // Generate unique connection ID
            const connectionId = this.generateConnectionId();
            
            // Initialize connection metrics
            this.initializeMetrics(connectionId);

            // Set up connection handlers
            this.setupConnectionHandlers(ws, connectionId);

            // Store connection
            this._connections.set(connectionId, ws);

            // Start heartbeat
            this.startHeartbeat(ws, connectionId);

        } catch (error) {
            console.error('Connection handling error:', error);
            ws.close(1011, 'Internal server error');
        }
    }

    /**
     * Handles incoming WebSocket messages with validation and monitoring
     */
    private async handleMessage(ws: WebSocket, data: Buffer, connectionId: string): Promise<void> {
        const startTime = performance.now();

        try {
            // Validate message size
            if (data.length > this._maxBufferSize) {
                throw new Error('Message size exceeds limit');
            }

            // Parse and validate message
            const sensorData = this.parseSensorData(data);

            // Process data through stream processor
            await this.streamProcessor.processStream(sensorData);

            // Update metrics
            this.updateMetrics(connectionId, startTime);

            // Send acknowledgment
            this.sendAcknowledgment(ws, sensorData.timestamp);

        } catch (error) {
            this.handleMessageError(ws, error, connectionId);
        }
    }

    /**
     * Validates incoming connection requests
     */
    private validateConnection(request: any): boolean {
        try {
            // Validate authentication token
            const token = request.headers['sec-websocket-protocol'];
            if (!token || !this.validateAuthToken(token)) {
                return false;
            }

            // Validate origin
            const origin = request.headers.origin;
            if (!this.validateOrigin(origin)) {
                return false;
            }

            // Validate rate limits
            if (!this.checkRateLimits(request.socket.remoteAddress)) {
                return false;
            }

            return true;
        } catch (error) {
            console.error('Connection validation error:', error);
            return false;
        }
    }

    /**
     * Sets up WebSocket connection handlers
     */
    private setupConnectionHandlers(ws: WebSocket, connectionId: string): void {
        ws.on('message', async (data: Buffer) => {
            await this.handleMessage(ws, data, connectionId);
        });

        ws.on('close', () => {
            this.handleDisconnection(connectionId);
        });

        ws.on('error', (error: Error) => {
            this.handleConnectionError(ws, error, connectionId);
        });

        ws.on('pong', () => {
            this.updateHeartbeat(connectionId);
        });
    }

    /**
     * Starts heartbeat monitoring for connection
     */
    private startHeartbeat(ws: WebSocket, connectionId: string): void {
        const interval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
            } else {
                clearInterval(interval);
                this.handleDisconnection(connectionId);
            }
        }, this._heartbeatInterval);
    }

    /**
     * Updates connection metrics
     */
    private updateMetrics(connectionId: string, startTime: number): void {
        const metrics = this._metrics.get(connectionId);
        if (metrics) {
            const latency = performance.now() - startTime;
            metrics.messageCount++;
            metrics.averageLatency = (metrics.averageLatency * (metrics.messageCount - 1) + latency) / metrics.messageCount;
            metrics.lastMessageAt = Date.now();

            // Check latency threshold
            if (latency > this._latencyThreshold) {
                console.warn(`High latency detected for connection ${connectionId}: ${latency}ms`);
            }
        }
    }

    /**
     * Handles connection errors with monitoring
     */
    private handleConnectionError(ws: WebSocket, error: Error, connectionId: string): void {
        console.error(`Connection error for ${connectionId}:`, error);
        
        const metrics = this._metrics.get(connectionId);
        if (metrics) {
            metrics.errors++;
        }

        // Close connection if error threshold exceeded
        if (metrics && metrics.errors > 5) {
            ws.close(1011, 'Too many errors');
            this.handleDisconnection(connectionId);
        }
    }

    /**
     * Handles clean disconnection
     */
    private handleDisconnection(connectionId: string): void {
        this._connections.delete(connectionId);
        this._metrics.delete(connectionId);
    }

    /**
     * Monitors active connections for health and performance
     */
    private monitorConnections(): void {
        const now = Date.now();
        
        for (const [connectionId, metrics] of this._metrics) {
            // Check for stale connections
            if (now - metrics.lastMessageAt > this._heartbeatInterval * 2) {
                const ws = this._connections.get(connectionId);
                if (ws) {
                    ws.close(1001, 'Connection timeout');
                }
                this.handleDisconnection(connectionId);
            }

            // Log performance metrics
            if (metrics.averageLatency > this._latencyThreshold) {
                console.warn(`High average latency for connection ${connectionId}: ${metrics.averageLatency}ms`);
            }
        }
    }

    /**
     * Initializes metrics for new connection
     */
    private initializeMetrics(connectionId: string): void {
        this._metrics.set(connectionId, {
            connectionId,
            connectedAt: Date.now(),
            messageCount: 0,
            averageLatency: 0,
            lastMessageAt: Date.now(),
            errors: 0,
            bufferSize: 0
        });
    }

    /**
     * Generates unique connection ID
     */
    private generateConnectionId(): string {
        return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Validates authentication token
     */
    private validateAuthToken(token: string): boolean {
        // Implement token validation logic
        return true; // Placeholder
    }

    /**
     * Validates connection origin
     */
    private validateOrigin(origin: string): boolean {
        // Implement origin validation logic
        return true; // Placeholder
    }

    /**
     * Checks rate limits for IP address
     */
    private checkRateLimits(ip: string): boolean {
        // Implement rate limiting logic
        return true; // Placeholder
    }

    /**
     * Parses and validates sensor data
     */
    private parseSensorData(data: Buffer): ISensorData {
        try {
            const parsed = JSON.parse(data.toString());
            if (!this.validateSensorData(parsed)) {
                throw new Error('Invalid sensor data format');
            }
            return parsed;
        } catch (error) {
            throw new Error(`Data parsing error: ${error.message}`);
        }
    }

    /**
     * Validates sensor data structure
     */
    private validateSensorData(data: any): data is ISensorData {
        return (
            data &&
            typeof data.sensorId === 'string' &&
            typeof data.timestamp === 'number' &&
            Array.isArray(data.readings)
        );
    }

    /**
     * Sends acknowledgment for received data
     */
    private sendAcknowledgment(ws: WebSocket, timestamp: number): void {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'ack',
                timestamp,
                status: SENSOR_STATUS_CODES.DATA_ACQUISITION_SUCCESS
            }));
        }
    }

    /**
     * Updates heartbeat timestamp
     */
    private updateHeartbeat(connectionId: string): void {
        const metrics = this._metrics.get(connectionId);
        if (metrics) {
            metrics.lastMessageAt = Date.now();
        }
    }

    /**
     * Handles message processing errors
     */
    private handleMessageError(ws: WebSocket, error: Error, connectionId: string): void {
        console.error(`Message handling error for ${connectionId}:`, error);
        
        const metrics = this._metrics.get(connectionId);
        if (metrics) {
            metrics.errors++;
        }

        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Message processing failed',
                code: SENSOR_STATUS_CODES.DATA_ACQUISITION_FAILURE
            }));
        }
    }
}