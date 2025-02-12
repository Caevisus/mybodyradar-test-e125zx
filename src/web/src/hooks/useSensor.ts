/**
 * @fileoverview Custom React hook for managing sensor interactions and real-time data streaming
 * Implements comprehensive sensor management with <100ms latency requirement
 * @version 1.0.0
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  configureSensor, 
  startDataCollection, 
  stopDataCollection, 
  calibrateSensor,
  getSensorData,
  getSensorStatus
} from '../services/sensor.service';
import { 
  ISensorConfig, 
  ISensorData, 
  ISensorCalibrationParams,
  ISensorMetadata 
} from '../interfaces/sensor.interface';
import { 
  SENSOR_TYPES, 
  SENSOR_STATUS,
  CALIBRATION_PARAMS,
  SENSOR_UPDATE_INTERVAL 
} from '../constants/sensor.constants';

interface SensorState {
  data: ISensorData[];
  status: Map<string, SENSOR_STATUS>;
  errors: Map<string, Error>;
  metadata: Map<string, ISensorMetadata>;
  metrics: {
    latency: number;
    dataRate: number;
    bufferUsage: number;
    lastUpdate: Date;
  };
}

interface SensorHookReturn {
  sensorData: ISensorData[];
  sensorStatus: Map<string, SENSOR_STATUS>;
  sensorErrors: Map<string, Error>;
  sensorMetrics: SensorState['metrics'];
  startSensor: (sensorId: string) => Promise<void>;
  stopSensor: (sensorId: string) => Promise<void>;
  calibrateSensor: (sensorId: string, params: ISensorCalibrationParams) => Promise<void>;
  resetErrors: (sensorId: string) => void;
}

/**
 * Custom hook for managing sensor operations with comprehensive error handling
 * and performance optimization
 */
export function useSensor(config: ISensorConfig): SensorHookReturn {
  // Initialize state with comprehensive sensor management
  const [state, setState] = useState<SensorState>({
    data: [],
    status: new Map(),
    errors: new Map(),
    metadata: new Map(),
    metrics: {
      latency: 0,
      dataRate: 0,
      bufferUsage: 0,
      lastUpdate: new Date()
    }
  });

  /**
   * Validates sensor configuration against technical specifications
   */
  const validateConfig = useCallback((config: ISensorConfig): void => {
    if (!config.id || !config.type) {
      throw new Error('Invalid sensor configuration: missing required fields');
    }

    const requiredRate = config.type === SENSOR_TYPES.IMU ? 200 : 100;
    if (config.samplingRate !== requiredRate) {
      throw new Error(`Invalid sampling rate for ${config.type}: ${config.samplingRate}Hz`);
    }

    // Validate calibration parameters
    const { calibrationParams } = config;
    if (calibrationParams.tofGain < CALIBRATION_PARAMS.tofGainRange.min || 
        calibrationParams.tofGain > CALIBRATION_PARAMS.tofGainRange.max) {
      throw new Error(`Invalid ToF gain: ${calibrationParams.tofGain}`);
    }
  }, []);

  /**
   * Initializes sensor with error handling and performance monitoring
   */
  useEffect(() => {
    let isActive = true;
    let dataSubscription: (() => void) | null = null;

    const initializeSensor = async () => {
      try {
        validateConfig(config);
        
        // Configure sensor with validated parameters
        await configureSensor(config);
        
        // Subscribe to sensor data stream
        dataSubscription = getSensorData().subscribe(
          (data: ISensorData[]) => {
            if (!isActive) return;
            
            const now = new Date();
            setState(prev => ({
              ...prev,
              data,
              metrics: {
                ...prev.metrics,
                latency: now.getTime() - data[data.length - 1]?.timestamp || 0,
                dataRate: data.length / (SENSOR_UPDATE_INTERVAL / 1000),
                bufferUsage: (data.length / config.bufferSize) * 100,
                lastUpdate: now
              }
            }));
          },
          (error: Error) => {
            setState(prev => {
              const errors = new Map(prev.errors);
              errors.set(config.id, error);
              return { ...prev, errors };
            });
          }
        );

        // Initialize status monitoring
        const status = await getSensorStatus(config.id);
        setState(prev => {
          const statusMap = new Map(prev.status);
          statusMap.set(config.id, status);
          return { ...prev, status: statusMap };
        });

      } catch (error) {
        setState(prev => {
          const errors = new Map(prev.errors);
          errors.set(config.id, error as Error);
          return { ...prev, errors };
        });
      }
    };

    initializeSensor();

    // Cleanup subscriptions and monitoring
    return () => {
      isActive = false;
      if (dataSubscription) {
        dataSubscription();
      }
    };
  }, [config, validateConfig]);

  /**
   * Starts sensor data collection with error handling
   */
  const startSensor = useCallback(async (sensorId: string): Promise<void> => {
    try {
      await startDataCollection(sensorId);
      setState(prev => {
        const statusMap = new Map(prev.status);
        statusMap.set(sensorId, SENSOR_STATUS.ACTIVE);
        return { ...prev, status: statusMap };
      });
    } catch (error) {
      setState(prev => {
        const errors = new Map(prev.errors);
        errors.set(sensorId, error as Error);
        return { ...prev, errors };
      });
      throw error;
    }
  }, []);

  /**
   * Stops sensor data collection with cleanup
   */
  const stopSensor = useCallback(async (sensorId: string): Promise<void> => {
    try {
      await stopDataCollection(sensorId);
      setState(prev => {
        const statusMap = new Map(prev.status);
        statusMap.set(sensorId, SENSOR_STATUS.DISCONNECTED);
        return { ...prev, status: statusMap };
      });
    } catch (error) {
      setState(prev => {
        const errors = new Map(prev.errors);
        errors.set(sensorId, error as Error);
        return { ...prev, errors };
      });
      throw error;
    }
  }, []);

  /**
   * Performs sensor calibration with parameter validation
   */
  const calibrateSensor = useCallback(async (
    sensorId: string, 
    params: ISensorCalibrationParams
  ): Promise<void> => {
    try {
      setState(prev => {
        const statusMap = new Map(prev.status);
        statusMap.set(sensorId, SENSOR_STATUS.CALIBRATING);
        return { ...prev, status: statusMap };
      });

      await calibrateSensor(sensorId, params);

      setState(prev => {
        const statusMap = new Map(prev.status);
        statusMap.set(sensorId, SENSOR_STATUS.ACTIVE);
        return { ...prev, status: statusMap };
      });
    } catch (error) {
      setState(prev => {
        const errors = new Map(prev.errors);
        errors.set(sensorId, error as Error);
        return { ...prev, errors };
      });
      throw error;
    }
  }, []);

  /**
   * Resets error state for specified sensor
   */
  const resetErrors = useCallback((sensorId: string): void => {
    setState(prev => {
      const errors = new Map(prev.errors);
      errors.delete(sensorId);
      return { ...prev, errors };
    });
  }, []);

  return {
    sensorData: state.data,
    sensorStatus: state.status,
    sensorErrors: state.errors,
    sensorMetrics: state.metrics,
    startSensor,
    stopSensor,
    calibrateSensor,
    resetErrors
  };
}