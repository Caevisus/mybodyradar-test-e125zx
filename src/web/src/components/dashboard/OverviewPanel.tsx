/**
 * @fileoverview Dashboard overview panel component providing real-time athlete performance metrics
 * and biomechanical analysis with WebGL-accelerated visualizations
 * @version 1.0.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import classNames from 'classnames'; // ^2.3.0

import Card from '../common/Card';
import HeatMap from '../analytics/HeatMap';
import { useMetrics } from '../../hooks/useMetrics';
import type { IAthlete } from '../../interfaces/athlete.interface';
import type { ISessionMetrics } from '../../interfaces/session.interface';
import { SENSOR_UPDATE_INTERVAL } from '../../constants/sensor.constants';

interface IOverviewPanelProps {
  className?: string;
  athlete: IAthlete;
  sessionId: string;
}

/**
 * Overview panel component for real-time performance monitoring
 * Implements <100ms latency requirement with WebGL acceleration
 */
const OverviewPanel: React.FC<IOverviewPanelProps> = ({
  className,
  athlete,
  sessionId
}) => {
  // State for sensor data and performance tracking
  const [sensorData, setSensorData] = useState(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Custom hook for real-time metrics processing
  const {
    metrics,
    heatMap,
    isLoading,
    error,
    performance
  } = useMetrics(sensorData, sessionId);

  // Heat map configuration with WebGL acceleration
  const heatMapOptions = useMemo(() => ({
    type: 'heatmap',
    dimensions: {
      width: 600,
      height: 400,
      margin: { top: 20, right: 20, bottom: 30, left: 40 },
      aspectRatio: 1.5
    },
    updateInterval: SENSOR_UPDATE_INTERVAL,
    precision: 0.01, // 1% accuracy requirement
    colorScale: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#fee090', '#fdae61', '#f46d43', '#d73027'],
    animationConfig: {
      duration: 100,
      easing: 'linear'
    },
    interactionConfig: {
      zoomEnabled: true,
      panEnabled: true,
      tooltipEnabled: true,
      selectionEnabled: false
    }
  }), []);

  // Effect for real-time data updates
  useEffect(() => {
    let animationFrame: number;
    
    const updateData = () => {
      // Real-time data update logic would go here
      // This would connect to the sensor data stream
      setLastUpdate(new Date());
      animationFrame = requestAnimationFrame(updateData);
    };

    animationFrame = requestAnimationFrame(updateData);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  /**
   * Renders performance metric cards with real-time updates
   */
  const renderMetricsCards = (metrics: ISessionMetrics) => {
    const { muscleActivity, forceDistribution, rangeOfMotion } = metrics;

    return (
      <div className="metrics-grid">
        {/* Muscle Activity Card */}
        <Card 
          className="metric-card"
          elevation={2}
          role="region"
          ariaLabel="Muscle activity metrics"
        >
          <h3>Muscle Activity</h3>
          <div className="metric-values">
            {Object.entries(muscleActivity).map(([muscle, value]) => (
              <div key={muscle} className="metric-item">
                <span>{muscle}</span>
                <span>{value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Force Distribution Card */}
        <Card 
          className="metric-card"
          elevation={2}
          role="region"
          ariaLabel="Force distribution metrics"
        >
          <h3>Force Distribution</h3>
          <div className="metric-values">
            {Object.entries(forceDistribution).map(([region, value]) => (
              <div key={region} className="metric-item">
                <span>{region}</span>
                <span>{value.toFixed(2)} N</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Range of Motion Card */}
        <Card 
          className="metric-card"
          elevation={2}
          role="region"
          ariaLabel="Range of motion metrics"
        >
          <h3>Range of Motion</h3>
          <div className="metric-values">
            {Object.entries(rangeOfMotion).map(([joint, data]) => (
              <div key={joint} className="metric-item">
                <span>{joint}</span>
                <span>{data.current.toFixed(2)}°</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  };

  return (
    <div 
      className={classNames('overview-panel', className)}
      role="main"
      aria-live="polite"
    >
      {/* Performance Visualization */}
      <Card 
        className="visualization-card"
        elevation={3}
        role="region"
        ariaLabel="Performance visualization"
      >
        <h2>Real-time Performance</h2>
        <HeatMap 
          options={heatMapOptions}
          className="performance-heatmap"
          webglOptions={{
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true
          }}
        />
        {performance && (
          <div className="performance-metrics" aria-live="polite">
            <span>Latency: {performance.latency.toFixed(2)}ms</span>
            <span>FPS: {performance.fps.toFixed(1)}</span>
            <span>Last Update: {lastUpdate.toLocaleTimeString()}</span>
          </div>
        )}
      </Card>

      {/* Metrics Display */}
      {metrics && renderMetricsCards(metrics)}

      {/* Error State */}
      {error && (
        <Card 
          className="error-card"
          elevation={2}
          role="alert"
        >
          <h3>Error</h3>
          <p>{error.message}</p>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="loading-overlay" role="status">
          <span>Loading metrics...</span>
        </div>
      )}
    </div>
  );
};

export default OverviewPanel;