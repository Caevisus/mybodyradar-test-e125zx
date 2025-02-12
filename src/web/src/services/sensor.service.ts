/**
 * @fileoverview Service class for managing sensor operations, data processing, and real-time monitoring
 * Implements high-performance sensor data handling with sub-100ms latency requirements
 * @version 1.0.0
 */

import { injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { bufferTime, filter, map } from 'rxjs/operators';
import { ISensorConfig, ISensorData } from '../interfaces/sensor.interface';
import { WebSocketService } from './websocket.service';
import { SAMPLING_RATES, SENSOR_TYPES, DATA_BUFFER_SIZE } from '../constants/sensor.constants';

/**
 * Performance metrics interface for monitoring service operations
 */
interface PerformanceMetrics {
  processingLatency: number;
  bufferSize: number;
  memoryUsage: number;
  messageRate: number;
  timestamp: number;
}

@injectable()
export class SensorService {
  private sensorDataSubject = new BehaviorSubject<ISensorData[]>([]);
  private sensorConfigs = new Map<string, ISensorConfig>();
  private processingLatency = 0;
  private processingWorkers = new Map<string, Worker>();
  private performanceMetrics = new BehaviorSubject<PerformanceMetrics>({
    processingLatency: 0,
    bufferSize: 0,
    memoryUsage: 0,
    messageRate: 0,
    timestamp: Date.now()
  });

  constructor(private webSocketService: WebSocketService) {
    this.initializePerformanceMonitoring();
  }

  /**
   * Initializes a new sensor with performance optimizations
   * @param config Sensor configuration parameters
   * @returns Promise resolving to initialization success status
   */
  public async initializeSensor(config: ISensorConfig): Promise<boolean> {
    try {
      // Validate sensor configuration
      this.validateSensorConfig(config);

      // Initialize dedicated Web Worker for sensor processing
      const worker = new Worker(
        new URL('../workers/sensor.worker', import.meta.url),
        { type: 'module' }
      );

      this.processingWorkers.set(config.id, worker);
      this.sensorConfigs.set(config.id, config);

      // Setup WebSocket subscription with automatic reconnection
      const unsubscribe = this.webSocketService.subscribeSensorData(
        config.id,
        (data: ISensorData) => this.processSensorData(data),
        {
          buffer: true,
          priority: 'high'
        }
      );

      // Initialize performance monitoring for the sensor
      worker.onmessage = (event) => {
        const processedData = event.data;
        this.updateSensorData(processedData);
        this.updateProcessingLatency(processedData.timestamp);
      };

      return true;
    } catch (error) {
      console.error('Sensor initialization failed:', error);
      return false;
    }
  }

  /**
   * Processes incoming sensor data with latency optimization
   * @param data Raw sensor data
   */
  private processSensorData(data: ISensorData): void {
    const startTime = performance.now();
    
    try {
      const config = this.sensorConfigs.get(data.sensorId);
      if (!config) return;

      // Apply Kalman filtering based on sensor type
      const worker = this.processingWorkers.get(data.sensorId);
      worker?.postMessage({
        type: 'process',
        data,
        config: {
          samplingRate: config.samplingRate,
          calibrationParams: config.calibrationParams
        }
      });

      // Update performance metrics
      this.processingLatency = performance.now() - startTime;
      this.updatePerformanceMetrics();
    } catch (error) {
      console.error('Error processing sensor data:', error);
    }
  }

  /**
   * Monitors and reports service performance metrics
   * @returns Observable stream of performance metrics
   */
  public monitorPerformance() {
    return this.performanceMetrics.asObservable().pipe(
      bufferTime(100), // Buffer metrics for 100ms intervals
      filter(metrics => metrics.length > 0),
      map(metrics => ({
        averageLatency: metrics.reduce((acc, m) => acc + m.processingLatency, 0) / metrics.length,
        maxLatency: Math.max(...metrics.map(m => m.processingLatency)),
        messageRate: metrics.length * 10, // Convert to messages per second
        timestamp: Date.now()
      }))
    );
  }

  /**
   * Validates sensor configuration parameters
   * @param config Sensor configuration to validate
   */
  private validateSensorConfig(config: ISensorConfig): void {
    if (!config.id || !config.type) {
      throw new Error('Invalid sensor configuration: missing required fields');
    }

    // Validate sampling rate based on sensor type
    const requiredRate = config.type === SENSOR_TYPES.IMU ? 
      SAMPLING_RATES.IMU : SAMPLING_RATES.TOF;
    
    if (config.samplingRate !== requiredRate) {
      throw new Error(`Invalid sampling rate for ${config.type}: ${config.samplingRate}Hz`);
    }
  }

  /**
   * Updates sensor data and notifies subscribers
   * @param processedData Processed sensor data
   */
  private updateSensorData(processedData: ISensorData): void {
    const currentData = this.sensorDataSubject.value;
    const updatedData = [...currentData, processedData].slice(-DATA_BUFFER_SIZE);
    this.sensorDataSubject.next(updatedData);
  }

  /**
   * Updates processing latency metrics
   * @param timestamp Data timestamp
   */
  private updateProcessingLatency(timestamp: number): void {
    const latency = Date.now() - timestamp;
    this.processingLatency = latency;
  }

  /**
   * Initializes performance monitoring
   */
  private initializePerformanceMonitoring(): void {
    setInterval(() => {
      this.performanceMetrics.next({
        processingLatency: this.processingLatency,
        bufferSize: this.sensorDataSubject.value.length,
        memoryUsage: performance.memory?.usedJSHeapSize || 0,
        messageRate: this.calculateMessageRate(),
        timestamp: Date.now()
      });
    }, 100); // Update metrics every 100ms
  }

  /**
   * Calculates current message processing rate
   * @returns Messages per second
   */
  private calculateMessageRate(): number {
    const recentData = this.sensorDataSubject.value
      .filter(d => Date.now() - d.timestamp < 1000);
    return recentData.length;
  }

  /**
   * Gets the current sensor data stream
   * @returns Observable of sensor data array
   */
  public getSensorData() {
    return this.sensorDataSubject.asObservable();
  }

  /**
   * Cleans up service resources
   */
  public dispose(): void {
    this.processingWorkers.forEach(worker => worker.terminate());
    this.processingWorkers.clear();
    this.sensorConfigs.clear();
    this.sensorDataSubject.complete();
    this.performanceMetrics.complete();
  }
}