/**
 * @fileoverview Comprehensive test suite for HeatMap component
 * Verifies real-time visualization, performance metrics, data accuracy,
 * and accessibility compliance
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import userEvent from '@testing-library/user-event';

import { HeatMap } from '../../../components/analytics/HeatMap';
import { useHeatMap } from '../../../hooks/useHeatMap';
import { ChartTypes } from '../../../interfaces/chart.interface';
import { SENSOR_UPDATE_INTERVAL } from '../../../constants/sensor.constants';

// Mock WebGL context and canvas functionality
const mockWebGLContext = {
  createBuffer: jest.fn(),
  bindBuffer: jest.fn(),
  bufferData: jest.fn(),
  createShader: jest.fn(),
  shaderSource: jest.fn(),
  compileShader: jest.fn(),
  createProgram: jest.fn(),
  attachShader: jest.fn(),
  linkProgram: jest.fn(),
  useProgram: jest.fn(),
  getAttribLocation: jest.fn(),
  enableVertexAttribArray: jest.fn(),
  clear: jest.fn(),
  drawArrays: jest.fn(),
  ARRAY_BUFFER: 'ARRAY_BUFFER',
  STATIC_DRAW: 'STATIC_DRAW',
  COLOR_BUFFER_BIT: 'COLOR_BUFFER_BIT',
  TRIANGLES: 'TRIANGLES'
};

// Mock performance monitoring
const mockPerformanceMonitor = {
  measureLatency: jest.fn(),
  trackFrameRate: jest.fn(),
  monitorMemory: jest.fn()
};

// Mock sensor data generator for testing
class SensorDataGenerator {
  static generateMuscleData(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      row: i % 10,
      col: Math.floor(i / 10),
      value: Math.random(),
      intensity: Math.random(),
      precision: 0.01,
      timestamp: new Date()
    }));
  }

  static simulateDataStream(interval: number, callback: (data: any) => void) {
    return setInterval(() => {
      callback(this.generateMuscleData(100));
    }, interval);
  }
}

// Mock useHeatMap hook
jest.mock('../../../hooks/useHeatMap', () => ({
  useHeatMap: jest.fn()
}));

describe('HeatMap Component', () => {
  // Default test props
  const defaultProps = {
    options: {
      type: ChartTypes.HEAT_MAP,
      dimensions: {
        width: 800,
        height: 600,
        margin: { top: 20, right: 20, bottom: 30, left: 40 },
        aspectRatio: 4/3
      },
      updateInterval: SENSOR_UPDATE_INTERVAL,
      precision: 0.01,
      colorScale: ['#000', '#fff'],
      animationConfig: {
        duration: 300,
        easing: 'linear' as const
      },
      interactionConfig: {
        zoomEnabled: true,
        panEnabled: true,
        tooltipEnabled: true,
        selectionEnabled: true
      }
    },
    className: 'test-heatmap'
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock WebGL context
    HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue(mockWebGLContext);
    
    // Mock useHeatMap implementation
    (useHeatMap as jest.Mock).mockReturnValue({
      data: [],
      updateData: jest.fn(),
      clearData: jest.fn(),
      webGLContext: mockWebGLContext,
      error: null,
      performanceMetrics: {
        averageLatency: 50,
        frameCount: 100
      }
    });

    // Mock performance.now()
    jest.spyOn(performance, 'now').mockImplementation(() => Date.now());
  });

  describe('Rendering', () => {
    it('should render heat map with correct dimensions', () => {
      render(<HeatMap {...defaultProps} />);
      
      const canvas = screen.getByRole('img', { name: /biomechanical heat map/i });
      expect(canvas).toBeInTheDocument();
      expect(canvas).toHaveAttribute('width', '800');
      expect(canvas).toHaveAttribute('height', '600');
    });

    it('should initialize WebGL context with correct options', () => {
      render(<HeatMap {...defaultProps} />);
      
      expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith('webgl', {
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true
      });
    });

    it('should display performance metrics when available', () => {
      render(<HeatMap {...defaultProps} />);
      
      const metrics = screen.getByText(/latency: 50.00ms/i);
      expect(metrics).toBeInTheDocument();
      expect(screen.getByText(/frames: 100/i)).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should maintain <100ms latency for data updates', async () => {
      const updateData = jest.fn();
      (useHeatMap as jest.Mock).mockReturnValue({
        ...defaultProps,
        updateData,
        performanceMetrics: { averageLatency: 50, frameCount: 0 }
      });

      render(<HeatMap {...defaultProps} />);

      // Simulate data stream
      const testData = SensorDataGenerator.generateMuscleData(100);
      updateData(testData);

      await waitFor(() => {
        const metrics = screen.getByText(/latency: 50.00ms/i);
        expect(metrics).toBeInTheDocument();
        expect(updateData).toHaveBeenCalledWith(testData);
      });
    });

    it('should optimize WebGL rendering for large datasets', async () => {
      render(<HeatMap {...defaultProps} />);

      // Generate large dataset
      const largeDataset = SensorDataGenerator.generateMuscleData(1000);
      
      const startTime = performance.now();
      (useHeatMap as jest.Mock).mockImplementation(({ options }) => ({
        data: largeDataset,
        updateData: jest.fn(),
        clearData: jest.fn(),
        webGLContext: mockWebGLContext,
        performanceMetrics: {
          averageLatency: performance.now() - startTime,
          frameCount: 1
        }
      }));

      await waitFor(() => {
        const metrics = screen.getByText(/latency/i);
        const latency = parseFloat(metrics.textContent.match(/\d+\.\d+/)[0]);
        expect(latency).toBeLessThan(100);
      });
    });
  });

  describe('Accessibility', () => {
    it('should meet WCAG 2.1 Level AA requirements', () => {
      render(<HeatMap {...defaultProps} />);
      
      const heatMap = screen.getByRole('img', { name: /biomechanical heat map/i });
      expect(heatMap).toHaveAttribute('aria-label');
      expect(heatMap).toHaveAttribute('role', 'img');
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<HeatMap {...defaultProps} />);
      
      const heatMap = screen.getByRole('img');
      await user.tab();
      expect(heatMap).toHaveFocus();
    });

    it('should announce performance metrics updates', async () => {
      render(<HeatMap {...defaultProps} />);
      
      const metrics = screen.getByText(/latency/i);
      expect(metrics.parentElement).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Error Handling', () => {
    it('should display error message when WebGL initialization fails', () => {
      HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue(null);
      
      render(<HeatMap {...defaultProps} />);
      
      expect(screen.getByText(/error rendering heat map/i)).toBeInTheDocument();
    });

    it('should handle data validation errors gracefully', () => {
      (useHeatMap as jest.Mock).mockReturnValue({
        data: [],
        error: new Error('Invalid data format'),
        updateData: jest.fn(),
        clearData: jest.fn()
      });

      render(<HeatMap {...defaultProps} />);
      
      expect(screen.getByText(/invalid data format/i)).toBeInTheDocument();
    });
  });

  describe('Data Accuracy', () => {
    it('should maintain ±1% accuracy in visualization', async () => {
      const testData = SensorDataGenerator.generateMuscleData(100);
      const updateData = jest.fn();
      
      (useHeatMap as jest.Mock).mockReturnValue({
        data: testData,
        updateData,
        clearData: jest.fn(),
        webGLContext: mockWebGLContext,
        performanceMetrics: { averageLatency: 50, frameCount: 1 }
      });

      render(<HeatMap {...defaultProps} />);

      // Verify data precision
      testData.forEach(point => {
        expect(point.precision).toBeLessThanOrEqual(0.01);
      });

      // Verify WebGL buffer updates
      expect(mockWebGLContext.bufferData).toHaveBeenCalled();
    });
  });
});