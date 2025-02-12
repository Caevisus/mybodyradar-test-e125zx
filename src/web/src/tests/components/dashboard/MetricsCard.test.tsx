/**
 * @fileoverview Test suite for MetricsCard component
 * Verifies real-time performance metrics display, data updates, heat map visualization,
 * and component interactions with <100ms latency requirements
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, beforeEach, jest, expect } from '@jest/globals';
import MetricsCard from '../../../components/dashboard/MetricsCard';
import { useMetrics } from '../../../hooks/useMetrics';

// Mock the useMetrics hook
jest.mock('../../../hooks/useMetrics');

// Mock WebGL context for heat map testing
const mockWebGLContext = {
  getContext: jest.fn(),
  getExtension: jest.fn(() => ({
    loseContext: jest.fn()
  }))
};

// Test data fixtures
const mockSensorData = {
  sensorId: 'sensor-123',
  timestamp: Date.now(),
  readings: [
    {
      type: 'imu',
      value: [0.5, 0.3, 0.2],
      timestamp: Date.now()
    }
  ],
  metadata: {
    calibrationVersion: '1.0.0',
    processingSteps: ['filtering'],
    quality: 95
  }
};

const mockMetrics = {
  muscleActivity: {
    'quadriceps': 0.85,
    'hamstrings': 0.65
  },
  forceDistribution: {
    'left': 48,
    'right': 52
  },
  rangeOfMotion: {
    'knee': {
      current: 85,
      baseline: 90,
      deviation: 0.05
    }
  },
  anomalyScores: {},
  alertTriggers: {}
};

describe('MetricsCard', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Mock performance.now for timing tests
    jest.spyOn(performance, 'now')
      .mockImplementation(() => Date.now());

    // Mock useMetrics hook with test data
    (useMetrics as jest.Mock).mockReturnValue({
      metrics: mockMetrics,
      heatMap: null,
      isLoading: false,
      error: null,
      performance: {
        latency: 50,
        fps: 60,
        lastUpdate: Date.now()
      }
    });

    // Mock WebGL context
    global.WebGLRenderingContext = jest.fn();
    (global as any).HTMLCanvasElement.prototype.getContext = () => mockWebGLContext;
  });

  it('should render metrics card with initial data', async () => {
    // Render component
    render(
      <MetricsCard
        sessionId="session-123"
        sensorData={mockSensorData}
        title="Performance Metrics"
        showHeatMap={true}
      />
    );

    // Verify Material Design styling
    const card = screen.getByRole('region');
    expect(card).toHaveClass('metrics-card');
    expect(card).toHaveAttribute('aria-label');

    // Check presence of all metric sections
    expect(screen.getByText('Muscle Activity')).toBeInTheDocument();
    expect(screen.getByText('Force Distribution')).toBeInTheDocument();
    expect(screen.getByText('Range of Motion')).toBeInTheDocument();

    // Validate initial data display
    expect(screen.getByText('quadriceps')).toBeInTheDocument();
    expect(screen.getByText(/85%/)).toBeInTheDocument();
    expect(screen.getByText(/48N/)).toBeInTheDocument();
    expect(screen.getByText(/85°/)).toBeInTheDocument();
  });

  it('should update metrics within 100ms', async () => {
    // Start performance timer
    const startTime = performance.now();

    // Render with mock data
    const { rerender } = render(
      <MetricsCard
        sessionId="session-123"
        sensorData={mockSensorData}
        updateInterval={50}
        performanceMode="high"
      />
    );

    // Trigger metrics update
    const updatedMetrics = {
      ...mockMetrics,
      muscleActivity: {
        ...mockMetrics.muscleActivity,
        quadriceps: 0.90
      }
    };

    act(() => {
      (useMetrics as jest.Mock).mockReturnValue({
        metrics: updatedMetrics,
        heatMap: null,
        isLoading: false,
        error: null,
        performance: {
          latency: 45,
          fps: 60,
          lastUpdate: Date.now()
        }
      });
    });

    // Rerender component with updated data
    rerender(
      <MetricsCard
        sessionId="session-123"
        sensorData={mockSensorData}
        updateInterval={50}
        performanceMode="high"
      />
    );

    // Wait for update and verify timing
    await waitFor(() => {
      const updateTime = performance.now() - startTime;
      expect(updateTime).toBeLessThan(100);
      expect(screen.getByText(/90%/)).toBeInTheDocument();
    });
  });

  it('should render heat map visualization', async () => {
    // Mock heat map data
    const mockHeatMap = document.createElement('canvas');
    (useMetrics as jest.Mock).mockReturnValue({
      metrics: mockMetrics,
      heatMap: mockHeatMap,
      isLoading: false,
      error: null,
      performance: {
        latency: 50,
        fps: 60,
        lastUpdate: Date.now()
      }
    });

    // Render with heat map enabled
    render(
      <MetricsCard
        sessionId="session-123"
        sensorData={mockSensorData}
        showHeatMap={true}
        webGLConfig={{
          antialias: true,
          powerPreference: 'high-performance'
        }}
      />
    );

    // Verify heat map canvas
    const heatMapCanvas = screen.getByRole('img', { hidden: true });
    expect(heatMapCanvas).toBeInTheDocument();
    expect(heatMapCanvas).toHaveAttribute('width', '400');
    expect(heatMapCanvas).toHaveAttribute('height', '300');
  });

  it('should handle error states gracefully', async () => {
    // Mock error state
    (useMetrics as jest.Mock).mockReturnValue({
      metrics: null,
      heatMap: null,
      isLoading: false,
      error: new Error('Failed to load metrics'),
      performance: {
        latency: 0,
        fps: 0,
        lastUpdate: Date.now()
      }
    });

    // Mock error handler
    const onError = jest.fn();

    render(
      <MetricsCard
        sessionId="session-123"
        sensorData={mockSensorData}
        onError={onError}
      />
    );

    // Verify error display
    expect(screen.getByText('Error Loading Metrics')).toBeInTheDocument();
    expect(onError).toHaveBeenCalled();
  });

  it('should display loading state', async () => {
    // Mock loading state
    (useMetrics as jest.Mock).mockReturnValue({
      metrics: null,
      heatMap: null,
      isLoading: true,
      error: null,
      performance: {
        latency: 0,
        fps: 0,
        lastUpdate: Date.now()
      }
    });

    render(
      <MetricsCard
        sessionId="session-123"
        sensorData={mockSensorData}
      />
    );

    // Verify loading indicator
    expect(screen.getByText('Loading metrics...')).toBeInTheDocument();
  });

  it('should handle performance mode changes', async () => {
    const { rerender } = render(
      <MetricsCard
        sessionId="session-123"
        sensorData={mockSensorData}
        performanceMode="high"
      />
    );

    // Change to balanced mode
    rerender(
      <MetricsCard
        sessionId="session-123"
        sensorData={mockSensorData}
        performanceMode="balanced"
      />
    );

    // Verify performance metrics
    await waitFor(() => {
      const performanceIndicator = screen.getByText(/50ms/);
      expect(performanceIndicator).toBeInTheDocument();
    });
  });
});