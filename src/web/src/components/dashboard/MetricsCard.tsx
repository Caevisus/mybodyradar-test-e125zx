/**
 * @fileoverview High-performance dashboard component for real-time metrics visualization
 * Implements Material Design 3.0 specifications with WebGL-accelerated heat maps
 * and <100ms update latency for performance monitoring
 * @version 1.0.0
 */

import React, { useEffect, useCallback, useMemo } from 'react';
import classNames from 'classnames'; // ^2.3.0
import { useWebGL } from '@react-hook/webgl'; // ^2.2.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import Card from '../common/Card';
import { useMetrics } from '../../hooks/useMetrics';
import type { ISessionMetrics } from '../../interfaces/session.interface';
import type { ISensorData } from '../../interfaces/sensor.interface';
import { SENSOR_UPDATE_INTERVAL } from '../../constants/sensor.constants';

/**
 * Props interface for the MetricsCard component
 */
interface IMetricsCardProps {
  sessionId: string;
  sensorData: ISensorData;
  title?: string;
  showHeatMap?: boolean;
  webGLConfig?: {
    antialias?: boolean;
    alpha?: boolean;
    powerPreference?: 'high-performance' | 'low-power';
  };
  onMetricsUpdate?: (metrics: ISessionMetrics) => void;
  onError?: (error: Error) => void;
  updateInterval?: number;
  performanceMode?: 'high' | 'balanced' | 'low';
}

/**
 * Interface for metric formatting options
 */
interface IFormatOptions {
  precision?: number;
  unit?: string;
  locale?: string;
}

/**
 * Formats metric values with appropriate units and precision
 */
const formatMetricValue = (
  value: number,
  metricType: string,
  options: IFormatOptions = {}
): string => {
  const {
    precision = 2,
    unit = '',
    locale = 'en-US'
  } = options;

  const formattedValue = new Intl.NumberFormat(locale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  }).format(value);

  return `${formattedValue}${unit}`;
};

/**
 * Error fallback component for error boundary
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <Card elevation={1} className="metrics-card metrics-card--error">
    <div className="metrics-card__error">
      <h3>Error Loading Metrics</h3>
      <p>{error.message}</p>
    </div>
  </Card>
);

/**
 * High-performance dashboard component for real-time metrics visualization
 */
const MetricsCard: React.FC<IMetricsCardProps> = React.memo(({
  sessionId,
  sensorData,
  title = 'Performance Metrics',
  showHeatMap = true,
  webGLConfig = {
    antialias: true,
    powerPreference: 'high-performance'
  },
  onMetricsUpdate,
  onError,
  updateInterval = SENSOR_UPDATE_INTERVAL,
  performanceMode = 'high'
}) => {
  // Initialize metrics hook with sensor data
  const {
    metrics,
    heatMap,
    isLoading,
    error,
    performance
  } = useMetrics(sensorData, sessionId);

  // Initialize WebGL context for heat map visualization
  const [canvasRef, webGLContext] = useWebGL(webGLConfig);

  // Memoized performance configuration
  const performanceConfig = useMemo(() => ({
    updateThrottle: performanceMode === 'high' ? 0 : 
                    performanceMode === 'balanced' ? 50 : 100,
    batchSize: performanceMode === 'high' ? 1000 : 
               performanceMode === 'balanced' ? 500 : 250
  }), [performanceMode]);

  // Handle metrics updates
  const handleMetricsUpdate = useCallback(() => {
    if (onMetricsUpdate && metrics) {
      onMetricsUpdate(metrics);
    }

    // Monitor performance
    if (performance.latency > 100) {
      console.warn(`Metrics update exceeded latency threshold: ${performance.latency}ms`);
    }
  }, [metrics, onMetricsUpdate, performance.latency]);

  // Effect for metrics update interval
  useEffect(() => {
    const updateTimer = setInterval(
      handleMetricsUpdate,
      updateInterval + performanceConfig.updateThrottle
    );

    return () => clearInterval(updateTimer);
  }, [handleMetricsUpdate, updateInterval, performanceConfig.updateThrottle]);

  // Effect for error handling
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Render metrics card content
  const renderMetrics = () => (
    <div className="metrics-card__content">
      {/* Muscle Activity Section */}
      <div className="metrics-card__section">
        <h4>Muscle Activity</h4>
        {Object.entries(metrics.muscleActivity).map(([muscle, value]) => (
          <div key={muscle} className="metrics-card__metric">
            <span>{muscle}</span>
            <span>{formatMetricValue(value, 'muscle', { unit: 'μV' })}</span>
          </div>
        ))}
      </div>

      {/* Force Distribution Section */}
      <div className="metrics-card__section">
        <h4>Force Distribution</h4>
        {Object.entries(metrics.forceDistribution).map(([region, value]) => (
          <div key={region} className="metrics-card__metric">
            <span>{region}</span>
            <span>{formatMetricValue(value, 'force', { unit: 'N' })}</span>
          </div>
        ))}
      </div>

      {/* Range of Motion Section */}
      <div className="metrics-card__section">
        <h4>Range of Motion</h4>
        {Object.entries(metrics.rangeOfMotion).map(([joint, data]) => (
          <div key={joint} className="metrics-card__metric">
            <span>{joint}</span>
            <span>
              {formatMetricValue(data.current, 'angle', { unit: '°' })}
              {data.deviation > 0.1 && (
                <span className="metrics-card__deviation">
                  ({formatMetricValue(data.deviation * 100, 'percentage', { unit: '%' })})
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Heat Map Visualization */}
      {showHeatMap && (
        <div className="metrics-card__heatmap">
          <canvas
            ref={canvasRef}
            className="metrics-card__canvas"
            width={400}
            height={300}
          />
        </div>
      )}
    </div>
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onError={onError}>
      <Card
        elevation={2}
        className={classNames('metrics-card', {
          'metrics-card--loading': isLoading,
          'metrics-card--error': error
        })}
      >
        <div className="metrics-card__header">
          <h3>{title}</h3>
          {performance.latency > 0 && (
            <span className="metrics-card__performance">
              {formatMetricValue(performance.latency, 'time', { unit: 'ms' })}
            </span>
          )}
        </div>
        {isLoading ? (
          <div className="metrics-card__loading">Loading metrics...</div>
        ) : (
          renderMetrics()
        )}
      </Card>
    </ErrorBoundary>
  );
});

// Display name for debugging
MetricsCard.displayName = 'MetricsCard';

export default MetricsCard;