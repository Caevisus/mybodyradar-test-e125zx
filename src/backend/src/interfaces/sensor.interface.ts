/**
 * @fileoverview Defines TypeScript interfaces for sensor configuration, data structures,
 * and status management in the smart apparel system. Implements sensor layer specifications
 * including sampling rates, calibration parameters, and data processing requirements.
 */

import { SENSOR_TYPES, SENSOR_STATUS } from '../constants/sensor.constants';

/**
 * Interface for sensor configuration and operational status
 * Implements sensor layer configuration requirements from technical specifications
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
  /** Current battery level percentage */
  batteryLevel: number;
  /** Current operational status */
  status: SENSOR_STATUS;
  /** Current firmware version */
  firmwareVersion: string;
  /** Physical location on the garment */
  location: string;
}

/**
 * Interface for sensor data packet containing readings and metadata
 * Implements data processing pipeline requirements
 */
export interface ISensorData {
  /** ID of the sensor that generated the data */
  sensorId: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Array of sensor readings */
  readings: Array<ISensorReading>;
  /** Additional metadata about the readings */
  metadata: ISensorMetadata;
  /** ID of the current monitoring session */
  sessionId: string;
  /** Overall data quality score (0-100) */
  dataQuality: number;
}

/**
 * Interface for individual sensor reading data points
 * Implements sensor data acquisition requirements
 */
export interface ISensorReading {
  /** Type of sensor that produced the reading */
  type: SENSOR_TYPES;
  /** Array of processed sensor values */
  value: number[];
  /** Precise timestamp of the reading */
  timestamp: number;
  /** Confidence score of the reading (0-1) */
  confidence: number;
  /** Raw sensor data buffer */
  rawData: Buffer;
}

/**
 * Interface for metadata associated with sensor readings
 * Implements data processing and quality management requirements
 */
export interface ISensorMetadata {
  /** Version of calibration used for the readings */
  calibrationVersion: string;
  /** Array of processing steps applied to the data */
  processingSteps: string[];
  /** Quality score of the processed data (0-100) */
  quality: number;
  /** Environmental factors affecting the readings */
  environmentalFactors: Record<string, number>;
  /** Processing latency in milliseconds */
  processingLatency: number;
}

/**
 * Interface for sensor calibration parameters
 * Implements calibration requirements from technical specifications
 */
export interface ISensorCalibrationParams {
  /** ToF sensor gain (1-16) */
  tofGain: number;
  /** IMU drift correction factor (0.1-2.0°) */
  imuDriftCorrection: number;
  /** Minimum detectable force (0.1-5.0 kg) */
  pressureThreshold: number;
  /** Data aggregation period (50-500ms) */
  sampleWindow: number;
  /** Low-pass filter frequency (0.5-10 Hz) */
  filterCutoff: number;
  /** Sensor-specific calibration matrix */
  calibrationMatrix: number[][];
  /** Temperature compensation factor */
  temperatureCompensation: number;
}