/**
 * @fileoverview Main dashboard page component for smart-apparel system
 * Implements real-time performance monitoring with <100ms latency and Material Design 3.0
 * @version 1.0.0
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import classNames from 'classnames';
import { useWebGL } from '@react-three/fiber';

import MetricsCard from '../components/dashboard/MetricsCard';
import { useSession } from '../../hooks/useSession';
import { useSensor } from '../../hooks/useSensor';

// Interface for dashboard page props
interface IDashboardPageProps {
  className?: string;
  theme?: {
    mode: 'light' | 'dark';
    colors: Record<string, string>;
  };
  errorBoundary?: boolean;
  performanceMode?: 'high' | 'balanced' | 'low';
}

// Performance monitoring interface
interface IPerformanceMetrics {
  fps: number;
  latency: number;
  memoryUsage: number;
  lastUpdate: number;
}

/**
 * Enhanced dashboard page component with real-time monitoring and WebGL acceleration
 */
const DashboardPage: React.FC<IDashboardPageProps> = ({
  className,
  theme = { mode: 'light', colors: {} },
  errorBoundary = true,
  performanceMode = 'high'
}) => {
  // Initialize hooks for session and sensor management
  const {
    currentSession,
    sessionMetrics,
    sessionErrors,
    startSession,
    endSession,
    reconnectSession
  } = useSession();

  const {
    sensorData,
    sensorStatus,
    sensorErrors,
    sensorMetrics,
    startSensor,
    stopSensor,
    calibrateSensor
  } = useSensor({
    id: currentSession?.id || '',
    type: 'imu',
    samplingRate: 200,
    calibrationParams: {
      tofGain: 8,
      imuDriftCorrection: 0.5,
      pressureThreshold: 1.0,
      sampleWindow: 100,
      filterCutoff: 2
    }
  });

  // State management
  const [performance, setPerformance] = useState<IPerformanceMetrics>({
    fps: 0,
    latency: 0,
    memoryUsage: 0,
    lastUpdate: Date.now()
  });

  // Refs for performance monitoring
  const frameRef = useRef<number>(0);
  const lastFrameTime = useRef<number>(Date.now());

  // WebGL context for accelerated rendering
  const [canvasRef, webGLContext] = useWebGL({
    antialias: performanceMode === 'high',
    powerPreference: performanceMode === 'high' ? 'high-performance' : 'low-power'
  });

  /**
   * Memoized performance configuration based on mode
   */
  const performanceConfig = useMemo(() => ({
    updateInterval: performanceMode === 'high' ? 16 : 
                   performanceMode === 'balanced' ? 33 : 50,
    batchSize: performanceMode === 'high' ? 1000 : 
              performanceMode === 'balanced' ? 500 : 250,
    throttleUpdates: performanceMode !== 'high'
  }), [performanceMode]);

  /**
   * Handles performance monitoring and updates
   */
  const updatePerformance = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastFrameTime.current;
    
    if (elapsed >= performanceConfig.updateInterval) {
      setPerformance(prev => ({
        fps: Math.round(1000 / elapsed),
        latency: sensorMetrics.latency,
        memoryUsage: performance.memory?.usedJSHeapSize || 0,
        lastUpdate: now
      }));
      lastFrameTime.current = now;
    }

    frameRef.current = requestAnimationFrame(updatePerformance);
  }, [performanceConfig.updateInterval, sensorMetrics.latency]);

  /**
   * Effect for performance monitoring
   */
  useEffect(() => {
    frameRef.current = requestAnimationFrame(updatePerformance);
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [updatePerformance]);

  /**
   * Effect for WebGL context management
   */
  useEffect(() => {
    if (!webGLContext) {
      console.warn('WebGL acceleration not available');
      return;
    }

    // Initialize WebGL resources
    return () => {
      webGLContext.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [webGLContext]);

  /**
   * Handles session errors
   */
  const handleSessionError = useCallback((error: Error) => {
    console.error('Session error:', error);
    reconnectSession().catch(console.error);
  }, [reconnectSession]);

  /**
   * Handles metrics updates with throttling
   */
  const handleMetricsUpdate = useCallback((metrics: typeof sessionMetrics) => {
    if (performanceConfig.throttleUpdates && performance.latency > 100) {
      console.warn(`High latency detected: ${performance.latency}ms`);
    }
  }, [performance.latency, performanceConfig.throttleUpdates]);

  return (
    <div 
      className={classNames('dashboard', className, {
        'dashboard--dark': theme.mode === 'dark',
        'dashboard--high-performance': performanceMode === 'high'
      })}
      role="main"
      aria-label="Performance Dashboard"
    >
      <div className="dashboard__header">
        <h1>Performance Dashboard</h1>
        <div className="dashboard__metrics">
          <span>FPS: {performance.fps}</span>
          <span>Latency: {performance.latency}ms</span>
        </div>
      </div>

      <div className="dashboard__content">
        <MetricsCard
          sessionId={currentSession?.id || ''}
          sensorData={sensorData[0]}
          title="Real-time Performance"
          showHeatMap={true}
          webGLConfig={{
            antialias: performanceMode === 'high',
            powerPreference: performanceMode === 'high' ? 'high-performance' : 'low-power'
          }}
          onMetricsUpdate={handleMetricsUpdate}
          onError={handleSessionError}
          updateInterval={performanceConfig.updateInterval}
          performanceMode={performanceMode}
        />

        {/* Additional dashboard components would be added here */}
      </div>

      <canvas
        ref={canvasRef}
        className="dashboard__webgl-canvas"
        style={{ display: 'none' }}
      />
    </div>
  );
};

// Display name for debugging
DashboardPage.displayName = 'DashboardPage';

export default DashboardPage;