/**
 * @fileoverview Defines TypeScript interfaces for sensor data structures, configuration,
 * and status management for the smart-apparel system's web frontend application.
 * Implements requirements for sensor layer configuration, real-time data processing,
 * and calibration parameter management.
 */

import { 
  SENSOR_TYPES, 
  SENSOR_STATUS, 
  SAMPLING_RATES 
} from '../constants/sensor.constants';

/**
 * Interface for sensor calibration parameters with specific ranges
 * as defined in technical specifications A.1.1
 */
export interface ISensorCalibrationParams {
  /** Infrared sensor sensitivity (range: 1-16) */
  tofGain: number;
  /** Gyroscope drift compensation in degrees (range: 0.1-2.0°) */
  imuDriftCorrection: number;
  /** Minimum detectable force in kg (range: 0.1-5.0 kg) */
  pressureThreshold: number;
  /** Data aggregation period in ms (range: 50-500ms) */
  sampleWindow: number;
  /** Low-pass filter frequency in Hz (range: 0.5-10 Hz) */
  filterCutoff: number;
}

/**
 * Interface for comprehensive sensor configuration and status tracking
 * Supports real-time monitoring requirements with <100ms latency
 */
export interface ISensorConfig {
  /** Unique identifier for the sensor */
  id: string;
  /** Type of sensor (IMU or ToF) */
  type: SENSOR_TYPES;
  /** Sampling rate in Hz (IMU: 200Hz, ToF: 100Hz) */
  samplingRate: number;
  /** Calibration parameters for sensor optimization */
  calibrationParams: ISensorCalibrationParams;
  /** Timestamp of last calibration */
  lastCalibration: Date;
  /** Current battery level percentage (0-100) */
  batteryLevel: number;
  /** Current operational status */
  status: SENSOR_STATUS;
}

/**
 * Interface for individual sensor reading data points
 * Ensures high-precision timestamp tracking for real-time analysis
 */
export interface ISensorReading {
  /** Type of sensor providing the reading */
  type: SENSOR_TYPES;
  /** Array of sensor values (e.g., [x, y, z] for IMU) */
  value: number[];
  /** High-precision timestamp in milliseconds */
  timestamp: number;
}

/**
 * Interface for sensor reading metadata including quality metrics
 * Supports data validation and processing history tracking
 */
export interface ISensorMetadata {
  /** Version of calibration parameters used */
  calibrationVersion: string;
  /** Array of processing steps applied to the data */
  processingSteps: string[];
  /** Data quality score (0-100) */
  quality: number;
}

/**
 * Interface for real-time sensor data packets
 * Optimized for <100ms latency requirement in data processing
 */
export interface ISensorData {
  /** ID of the sensor providing the data */
  sensorId: string;
  /** Packet timestamp in milliseconds since epoch */
  timestamp: number;
  /** Array of sensor readings in the current packet */
  readings: Array<ISensorReading>;
  /** Associated metadata for the readings */
  metadata: ISensorMetadata;
}