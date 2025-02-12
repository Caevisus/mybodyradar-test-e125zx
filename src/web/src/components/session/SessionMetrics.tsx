/**
 * @fileoverview Real-time session metrics component with WebGL-accelerated visualization
 * Implements <100ms latency requirement for performance monitoring and heat map display
 * @version 1.0.0
 */

import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three'; // v0.158.0
import classnames from 'classnames'; // v2.3.2
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.11

import { ISessionMetrics } from '../../interfaces/session.interface';
import { useMetrics } from '../../hooks/useMetrics';

// Props interface with enhanced accessibility options
interface SessionMetricsProps {
  sessionId: string;
  isActive: boolean;
  className?: string;
  enableWebGL?: boolean;
  onError?: (error: Error) => void;
  ariaLabels?: Record<string, string>;
}

/**
 * Initializes WebGL context and sets up rendering pipeline
 */
const initializeWebGL = (
  canvas: HTMLCanvasElement,
  enableWebGL: boolean
): THREE.WebGLRenderer | null => {
  if (!enableWebGL) return null;

  try {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    return renderer;
  } catch (error) {
    console.error('WebGL initialization failed:', error);
    return null;
  }
};

/**
 * Formats metric values with appropriate units and precision
 */
const formatMetricValue = (value: number, metricType: string): string => {
  switch (metricType) {
    case 'force':
      return `${value.toFixed(1)}N`;
    case 'angle':
      return `${value.toFixed(1)}°`;
    case 'activity':
      return `${(value * 100).toFixed(1)}%`;
    default:
      return value.toFixed(2);
  }
};

/**
 * Real-time session metrics component with WebGL acceleration
 */
const SessionMetrics: React.FC<SessionMetricsProps> = React.memo(({
  sessionId,
  isActive,
  className,
  enableWebGL = true,
  onError,
  ariaLabels = {}
}) => {
  // Refs for DOM elements and WebGL renderer
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Custom hook for real-time metrics management
  const { metrics, heatMap, isLoading, error, performance } = useMetrics(sessionId);

  // Memoized class names
  const containerClasses = useMemo(() => classnames(
    'session-metrics',
    className,
    {
      'session-metrics--active': isActive,
      'session-metrics--loading': isLoading
    }
  ), [className, isActive, isLoading]);

  /**
   * Renders individual metric card with accessibility support
   */
  const renderMetricCard = useCallback((
    label: string,
    value: number,
    type: string
  ): JSX.Element => (
    <div 
      className="metric-card"
      role="region"
      aria-label={ariaLabels[label] || label}
    >
      <h3 className="metric-card__label">{label}</h3>
      <div 
        className="metric-card__value"
        aria-live="polite"
      >
        {formatMetricValue(value, type)}
      </div>
    </div>
  ), [ariaLabels]);

  /**
   * Renders WebGL-accelerated heat map visualization
   */
  const renderHeatMap = useCallback(() => {
    if (!heatMap || !rendererRef.current) return null;

    return (
      <div 
        className="heat-map"
        role="img"
        aria-label={ariaLabels.heatMap || 'Muscle activity heat map'}
      >
        <canvas
          ref={canvasRef}
          className="heat-map__canvas"
          aria-hidden="true"
        />
      </div>
    );
  }, [heatMap, ariaLabels.heatMap]);

  // Initialize WebGL renderer
  useEffect(() => {
    if (!canvasRef.current || !enableWebGL) return;

    rendererRef.current = initializeWebGL(canvasRef.current, enableWebGL);

    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, [enableWebGL]);

  // Handle errors
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Performance monitoring
  useEffect(() => {
    if (performance.latency > 100) {
      console.warn(`Rendering latency exceeded threshold: ${performance.latency}ms`);
    }
  }, [performance.latency]);

  return (
    <ErrorBoundary
      fallback={<div className="session-metrics__error">Error loading metrics</div>}
      onError={onError}
    >
      <div 
        ref={containerRef}
        className={containerClasses}
        aria-busy={isLoading}
      >
        {/* Muscle Activity Metrics */}
        <section className="metrics-section">
          <h2 className="metrics-section__title">Muscle Activity</h2>
          <div className="metrics-grid">
            {Object.entries(metrics.muscleActivity).map(([muscle, value]) => (
              renderMetricCard(muscle, value, 'activity')
            ))}
          </div>
        </section>

        {/* Force Distribution */}
        <section className="metrics-section">
          <h2 className="metrics-section__title">Force Distribution</h2>
          <div className="metrics-grid">
            {Object.entries(metrics.forceDistribution).map(([region, value]) => (
              renderMetricCard(region, value, 'force')
            ))}
          </div>
        </section>

        {/* Range of Motion */}
        <section className="metrics-section">
          <h2 className="metrics-section__title">Range of Motion</h2>
          <div className="metrics-grid">
            {Object.entries(metrics.rangeOfMotion).map(([joint, data]) => (
              renderMetricCard(joint, data.current, 'angle')
            ))}
          </div>
        </section>

        {/* Heat Map Visualization */}
        {renderHeatMap()}

        {/* Performance Indicators */}
        <div 
          className="performance-metrics"
          aria-label="Performance metrics"
          role="status"
        >
          <span className="latency">
            Latency: {performance.latency.toFixed(1)}ms
          </span>
          <span className="fps">
            FPS: {performance.fps.toFixed(0)}
          </span>
        </div>
      </div>
    </ErrorBoundary>
  );
});

SessionMetrics.displayName = 'SessionMetrics';

export default SessionMetrics;