import { renderHook, act } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { useSensor } from '../../hooks/useSensor';
import { SensorService } from '../../services/sensor.service';
import { SENSOR_TYPES, SENSOR_STATUS, CALIBRATION_PARAMS } from '../../constants/sensor.constants';
import type { ISensorConfig, ISensorData, ISensorCalibrationParams } from '../../interfaces/sensor.interface';

// Mock SensorService
jest.mock('../../services/sensor.service', () => ({
  configureSensor: jest.fn(),
  startDataCollection: jest.fn(),
  stopDataCollection: jest.fn(),
  calibrateSensor: jest.fn(),
  getSensorData: jest.fn(),
  getSensorStatus: jest.fn()
}));

describe('useSensor Hook', () => {
  // Test configuration matching technical specifications
  const mockConfig: ISensorConfig = {
    id: 'test-sensor-001',
    type: SENSOR_TYPES.IMU,
    samplingRate: 200, // IMU 200Hz requirement
    calibrationParams: {
      tofGain: CALIBRATION_PARAMS.tofGainRange.default,
      imuDriftCorrection: CALIBRATION_PARAMS.imuDriftCorrection.default,
      pressureThreshold: CALIBRATION_PARAMS.pressureThreshold.default,
      sampleWindow: CALIBRATION_PARAMS.sampleWindow.default,
      filterCutoff: CALIBRATION_PARAMS.filterCutoff.default
    },
    lastCalibration: new Date(),
    batteryLevel: 100,
    status: SENSOR_STATUS.DISCONNECTED
  };

  // Mock sensor data matching interface requirements
  const mockSensorData: ISensorData = {
    sensorId: 'test-sensor-001',
    timestamp: Date.now(),
    readings: [{
      type: SENSOR_TYPES.IMU,
      value: [0.1, 0.2, 0.3],
      timestamp: Date.now()
    }],
    metadata: {
      calibrationVersion: '1.0.0',
      processingSteps: ['filtering', 'normalization'],
      quality: 98
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup mock implementations
    (SensorService.getSensorData as jest.Mock).mockReturnValue({
      subscribe: (callback: (data: ISensorData[]) => void) => {
        callback([mockSensorData]);
        return () => {};
      }
    });
    (SensorService.getSensorStatus as jest.Mock).mockResolvedValue(SENSOR_STATUS.DISCONNECTED);
  });

  describe('Initialization', () => {
    it('should initialize with correct default state', async () => {
      const { result } = renderHook(() => useSensor(mockConfig));

      await waitFor(() => {
        expect(result.current.sensorData).toEqual([]);
        expect(result.current.sensorStatus.get(mockConfig.id)).toBe(SENSOR_STATUS.DISCONNECTED);
        expect(result.current.sensorErrors.size).toBe(0);
      });
    });

    it('should validate sensor configuration on initialization', async () => {
      const invalidConfig = { ...mockConfig, samplingRate: 100 }; // Invalid for IMU
      
      const { result } = renderHook(() => useSensor(invalidConfig));
      
      await waitFor(() => {
        expect(result.current.sensorErrors.get(invalidConfig.id)).toBeTruthy();
      });
    });
  });

  describe('Sensor Operations', () => {
    it('should start sensor data collection', async () => {
      const { result } = renderHook(() => useSensor(mockConfig));

      await act(async () => {
        await result.current.startSensor(mockConfig.id);
      });

      expect(SensorService.startDataCollection).toHaveBeenCalledWith(mockConfig.id);
      expect(result.current.sensorStatus.get(mockConfig.id)).toBe(SENSOR_STATUS.ACTIVE);
    });

    it('should stop sensor data collection', async () => {
      const { result } = renderHook(() => useSensor(mockConfig));

      await act(async () => {
        await result.current.stopSensor(mockConfig.id);
      });

      expect(SensorService.stopDataCollection).toHaveBeenCalledWith(mockConfig.id);
      expect(result.current.sensorStatus.get(mockConfig.id)).toBe(SENSOR_STATUS.DISCONNECTED);
    });

    it('should handle sensor errors gracefully', async () => {
      (SensorService.startDataCollection as jest.Mock).mockRejectedValue(new Error('Connection failed'));
      
      const { result } = renderHook(() => useSensor(mockConfig));

      await act(async () => {
        try {
          await result.current.startSensor(mockConfig.id);
        } catch (error) {
          // Error expected
        }
      });

      expect(result.current.sensorErrors.get(mockConfig.id)).toBeTruthy();
    });
  });

  describe('Calibration', () => {
    const mockCalibrationParams: ISensorCalibrationParams = {
      tofGain: 8,
      imuDriftCorrection: 0.5,
      pressureThreshold: 1.0,
      sampleWindow: 100,
      filterCutoff: 2.0
    };

    it('should perform sensor calibration', async () => {
      const { result } = renderHook(() => useSensor(mockConfig));

      await act(async () => {
        await result.current.calibrateSensor(mockConfig.id, mockCalibrationParams);
      });

      expect(SensorService.calibrateSensor).toHaveBeenCalledWith(
        mockConfig.id,
        mockCalibrationParams
      );
      expect(result.current.sensorStatus.get(mockConfig.id)).toBe(SENSOR_STATUS.ACTIVE);
    });

    it('should validate calibration parameters', async () => {
      const invalidParams = { ...mockCalibrationParams, tofGain: 20 }; // Outside valid range
      const { result } = renderHook(() => useSensor(mockConfig));

      await act(async () => {
        try {
          await result.current.calibrateSensor(mockConfig.id, invalidParams);
        } catch (error) {
          // Error expected
        }
      });

      expect(result.current.sensorErrors.get(mockConfig.id)).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('should meet <100ms latency requirement', async () => {
      const startTime = performance.now();
      const { result } = renderHook(() => useSensor(mockConfig));

      await act(async () => {
        await result.current.startSensor(mockConfig.id);
      });

      const latency = performance.now() - startTime;
      expect(latency).toBeLessThan(100);
    });

    it('should handle high-frequency data streams', async () => {
      const highFrequencyData: ISensorData[] = Array(200).fill(mockSensorData); // 200Hz data
      (SensorService.getSensorData as jest.Mock).mockReturnValue({
        subscribe: (callback: (data: ISensorData[]) => void) => {
          callback(highFrequencyData);
          return () => {};
        }
      });

      const { result } = renderHook(() => useSensor(mockConfig));

      await waitFor(() => {
        expect(result.current.sensorData.length).toBe(200);
        expect(result.current.sensorMetrics.dataRate).toBeGreaterThanOrEqual(200);
      });
    });

    it('should maintain performance under load', async () => {
      const { result } = renderHook(() => useSensor(mockConfig));
      const operations = Array(100).fill(null);

      const startTime = performance.now();
      await act(async () => {
        await Promise.all(operations.map(() => result.current.startSensor(mockConfig.id)));
      });

      const averageLatency = (performance.now() - startTime) / operations.length;
      expect(averageLatency).toBeLessThan(100);
    });
  });

  describe('Error Handling', () => {
    it('should reset errors correctly', async () => {
      const { result } = renderHook(() => useSensor(mockConfig));

      await act(async () => {
        try {
          await result.current.startSensor(mockConfig.id);
        } catch (error) {
          // Error expected
        }
      });

      act(() => {
        result.current.resetErrors(mockConfig.id);
      });

      expect(result.current.sensorErrors.get(mockConfig.id)).toBeUndefined();
    });

    it('should handle concurrent operation errors', async () => {
      const { result } = renderHook(() => useSensor(mockConfig));

      await act(async () => {
        const promises = [
          result.current.startSensor(mockConfig.id),
          result.current.startSensor(mockConfig.id)
        ];
        await Promise.all(promises.map(p => p.catch(() => {})));
      });

      expect(result.current.sensorErrors.get(mockConfig.id)).toBeTruthy();
    });
  });
});