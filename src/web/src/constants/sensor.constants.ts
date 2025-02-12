/**
 * @fileoverview Sensor constants and configuration parameters for the smart-apparel system
 * Defines core sensor operational parameters, calibration settings, and communication configurations
 * to meet technical specifications for real-time performance monitoring
 */

/**
 * Enumeration of supported sensor types in the system
 */
export enum SENSOR_TYPES {
  IMU = 'imu',  // Inertial Measurement Unit sensor
  TOF = 'tof'   // Time of Flight sensor
}

/**
 * Enumeration of possible sensor operational states
 */
export enum SENSOR_STATUS {
  DISCONNECTED = 0,  // Sensor not connected
  CONNECTING = 1,    // Connection in progress
  CALIBRATING = 2,   // Sensor calibration in progress
  ACTIVE = 3,        // Sensor actively collecting data
  ERROR = 4          // Error state
}

/**
 * Hardware-specific sampling rates (in Hz) for different sensor types
 * as specified in technical requirements
 */
export const SAMPLING_RATES = {
  IMU: 200,  // 200Hz sampling rate for IMU
  TOF: 100   // 100Hz sampling rate for ToF
} as const;

/**
 * Comprehensive calibration parameters with ranges and defaults
 * for optimal sensor performance
 */
export const CALIBRATION_PARAMS = {
  tofGainRange: {
    min: 1,
    max: 16,
    default: 8
  },
  imuDriftCorrection: {
    min: 0.1,
    max: 2.0,
    default: 0.5
  },
  pressureThreshold: {
    min: 0.1,
    max: 5.0,
    default: 1.0
  },
  sampleWindow: {
    min: 50,
    max: 500,
    default: 100
  },
  filterCutoff: {
    min: 0.5,
    max: 10,
    default: 2
  }
} as const;

/**
 * Buffer size (in samples) for real-time data processing
 * Configured to support <100ms latency requirement
 */
export const DATA_BUFFER_SIZE = 1024;

/**
 * Bluetooth communication configuration parameters
 * Defines service UUIDs and characteristics for sensor data transmission
 */
export const BLUETOOTH_CONFIG = {
  service: '180D',              // Heart Rate Service UUID
  imuCharacteristic: '2A37',    // Heart Rate Measurement Characteristic UUID
  tofCharacteristic: '2A38',    // Body Sensor Location Characteristic UUID
  mtu: 512                      // Maximum Transmission Unit size
} as const;

/**
 * UI update interval in milliseconds
 * Set to maintain real-time performance while preventing excessive updates
 */
export const SENSOR_UPDATE_INTERVAL = 100;

/**
 * Maximum number of sensors supported per device
 * Hardware limitation for sensor array configuration
 */
export const MAX_SENSORS_PER_DEVICE = 8;

/**
 * Type definitions for exported constants to ensure type safety
 */
export type SensorType = keyof typeof SENSOR_TYPES;
export type SensorStatusType = keyof typeof SENSOR_STATUS;
export type CalibrationParamKeys = keyof typeof CALIBRATION_PARAMS;