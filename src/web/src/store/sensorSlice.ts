/**
 * @fileoverview Redux slice for managing sensor state in the smart-apparel web application
 * Implements real-time data processing, sensor configuration, and calibration management
 * with comprehensive error handling and state tracking.
 * @version 1.0.0
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.0
import { 
  ISensorConfig, 
  ISensorCalibrationParams,
  ISensorData,
  ISensorReading,
  ISensorMetadata 
} from '../interfaces/sensor.interface';
import { 
  SENSOR_TYPES, 
  SENSOR_STATUS, 
  SAMPLING_RATES,
  CALIBRATION_PARAMS,
  DATA_BUFFER_SIZE 
} from '../constants/sensor.constants';

// Type definitions for state management
interface SensorError {
  id: string;
  sensorId: string;
  message: string;
  category: 'HARDWARE' | 'SOFTWARE' | 'COMMUNICATION';
  timestamp: number;
}

interface CalibrationStatus {
  inProgress: boolean;
  startTime: number | null;
  currentParams: ISensorCalibrationParams | null;
  progress: number;
}

interface SensorState {
  sensors: Record<string, ISensorConfig>;
  sensorData: Record<string, ISensorReading[]>;
  calibrationStatus: Record<string, CalibrationStatus>;
  calibrationHistory: Record<string, ISensorCalibrationParams[]>;
  errors: SensorError[];
  lastUpdate: number | null;
}

// Initial state configuration
const initialState: SensorState = {
  sensors: {},
  sensorData: {},
  calibrationStatus: {},
  calibrationHistory: {},
  errors: [],
  lastUpdate: null
};

/**
 * Redux slice for sensor state management
 * Implements requirements for real-time data processing with <100ms latency
 */
const sensorSlice = createSlice({
  name: 'sensor',
  initialState,
  reducers: {
    // Update sensor configuration with validation
    updateSensorConfig: (state, action: PayloadAction<ISensorConfig>) => {
      const config = action.payload;
      
      // Validate sampling rate based on sensor type
      const expectedRate = config.type === SENSOR_TYPES.IMU ? 
        SAMPLING_RATES.IMU : SAMPLING_RATES.TOF;
      
      if (config.samplingRate !== expectedRate) {
        state.errors.push({
          id: crypto.randomUUID(),
          sensorId: config.id,
          message: `Invalid sampling rate. Expected ${expectedRate}Hz`,
          category: 'HARDWARE',
          timestamp: Date.now()
        });
        return;
      }

      state.sensors[config.id] = config;
      state.lastUpdate = Date.now();
    },

    // Add new sensor data with circular buffer implementation
    addSensorData: (state, action: PayloadAction<ISensorData>) => {
      const { sensorId, readings } = action.payload;
      
      if (!state.sensorData[sensorId]) {
        state.sensorData[sensorId] = [];
      }

      // Implement circular buffer for real-time data
      const buffer = state.sensorData[sensorId];
      buffer.push(...readings);
      if (buffer.length > DATA_BUFFER_SIZE) {
        buffer.splice(0, buffer.length - DATA_BUFFER_SIZE);
      }

      state.lastUpdate = Date.now();
    },

    // Start sensor calibration process
    startCalibration: (state, action: PayloadAction<{
      sensorId: string,
      params?: Partial<ISensorCalibrationParams>
    }>) => {
      const { sensorId, params } = action.payload;
      const sensor = state.sensors[sensorId];

      if (!sensor) return;

      // Initialize calibration with default or provided parameters
      const calibrationParams: ISensorCalibrationParams = {
        tofGain: params?.tofGain ?? CALIBRATION_PARAMS.tofGainRange.default,
        imuDriftCorrection: params?.imuDriftCorrection ?? CALIBRATION_PARAMS.imuDriftCorrection.default,
        pressureThreshold: params?.pressureThreshold ?? CALIBRATION_PARAMS.pressureThreshold.default,
        sampleWindow: params?.sampleWindow ?? CALIBRATION_PARAMS.sampleWindow.default,
        filterCutoff: params?.filterCutoff ?? CALIBRATION_PARAMS.filterCutoff.default
      };

      state.calibrationStatus[sensorId] = {
        inProgress: true,
        startTime: Date.now(),
        currentParams: calibrationParams,
        progress: 0
      };

      state.sensors[sensorId].status = SENSOR_STATUS.CALIBRATING;
      state.lastUpdate = Date.now();
    },

    // Update calibration progress
    updateCalibrationProgress: (state, action: PayloadAction<{
      sensorId: string,
      progress: number
    }>) => {
      const { sensorId, progress } = action.payload;
      const calibration = state.calibrationStatus[sensorId];

      if (calibration) {
        calibration.progress = progress;
        
        if (progress >= 100) {
          const sensor = state.sensors[sensorId];
          if (sensor && calibration.currentParams) {
            sensor.calibrationParams = calibration.currentParams;
            sensor.lastCalibration = new Date();
            sensor.status = SENSOR_STATUS.ACTIVE;

            // Store calibration history
            if (!state.calibrationHistory[sensorId]) {
              state.calibrationHistory[sensorId] = [];
            }
            state.calibrationHistory[sensorId].push(calibration.currentParams);
          }
          delete state.calibrationStatus[sensorId];
        }
      }

      state.lastUpdate = Date.now();
    },

    // Set sensor error with categorization
    setSensorError: (state, action: PayloadAction<SensorError>) => {
      const error = action.payload;
      const sensor = state.sensors[error.sensorId];

      if (sensor) {
        sensor.status = SENSOR_STATUS.ERROR;
      }

      state.errors.push(error);
      if (state.errors.length > 100) {
        state.errors.shift();
      }

      state.lastUpdate = Date.now();
    },

    // Clear sensor errors
    clearSensorErrors: (state, action: PayloadAction<string>) => {
      const sensorId = action.payload;
      state.errors = state.errors.filter(error => error.sensorId !== sensorId);
      state.lastUpdate = Date.now();
    }
  }
});

// Export actions and reducer
export const { 
  updateSensorConfig,
  addSensorData,
  startCalibration,
  updateCalibrationProgress,
  setSensorError,
  clearSensorErrors
} = sensorSlice.actions;

// Selectors
export const selectSensorConfig = (state: { sensor: SensorState }, sensorId: string) => 
  state.sensor.sensors[sensorId];

export const selectSensorData = (state: { sensor: SensorState }, sensorId: string) => 
  state.sensor.sensorData[sensorId] || [];

export const selectCalibrationStatus = (state: { sensor: SensorState }, sensorId: string) => 
  state.sensor.calibrationStatus[sensorId];

export const selectCalibrationHistory = (state: { sensor: SensorState }, sensorId: string) => 
  state.sensor.calibrationHistory[sensorId] || [];

export const selectSensorErrors = (state: { sensor: SensorState }, sensorId: string) => 
  state.sensor.errors.filter(error => error.sensorId === sensorId);

export default sensorSlice.reducer;