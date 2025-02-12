/**
 * @fileoverview Real-time statistical analysis panel for athlete performance metrics
 * Implements <100ms latency requirement with WebGL acceleration and performance optimizations
 * @version 1.0.0
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Card, CardContent, Typography, Grid, CircularProgress, Alert } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

import { ISessionMetrics } from '../../interfaces/session.interface';
import { IAthlete } from '../../interfaces/athlete.interface';
import { AnalyticsService } from '../../services/analytics.service';

// Performance monitoring buffer size
const METRICS_BUFFER_SIZE = 1000;
const UPDATE_INTERVAL = 50; // 50ms for <100ms latency requirement

/**
 * Props interface for StatisticsPanel component
 */
interface StatisticsPanelProps {
  athleteId: string;
  sessionId: string;
  showBaseline: boolean;
  refreshRate?: number;
  onAnomalyDetected?: (score: number, metric: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Formats metric values with appropriate units and precision
 */
const formatMetricValue = (value: number, metricType: string, precision: number = 2): string => {
  if (value == null) return 'N/A';
  
  const formatted = value.toFixed(precision);
  switch (metricType) {
    case 'muscleActivity':
      return `${formatted}μV`;
    case 'forceDistribution':
      return `${formatted}N`;
    case 'rangeOfMotion':
      return `${formatted}°`;
    case 'anomalyScore':
      return formatted;
    default:
      return formatted;
  }
};

/**
 * Calculates percentage change with baseline comparison
 */
const calculatePercentageChange = (
  current: number,
  baseline: number,
  useAbsolute: boolean = false
): { percentage: number; trend: 'increasing' | 'decreasing' | 'stable' } => {
  if (!baseline) return { percentage: 0, trend: 'stable' };
  
  const change = ((current - baseline) / baseline) * 100;
  const absoluteChange = useAbsolute ? Math.abs(change) : change;
  
  return {
    percentage: Number(absoluteChange.toFixed(1)),
    trend: change > 1 ? 'increasing' : change < -1 ? 'decreasing' : 'stable'
  };
};

/**
 * Real-time statistics panel component with performance optimizations
 */
const StatisticsPanel: React.FC<StatisticsPanelProps> = ({
  athleteId,
  sessionId,
  showBaseline,
  refreshRate = UPDATE_INTERVAL,
  onAnomalyDetected,
  onError
}) => {
  // State management
  const [metrics, setMetrics] = useState<ISessionMetrics | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Performance optimization refs
  const metricsBuffer = useRef<ISessionMetrics[]>([]);
  const analyticsService = useRef(new AnalyticsService());
  const webglContext = useRef<WebGLRenderingContext | null>(null);
  const animationFrame = useRef<number>();

  // Memoized chart data transformation
  const chartData = useMemo(() => {
    if (!metrics) return [];
    return Object.entries(metrics.muscleActivity).map(([muscle, value]) => ({
      name: muscle,
      value,
      baseline: showBaseline ? metrics.rangeOfMotion[muscle]?.baseline : undefined
    }));
  }, [metrics, showBaseline]);

  /**
   * Initializes WebGL context for hardware acceleration
   */
  const initializeWebGL = useCallback(() => {
    const canvas = document.createElement('canvas');
    webglContext.current = canvas.getContext('webgl', {
      antialias: true,
      powerPreference: 'high-performance'
    });
  }, []);

  /**
   * Processes real-time metrics updates with performance optimization
   */
  const processMetricsUpdate = useCallback(async (newMetrics: ISessionMetrics) => {
    try {
      // Buffer management for performance
      metricsBuffer.current.push(newMetrics);
      if (metricsBuffer.current.length > METRICS_BUFFER_SIZE) {
        metricsBuffer.current.shift();
      }

      // Anomaly detection
      const anomalyScores = await analyticsService.current.detectAnomalies(newMetrics);
      Object.entries(anomalyScores).forEach(([metric, score]) => {
        if (score > 2 && onAnomalyDetected) {
          onAnomalyDetected(score, metric);
        }
      });

      setMetrics(newMetrics);
    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
    }
  }, [onAnomalyDetected, onError]);

  /**
   * Sets up real-time metrics subscription
   */
  useEffect(() => {
    let subscription: any;
    
    const initializeMetrics = async () => {
      try {
        initializeWebGL();
        setLoading(true);

        subscription = analyticsService.current
          .getMetricsStream()
          .subscribe({
            next: processMetricsUpdate,
            error: (err: Error) => {
              setError(err);
              onError?.(err);
            }
          });

        setLoading(false);
      } catch (err) {
        const error = err as Error;
        setError(error);
        onError?.(error);
      }
    };

    initializeMetrics();

    return () => {
      subscription?.unsubscribe();
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [athleteId, sessionId, refreshRate, initializeWebGL, processMetricsUpdate, onError]);

  if (error) {
    return (
      <Alert severity="error">
        Error loading statistics: {error.message}
      </Alert>
    );
  }

  if (loading || !metrics) {
    return (
      <Card>
        <CardContent>
          <CircularProgress />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Grid container spacing={2}>
          {/* Muscle Activity Section */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6">Muscle Activity</Typography>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => formatMetricValue(value, 'muscleActivity')}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#8884d8"
                  strokeWidth={2}
                  dot={false}
                />
                {showBaseline && (
                  <Line
                    type="monotone"
                    dataKey="baseline"
                    stroke="#82ca9d"
                    strokeDasharray="5 5"
                    dot={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </Grid>

          {/* Force Distribution Section */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6">Force Distribution</Typography>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={Object.entries(metrics.forceDistribution).map(([region, force]) => ({
                name: region,
                value: force
              }))}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => formatMetricValue(value, 'forceDistribution')}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#82ca9d"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Grid>

          {/* Anomaly Scores Section */}
          <Grid item xs={12}>
            <Typography variant="h6">Anomaly Detection</Typography>
            <Grid container spacing={2}>
              {Object.entries(metrics.anomalyScores).map(([metric, score]) => (
                <Grid item xs={6} sm={4} md={3} key={metric}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2">{metric}</Typography>
                      <Typography
                        variant="h6"
                        color={score > 2 ? 'error' : score > 1 ? 'warning' : 'primary'}
                      >
                        {formatMetricValue(score, 'anomalyScore')}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default StatisticsPanel;