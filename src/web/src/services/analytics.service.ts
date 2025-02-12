/**
 * @fileoverview Analytics service for real-time sensor data processing and visualization
 * @version 1.0.0
 * 
 * Implements real-time biomechanical metrics processing, heat map generation,
 * and performance analytics with <100ms latency requirement.
 */

import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject, Observable, from } from 'rxjs'; // v7.8.0
import { buffer, debounceTime, map, mergeMap } from 'rxjs/operators'; // v7.8.0
import * as d3 from 'd3'; // v7.8.0
import { stat } from 'ml-stat'; // v1.3.3

import { ISensorData } from '../interfaces/sensor.interface';
import { ISessionMetrics } from '../interfaces/session.interface';
import { ApiService } from './api.service';
import { apiConfig } from '../config/api.config';

/**
 * Service responsible for real-time analytics processing and visualization
 * Implements <100ms latency requirement for data processing
 */
@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private readonly dataStream$ = new Subject<ISensorData>();
  private readonly metrics$ = new BehaviorSubject<ISessionMetrics>(this.initializeMetrics());
  private readonly webglRenderer: WebGLRenderingContext;
  private readonly analyticsWorker: Worker;
  private readonly bufferSize = 1000; // Optimized for real-time processing
  private readonly processingInterval = 50; // 50ms for <100ms latency requirement

  constructor(private readonly apiService: ApiService) {
    // Initialize WebGL context for hardware-accelerated visualizations
    const canvas = document.createElement('canvas');
    this.webglRenderer = canvas.getContext('webgl', {
      antialias: true,
      powerPreference: 'high-performance'
    });

    // Initialize Web Worker for heavy computations
    this.analyticsWorker = new Worker(
      new URL('../workers/analytics.worker', import.meta.url)
    );

    this.initializeDataPipeline();
  }

  /**
   * Processes incoming sensor data stream with real-time optimization
   * @param data - Raw sensor data packet
   */
  public processDataStream(data: ISensorData): void {
    this.validateData(data);
    this.dataStream$.next(data);
  }

  /**
   * Generates real-time heat map visualization using WebGL acceleration
   * @param data - Processed sensor data
   * @returns Promise with heat map intensity values
   */
  public async generateHeatMap(data: ISensorData): Promise<Record<string, number>> {
    const startTime = performance.now();

    try {
      // Create color scale for heat map
      const colorScale = d3.scaleSequential(d3.interpolateInferno)
        .domain([0, d3.max(data.readings, d => d.value[0])]);

      // Process data for visualization
      const heatMapData = await this.analyticsWorker.postMessage({
        type: 'GENERATE_HEATMAP',
        data: data.readings
      });

      // Render using WebGL for hardware acceleration
      this.renderHeatMap(heatMapData, colorScale);

      const processingTime = performance.now() - startTime;
      if (processingTime > 100) {
        console.warn(`Heat map generation exceeded latency threshold: ${processingTime}ms`);
      }

      return heatMapData;
    } catch (error) {
      console.error('Heat map generation failed:', error);
      throw error;
    }
  }

  /**
   * Performs real-time anomaly detection on sensor metrics
   * @param metrics - Current session metrics
   * @returns Promise with anomaly detection results
   */
  public async detectAnomalies(metrics: ISessionMetrics): Promise<Record<string, number>> {
    try {
      const anomalyScores = {};

      // Process muscle activity anomalies
      for (const [muscle, activity] of Object.entries(metrics.muscleActivity)) {
        const zscore = stat.zScore(activity);
        if (Math.abs(zscore) > 2) {
          anomalyScores[muscle] = zscore;
        }
      }

      // Process force distribution anomalies
      for (const [region, force] of Object.entries(metrics.forceDistribution)) {
        const baseline = metrics.rangeOfMotion[region]?.baseline || 0;
        const deviation = Math.abs((force - baseline) / baseline);
        if (deviation > 0.15) { // 15% threshold
          anomalyScores[`force_${region}`] = deviation;
        }
      }

      return anomalyScores;
    } catch (error) {
      console.error('Anomaly detection failed:', error);
      throw error;
    }
  }

  /**
   * Returns observable stream of real-time metrics
   * @returns Observable of session metrics
   */
  public getMetricsStream(): Observable<ISessionMetrics> {
    return this.metrics$.asObservable();
  }

  /**
   * Initializes the real-time data processing pipeline
   * @private
   */
  private initializeDataPipeline(): void {
    this.dataStream$.pipe(
      buffer(this.dataStream$.pipe(debounceTime(this.processingInterval))),
      mergeMap(async (dataBuffer) => {
        if (dataBuffer.length === 0) return;

        const processedMetrics = await this.processDataBuffer(dataBuffer);
        this.metrics$.next(processedMetrics);

        // Check for anomalies
        const anomalies = await this.detectAnomalies(processedMetrics);
        if (Object.keys(anomalies).length > 0) {
          this.handleAnomalies(anomalies);
        }
      })
    ).subscribe();
  }

  /**
   * Processes buffer of sensor data for metrics calculation
   * @private
   * @param dataBuffer - Array of sensor data packets
   * @returns Promise with processed metrics
   */
  private async processDataBuffer(dataBuffer: ISensorData[]): Promise<ISessionMetrics> {
    const startTime = performance.now();

    try {
      const metrics = this.initializeMetrics();

      // Process muscle activity
      for (const data of dataBuffer) {
        for (const reading of data.readings) {
          const muscleId = `muscle_${reading.type}`;
          metrics.muscleActivity[muscleId] = 
            (metrics.muscleActivity[muscleId] || 0) + reading.value[0];
        }
      }

      // Calculate force distribution
      metrics.forceDistribution = await this.analyticsWorker.postMessage({
        type: 'CALCULATE_FORCE_DISTRIBUTION',
        data: dataBuffer
      });

      const processingTime = performance.now() - startTime;
      if (processingTime > 100) {
        console.warn(`Metrics processing exceeded latency threshold: ${processingTime}ms`);
      }

      return metrics;
    } catch (error) {
      console.error('Metrics processing failed:', error);
      throw error;
    }
  }

  /**
   * Initializes empty metrics structure
   * @private
   * @returns Empty metrics object
   */
  private initializeMetrics(): ISessionMetrics {
    return {
      muscleActivity: {},
      forceDistribution: {},
      rangeOfMotion: {},
      anomalyScores: {},
      alertTriggers: {}
    };
  }

  /**
   * Validates incoming sensor data
   * @private
   * @param data - Sensor data to validate
   */
  private validateData(data: ISensorData): void {
    if (!data || !Array.isArray(data.readings)) {
      throw new Error('Invalid sensor data format');
    }

    if (!data.metadata?.quality || data.metadata.quality < 50) {
      console.warn(`Low quality sensor data detected: ${data.metadata?.quality}`);
    }
  }

  /**
   * Renders heat map using WebGL
   * @private
   * @param data - Heat map data
   * @param colorScale - D3 color scale
   */
  private renderHeatMap(
    data: Record<string, number>,
    colorScale: d3.ScaleSequential<string>
  ): void {
    if (!this.webglRenderer) return;

    // WebGL rendering implementation
    const vertices = this.createHeatMapVertices(data);
    const colors = this.createHeatMapColors(data, colorScale);

    // Set up WebGL buffers and render
    this.webglRenderer.bindBuffer(this.webglRenderer.ARRAY_BUFFER, vertices);
    this.webglRenderer.bufferData(
      this.webglRenderer.ARRAY_BUFFER,
      new Float32Array(vertices),
      this.webglRenderer.STATIC_DRAW
    );
  }

  /**
   * Handles detected anomalies
   * @private
   * @param anomalies - Detected anomalies
   */
  private async handleAnomalies(anomalies: Record<string, number>): Promise<void> {
    try {
      await this.apiService.post(
        apiConfig.endpoints.ALERT.CREATE,
        {
          type: 'anomaly_detection',
          anomalies,
          timestamp: new Date()
        }
      );
    } catch (error) {
      console.error('Failed to handle anomalies:', error);
    }
  }

  /**
   * Creates vertices for heat map rendering
   * @private
   * @param data - Heat map data
   * @returns Array of vertices
   */
  private createHeatMapVertices(data: Record<string, number>): number[] {
    // Implementation of vertex creation for WebGL rendering
    return [];
  }

  /**
   * Creates color array for heat map rendering
   * @private
   * @param data - Heat map data
   * @param colorScale - D3 color scale
   * @returns Array of colors
   */
  private createHeatMapColors(
    data: Record<string, number>,
    colorScale: d3.ScaleSequential<string>
  ): number[] {
    // Implementation of color array creation for WebGL rendering
    return [];
  }
}