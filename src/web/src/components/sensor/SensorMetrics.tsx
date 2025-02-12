/**
 * @fileoverview High-performance React component for real-time sensor metrics visualization
 * Implements WebGL-accelerated rendering for IMU (200Hz) and ToF (100Hz) sensor data
 * with WCAG 2.1 Level AA accessibility compliance and comprehensive error handling
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { memo } from 'react';
import { useWorker } from '@koale/useworker'; // ^4.0.2
import { usePerformanceMonitor } from '@performance-monitor/react'; // ^2.0.0

import { Chart } from '../common/Chart';
import type { ISensorConfig, ISensorData, ISensorReading } from '../../interfaces/sensor.interface';
import { SENSOR_TYPES, SENSOR_STATUS, SAMPLING_RATES } from '../../constants/sensor.constants';
import { ChartTypes, UPDATE_INTERVALS, PERFORMANCE_CHART_CONSTANTS } from '../../constants/chart.constants';
import type { ChartOptions } from '../../interfaces/chart.interface';

// WCAG compliance levels
enum WCAG_LEVEL {
  A = 'A',
  AA = 'AA',
  AAA = 'AAA'
}

interface SensorMetricsProps {
  sensorId: string;
  showCalibration?: boolean;
  refreshRate?: number;
  className?: string;
  precision?: number;
  webGLEnabled?: boolean;
  accessibilityLevel?: WCAG_LEVEL;
  errorHandler?: (error: Error) => void;
}

/**
 * Worker function for data processing to maintain <100ms latency
 */
const processSensorData = (data: ISensorReading[], precision: number) => {
  try {
    return data.map(reading => ({
      timestamp: reading.timestamp,
      value: Number(reading.value.toFixed(precision)),
      type: reading.type
    }));
  } catch (error) {
    console.error('Data processing error:', error);
    throw error;
  }
};

/**
 * High-performance sensor metrics visualization component
 * Supports IMU (200Hz) and ToF (100Hz) data with WebGL acceleration
 */
export const SensorMetrics: React.FC<SensorMetricsProps> = memo(({
  sensorId,
  showCalibration = false,
  refreshRate = UPDATE_INTERVALS.REAL_TIME,
  className = '',
  precision = PERFORMANCE_CHART_CONSTANTS.Y_AXIS_PRECISION,
  webGLEnabled = true,
  accessibilityLevel = WCAG_LEVEL.AA,
  errorHandler = console.error
}) => {
  // Refs and state
  const chartRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number>();
  const [sensorData, setSensorData] = useState<ISensorData[]>([]);
  const [sensorConfig, setSensorConfig] = useState<ISensorConfig | null>(null);
  
  // Web Worker for data processing
  const [processDataWorker] = useWorker(processSensorData);

  // Performance monitoring
  const { metrics, startMonitoring, stopMonitoring } = usePerformanceMonitor({
    sampleSize: 100,
    threshold: UPDATE_INTERVALS.REAL_TIME
  });

  /**
   * Chart configuration with WebGL optimization
   */
  const getChartOptions = useCallback((): ChartOptions => ({
    type: ChartTypes.HEAT_MAP,
    dimensions: {
      width: chartRef.current?.clientWidth || 800,
      height: chartRef.current?.clientHeight || 400,
      margin: { top: 20, right: 30, bottom: 40, left: 50 },
      aspectRatio: 2
    },
    precision,
    updateInterval: refreshRate,
    webGLEnabled,
    colorScale: ['#f7fbff', '#2171b5'],
    animationConfig: {
      duration: PERFORMANCE_CHART_CONSTANTS.ANIMATION_DURATION,
      easing: 'ease-out'
    },
    interactionConfig: {
      zoomEnabled: true,
      panEnabled: true,
      tooltipEnabled: true,
      selectionEnabled: false
    }
  }), [precision, refreshRate, webGLEnabled]);

  /**
   * Real-time data update handler
   */
  const updateSensorData = useCallback(async (newData: ISensorReading[]) => {
    try {
      startMonitoring();
      
      // Process data in Web Worker
      const processedData = await processDataWorker(newData, precision);
      
      setSensorData(prevData => {
        const updatedData = [...prevData, ...processedData];
        // Maintain optimal buffer size
        return updatedData.slice(-PERFORMANCE_CHART_CONSTANTS.DATA_POINTS_THRESHOLD);
      });

      // Performance check
      if (metrics.averageLatency > UPDATE_INTERVALS.REAL_TIME) {
        console.warn(`Performance threshold exceeded: ${metrics.averageLatency}ms`);
      }
    } catch (error) {
      errorHandler(error as Error);
    }
  }, [precision, processDataWorker, metrics, errorHandler]);

  /**
   * Sensor configuration and calibration handler
   */
  const initializeSensor = useCallback(async () => {
    try {
      const config: ISensorConfig = {
        id: sensorId,
        type: SENSOR_TYPES.IMU,
        samplingRate: SAMPLING_RATES.IMU,
        status: SENSOR_STATUS.ACTIVE,
        calibrationParams: {
          tofGain: 8,
          imuDriftCorrection: 0.5,
          pressureThreshold: 1.0,
          sampleWindow: 100,
          filterCutoff: 2.0
        }
      };
      setSensorConfig(config);
    } catch (error) {
      errorHandler(error as Error);
    }
  }, [sensorId, errorHandler]);

  /**
   * Animation frame loop for real-time updates
   */
  const startRenderLoop = useCallback(() => {
    if (!chartRef.current) return;

    const render = () => {
      animationFrameId.current = requestAnimationFrame(render);
      // Update chart with latest data
      if (sensorData.length > 0) {
        const chartOptions = getChartOptions();
        const chart = chartRef.current?.querySelector('.chart-container');
        if (chart) {
          Chart.render(chart as HTMLElement, sensorData, chartOptions);
        }
      }
    };

    render();
  }, [sensorData, getChartOptions]);

  // Lifecycle hooks
  useEffect(() => {
    initializeSensor();
    startRenderLoop();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      stopMonitoring();
    };
  }, [initializeSensor, startRenderLoop, stopMonitoring]);

  // Accessibility enhancements
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setAttribute('role', 'img');
      chartRef.current.setAttribute('aria-label', 'Sensor metrics visualization');
      if (accessibilityLevel === WCAG_LEVEL.AAA) {
        chartRef.current.setAttribute('aria-live', 'polite');
      }
    }
  }, [accessibilityLevel]);

  return (
    <div
      ref={chartRef}
      className={`sensor-metrics ${className}`}
      data-testid="sensor-metrics"
    >
      {showCalibration && sensorConfig && (
        <div className="calibration-overlay" aria-live="polite">
          <span>Sampling Rate: {sensorConfig.samplingRate}Hz</span>
          <span>Status: {SENSOR_STATUS[sensorConfig.status]}</span>
        </div>
      )}
      <div className="chart-container" />
    </div>
  );
});

SensorMetrics.displayName = 'SensorMetrics';

export default SensorMetrics;