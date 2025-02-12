/**
 * @fileoverview Test suite for useHeatMap custom React hook
 * Verifies heat map visualization functionality, real-time performance,
 * and accuracy requirements for sensor data visualization
 * @version 1.0.0
 */

import { renderHook, act, waitFor } from '@testing-library/react'; // ^14.0.0
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'; // ^29.0.0
import { performance } from 'perf_hooks';

import { useHeatMap } from '../../hooks/useHeatMap';
import { analyticsService } from '../../services/analytics.service';
import type { HeatMapData } from '../../interfaces/chart.interface';

// Mock WebGL context and functions
const mockWebGLContext = {
  createShader: jest.fn(() => ({ /* shader mock */ })),
  createProgram: jest.fn(() => ({ /* program mock */ })),
  shaderSource: jest.fn(),
  compileShader: jest.fn(),
  attachShader: jest.fn(),
  linkProgram: jest.fn(),
  useProgram: jest.fn(),
  getAttribLocation: jest.fn(),
  createBuffer: jest.fn(),
  bindBuffer: jest.fn(),
  bufferData: jest.fn(),
  enableVertexAttribArray: jest.fn(),
  clear: jest.fn(),
  drawArrays: jest.fn(),
  getExtension: jest.fn(() => ({
    loseContext: jest.fn()
  }))
};

// Mock analytics service
jest.mock('../../services/analytics.service', () => ({
  analyticsService: {
    generateHeatMap: jest.fn(),
    normalizeData: jest.fn()
  }
}));

describe('useHeatMap', () => {
  // Test configuration
  const mockOptions = {
    type: 'heatmap',
    dimensions: {
      width: 800,
      height: 600,
      margin: { top: 20, right: 20, bottom: 20, left: 20 },
      aspectRatio: 1.33
    },
    updateInterval: 100,
    precision: 2,
    colorScale: ['#ff0000', '#00ff00', '#0000ff']
  };

  // Sample test data
  const mockHeatMapData: HeatMapData[] = Array.from({ length: 100 }, (_, i) => ({
    x: Math.random() * 800,
    y: Math.random() * 600,
    value: Math.random(),
    timestamp: Date.now() + i
  }));

  beforeEach(() => {
    // Setup WebGL mock
    HTMLCanvasElement.prototype.getContext = jest.fn(() => mockWebGLContext);
    
    // Reset analytics service mocks
    jest.clearAllMocks();
    
    // Mock performance API
    jest.spyOn(performance, 'now').mockImplementation(() => Date.now());
    
    // Reset WebGL context
    Object.values(mockWebGLContext).forEach(mock => {
      if (jest.isMockFunction(mock)) {
        mock.mockClear();
      }
    });
  });

  afterEach(() => {
    // Cleanup
    jest.restoreAllMocks();
  });

  it('should initialize with WebGL context', async () => {
    const { result } = renderHook(() => useHeatMap(mockOptions));

    await waitFor(() => {
      expect(result.current.webGLContext).toBeTruthy();
      expect(mockWebGLContext.createProgram).toHaveBeenCalled();
      expect(mockWebGLContext.createShader).toHaveBeenCalledTimes(2);
      expect(mockWebGLContext.linkProgram).toHaveBeenCalled();
    });
  });

  it('should update data within latency requirements (<100ms)', async () => {
    const { result } = renderHook(() => useHeatMap(mockOptions));

    // Wait for initialization
    await waitFor(() => expect(result.current.webGLContext).toBeTruthy());

    const startTime = performance.now();

    await act(async () => {
      result.current.updateData(mockHeatMapData);
    });

    const endTime = performance.now();
    const updateLatency = endTime - startTime;

    expect(updateLatency).toBeLessThan(100);
    expect(result.current.performanceMetrics.averageLatency).toBeLessThan(100);
  });

  it('should maintain data accuracy within ±1%', async () => {
    const { result } = renderHook(() => useHeatMap(mockOptions));

    // Generate reference data with known values
    const referenceData: HeatMapData[] = Array.from({ length: 10 }, (_, i) => ({
      x: i * 80,
      y: i * 60,
      value: i / 10,
      timestamp: Date.now() + i
    }));

    await act(async () => {
      result.current.updateData(referenceData);
    });

    // Verify data accuracy
    result.current.data.forEach((dataPoint, index) => {
      const reference = referenceData[index];
      const deviation = Math.abs((dataPoint.value - reference.value) / reference.value);
      expect(deviation).toBeLessThanOrEqual(0.01); // 1% tolerance
    });
  });

  it('should handle large datasets efficiently', async () => {
    const { result } = renderHook(() => useHeatMap(mockOptions));

    // Generate large dataset (1000 points)
    const largeDataset: HeatMapData[] = Array.from({ length: 1000 }, (_, i) => ({
      x: Math.random() * 800,
      y: Math.random() * 600,
      value: Math.random(),
      timestamp: Date.now() + i
    }));

    const startTime = performance.now();

    await act(async () => {
      result.current.updateData(largeDataset);
    });

    const endTime = performance.now();
    const processingTime = endTime - startTime;

    expect(processingTime).toBeLessThan(100);
    expect(result.current.performanceMetrics.frameCount).toBeGreaterThan(0);
  });

  it('should clear data and WebGL resources properly', async () => {
    const { result } = renderHook(() => useHeatMap(mockOptions));

    await act(async () => {
      result.current.updateData(mockHeatMapData);
    });

    await act(async () => {
      result.current.clearData();
    });

    expect(result.current.data).toHaveLength(0);
    expect(mockWebGLContext.clear).toHaveBeenCalled();
  });

  it('should handle WebGL context loss gracefully', async () => {
    const { result } = renderHook(() => useHeatMap(mockOptions));

    // Simulate WebGL context loss
    await act(async () => {
      const contextLost = new Event('webglcontextlost');
      result.current.canvasRef.current?.dispatchEvent(contextLost);
    });

    expect(result.current.error).toBeTruthy();
    expect(mockWebGLContext.getExtension).toHaveBeenCalledWith('WEBGL_lose_context');
  });

  it('should debounce rapid updates according to updateInterval', async () => {
    const { result } = renderHook(() => useHeatMap(mockOptions));

    const updateCalls = [];
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        result.current.updateData(mockHeatMapData);
      });
      updateCalls.push(performance.now());
    }

    // Verify minimum time between updates
    for (let i = 1; i < updateCalls.length; i++) {
      const timeDiff = updateCalls[i] - updateCalls[i - 1];
      expect(timeDiff).toBeGreaterThanOrEqual(mockOptions.updateInterval);
    }
  });
});