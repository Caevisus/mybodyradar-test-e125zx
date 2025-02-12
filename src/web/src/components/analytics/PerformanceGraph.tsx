/**
 * @fileoverview High-performance React component for real-time performance metrics visualization
 * Implements WebGL-accelerated rendering with <100ms latency and ±1% accuracy requirements
 * @version 1.0.0
 */

import React, { useEffect, useRef } from 'react';
import { select } from 'd3'; // ^7.8.0
import { WebGLRenderer } from 'three'; // ^0.150.0
import { Subscription } from 'rxjs'; // ^7.8.0

import { ChartOptions } from '../../interfaces/chart.interface';
import { createChart, updateChartData } from '../../utils/chart.utils';
import { AnalyticsService } from '../../services/analytics.service';
import { PERFORMANCE_CHART_CONSTANTS, UPDATE_INTERVALS } from '../../constants/chart.constants';

/**
 * Enhanced accessibility configuration interface
 */
interface AccessibilityConfig {
  ariaLabel: string;
  showTooltips: boolean;
  highContrastMode: boolean;
  keyboardNavigation: boolean;
}

/**
 * Performance mode configuration for WebGL optimization
 */
type PerformanceMode = 'balanced' | 'high-performance' | 'power-saver';

/**
 * Props interface for PerformanceGraph component
 */
interface PerformanceGraphProps {
  sessionId: string;
  width: number;
  height: number;
  showAnomalies: boolean;
  timeRange: number;
  accuracy: number;
  webglEnabled: boolean;
  accessibilityOptions: AccessibilityConfig;
  performanceMode: PerformanceMode;
}

/**
 * High-performance graph component for real-time metrics visualization
 */
const PerformanceGraph: React.FC<PerformanceGraphProps> = ({
  sessionId,
  width,
  height,
  showAnomalies,
  timeRange,
  accuracy = 0.01, // ±1% accuracy requirement
  webglEnabled = true,
  accessibilityOptions,
  performanceMode = 'balanced'
}) => {
  // Refs for DOM elements and WebGL context
  const chartRef = useRef<HTMLDivElement>(null);
  const webglRef = useRef<WebGLRenderer>();
  const metricsSubscription = useRef<Subscription>();
  const analyticsService = useRef<AnalyticsService>(new AnalyticsService());

  /**
   * Initializes WebGL context and chart configuration
   */
  const initializeChart = () => {
    if (!chartRef.current) return;

    // Initialize WebGL renderer if enabled
    if (webglEnabled) {
      webglRef.current = new WebGLRenderer({
        antialias: performanceMode === 'high-performance',
        powerPreference: performanceMode === 'power-saver' ? 'low-power' : 'high-performance',
        precision: performanceMode === 'high-performance' ? 'highp' : 'mediump'
      });
      webglRef.current.setSize(width, height);
      chartRef.current.appendChild(webglRef.current.domElement);
    }

    // Create chart configuration
    const chartOptions: ChartOptions = {
      type: 'LINE_GRAPH',
      dimensions: {
        width,
        height,
        margin: {
          top: 20,
          right: 30,
          bottom: 40,
          left: 50
        },
        aspectRatio: width / height,
        responsive: true
      },
      updateInterval: UPDATE_INTERVALS.REAL_TIME, // <100ms latency requirement
      precision: accuracy, // ±1% accuracy requirement
      colorScale: ['#2171b5', '#6baed6', '#bdd7e7'],
      animationConfig: {
        duration: PERFORMANCE_CHART_CONSTANTS.ANIMATION_DURATION,
        easing: 'ease-out'
      },
      interactionConfig: {
        zoomEnabled: true,
        panEnabled: true,
        tooltipEnabled: accessibilityOptions.showTooltips,
        selectionEnabled: true
      },
      webglOptions: {
        enabled: webglEnabled,
        renderer: webglRef.current,
        performanceMode
      }
    };

    // Initialize chart with WebGL acceleration
    createChart(chartOptions, chartRef.current);
  };

  /**
   * Handles real-time data updates with WebGL acceleration
   */
  const handleDataUpdate = (metrics: any) => {
    if (!chartRef.current) return;

    const startTime = performance.now();

    try {
      // Validate data accuracy (±1% requirement)
      const validatedData = analyticsService.current.validateDataAccuracy(metrics, accuracy);

      // Update chart with new data
      updateChartData({
        data: validatedData,
        showAnomalies,
        timeRange,
        webglContext: webglRef.current
      });

      // Monitor update latency
      const updateLatency = performance.now() - startTime;
      if (updateLatency > UPDATE_INTERVALS.REAL_TIME) {
        console.warn(`Performance graph update exceeded latency threshold: ${updateLatency}ms`);
      }
    } catch (error) {
      console.error('Error updating performance graph:', error);
    }
  };

  /**
   * Sets up real-time data subscription and cleanup
   */
  useEffect(() => {
    if (!sessionId) return;

    // Initialize chart
    initializeChart();

    // Subscribe to real-time metrics
    metricsSubscription.current = analyticsService.current
      .getMetricsStream(sessionId)
      .subscribe(handleDataUpdate);

    // Set up anomaly detection if enabled
    if (showAnomalies) {
      analyticsService.current.detectAnomalies(sessionId);
    }

    // Cleanup function
    return () => {
      metricsSubscription.current?.unsubscribe();
      webglRef.current?.dispose();
    };
  }, [sessionId, width, height, showAnomalies, timeRange, webglEnabled, performanceMode]);

  // Add ARIA attributes for accessibility
  const ariaAttributes = {
    role: 'img',
    'aria-label': accessibilityOptions.ariaLabel,
    'aria-live': 'polite',
    'aria-atomic': 'true'
  };

  return (
    <div
      ref={chartRef}
      className="performance-graph"
      {...ariaAttributes}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        position: 'relative'
      }}
    />
  );
};

export default PerformanceGraph;