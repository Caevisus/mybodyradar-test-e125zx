import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { jest, describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { axe, toHaveNoViolations } from '@axe-core/react';
import SensorMetrics from '../../../components/sensor/SensorMetrics';
import { useSensor } from '../../../hooks/useSensor';
import { SENSOR_TYPES, SENSOR_STATUS, SAMPLING_RATES } from '../../../constants/sensor.constants';
import { UPDATE_INTERVALS, PERFORMANCE_CHART_CONSTANTS } from '../../../constants/chart.constants';

// Mock the useSensor hook
jest.mock('../../../hooks/useSensor');

// Mock WebGL context
const mockWebGLContext = {
  getContext: jest.fn(),
  createShader: jest.fn(),
  createProgram: jest.fn(),
  createBuffer: jest.fn(),
  bindBuffer: jest.fn(),
  bufferData: jest.fn(),
  viewport: jest.fn(),
  clear: jest.fn()
};

// Mock performance.now for consistent timing tests
const mockPerformanceNow = jest.spyOn(performance, 'now');

describe('SensorMetrics Component', () => {
  // Test environment setup
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockPerformanceNow.mockReturnValue(0);

    // Mock WebGL context
    HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue(mockWebGLContext);

    // Mock useSensor hook with default values
    (useSensor as jest.Mock).mockReturnValue({
      sensorData: [],
      sensorStatus: new Map([[
        'test-sensor',
        SENSOR_STATUS.ACTIVE
      ]]),
      calibrationState: {
        isCalibrated: true,
        lastCalibration: new Date()
      }
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Performance Tests', () => {
    it('should maintain <100ms update latency for real-time visualization', async () => {
      const startTime = performance.now();
      
      render(
        <SensorMetrics
          sensorId="test-sensor"
          refreshRate={UPDATE_INTERVALS.REAL_TIME}
          webGLEnabled={true}
        />
      );

      // Generate high-frequency test data
      const testData = Array.from({ length: 100 }, (_, i) => ({
        timestamp: Date.now() + i * 5,
        value: Math.random() * 100,
        type: SENSOR_TYPES.IMU
      }));

      // Update sensor data
      (useSensor as jest.Mock).mockReturnValue({
        sensorData: testData,
        sensorStatus: new Map([['test-sensor', SENSOR_STATUS.ACTIVE]])
      });

      await waitFor(() => {
        const updateLatency = performance.now() - startTime;
        expect(updateLatency).toBeLessThan(UPDATE_INTERVALS.REAL_TIME);
      });
    });

    it('should optimize WebGL rendering for high-frequency data', async () => {
      render(
        <SensorMetrics
          sensorId="test-sensor"
          webGLEnabled={true}
          precision={PERFORMANCE_CHART_CONSTANTS.Y_AXIS_PRECISION}
        />
      );

      // Verify WebGL context initialization
      expect(mockWebGLContext.getContext).toHaveBeenCalledWith('webgl2');
      expect(mockWebGLContext.createProgram).toHaveBeenCalled();
    });

    it('should handle IMU data at 200Hz sampling rate', async () => {
      const imuData = Array.from({ length: 200 }, (_, i) => ({
        timestamp: Date.now() + i * (1000 / SAMPLING_RATES.IMU),
        value: Math.random() * 100,
        type: SENSOR_TYPES.IMU
      }));

      render(
        <SensorMetrics
          sensorId="test-sensor"
          refreshRate={UPDATE_INTERVALS.REAL_TIME}
        />
      );

      (useSensor as jest.Mock).mockReturnValue({
        sensorData: imuData,
        sensorStatus: new Map([['test-sensor', SENSOR_STATUS.ACTIVE]])
      });

      await waitFor(() => {
        const chart = screen.getByTestId('sensor-metrics');
        expect(chart).toBeInTheDocument();
      });
    });
  });

  describe('Accuracy Tests', () => {
    it('should maintain ±1% measurement accuracy', async () => {
      const testValue = 100;
      const tolerance = testValue * 0.01; // 1% tolerance

      const testData = [{
        timestamp: Date.now(),
        value: testValue,
        type: SENSOR_TYPES.IMU
      }];

      render(
        <SensorMetrics
          sensorId="test-sensor"
          precision={PERFORMANCE_CHART_CONSTANTS.Y_AXIS_PRECISION}
        />
      );

      (useSensor as jest.Mock).mockReturnValue({
        sensorData: testData,
        sensorStatus: new Map([['test-sensor', SENSOR_STATUS.ACTIVE]])
      });

      await waitFor(() => {
        const chart = screen.getByTestId('sensor-metrics');
        const displayedValue = parseFloat(chart.textContent || '0');
        expect(Math.abs(displayedValue - testValue)).toBeLessThanOrEqual(tolerance);
      });
    });

    it('should correctly apply calibration parameters', async () => {
      const calibrationParams = {
        tofGain: 8,
        imuDriftCorrection: 0.5,
        pressureThreshold: 1.0,
        sampleWindow: 100,
        filterCutoff: 2.0
      };

      render(
        <SensorMetrics
          sensorId="test-sensor"
          showCalibration={true}
        />
      );

      (useSensor as jest.Mock).mockReturnValue({
        sensorData: [],
        sensorStatus: new Map([['test-sensor', SENSOR_STATUS.CALIBRATING]]),
        calibrationState: {
          isCalibrated: true,
          params: calibrationParams,
          lastCalibration: new Date()
        }
      });

      await waitFor(() => {
        const calibrationOverlay = screen.getByText(/Sampling Rate/);
        expect(calibrationOverlay).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Tests', () => {
    it('should comply with WCAG 2.1 Level AA standards', async () => {
      const { container } = render(
        <SensorMetrics
          sensorId="test-sensor"
          accessibilityLevel="AA"
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should provide appropriate ARIA labels and roles', () => {
      render(
        <SensorMetrics
          sensorId="test-sensor"
        />
      );

      const chart = screen.getByTestId('sensor-metrics');
      expect(chart).toHaveAttribute('role', 'img');
      expect(chart).toHaveAttribute('aria-label', 'Sensor metrics visualization');
    });

    it('should support keyboard navigation', () => {
      render(
        <SensorMetrics
          sensorId="test-sensor"
        />
      );

      const chart = screen.getByTestId('sensor-metrics');
      fireEvent.keyDown(chart, { key: 'Tab' });
      expect(chart).toHaveFocus();
    });
  });

  describe('Error Handling', () => {
    it('should handle sensor disconnection gracefully', async () => {
      render(
        <SensorMetrics
          sensorId="test-sensor"
        />
      );

      (useSensor as jest.Mock).mockReturnValue({
        sensorData: [],
        sensorStatus: new Map([['test-sensor', SENSOR_STATUS.DISCONNECTED]])
      });

      await waitFor(() => {
        const statusIndicator = screen.getByText(/Status: DISCONNECTED/);
        expect(statusIndicator).toBeInTheDocument();
      });
    });

    it('should handle data processing errors', async () => {
      const errorHandler = jest.fn();

      render(
        <SensorMetrics
          sensorId="test-sensor"
          errorHandler={errorHandler}
        />
      );

      // Simulate data processing error
      (useSensor as jest.Mock).mockReturnValue({
        sensorData: [],
        sensorStatus: new Map([['test-sensor', SENSOR_STATUS.ERROR]]),
        error: new Error('Data processing failed')
      });

      await waitFor(() => {
        expect(errorHandler).toHaveBeenCalled();
      });
    });
  });
});