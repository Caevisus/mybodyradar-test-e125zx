/**
 * @fileoverview Constants and enumerations for sensor configuration, calibration, and status management
 * Implements sensor layer specifications from technical requirements including sampling rates,
 * calibration parameters, and Bluetooth communication settings.
 */

/**
 * Enumeration of supported sensor types in the smart apparel system
 */
export enum SENSOR_TYPES {
  IMU = 'imu',  // Inertial Measurement Unit sensor
  TOF = 'tof'   // Time of Flight sensor
}

/**
 * Enumeration of possible sensor operational states for comprehensive status tracking
 */
export enum SENSOR_STATUS {
  DISCONNECTED = 0,  // Sensor not connected
  CONNECTING = 1,    // Connection in progress
  CALIBRATING = 2,   // Sensor calibration in progress
  ACTIVE = 3,        // Sensor active and collecting data
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
 * Comprehensive calibration parameters with their ranges and defaults
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
 * Optimal buffer size (in bytes) for local sensor data storage
 * before transmission, based on technical requirements
 */
export const DATA_BUFFER_SIZE = 1024;

/**
 * Bluetooth Low Energy communication parameters and configuration
 * Implements BLE 5.0 specifications from technical requirements
 */
export const BLUETOOTH_CONFIG = {
  service: '180D',              // Heart Rate Service UUID
  imuCharacteristic: '2A37',    // Heart Rate Measurement Characteristic UUID
  tofCharacteristic: '2A38',    // Body Sensor Location Characteristic UUID
  mtu: 512,                     // Maximum Transmission Unit size
  connectionTimeout: 5000,      // Connection timeout in milliseconds
  retryAttempts: 3             // Number of connection retry attempts
} as const;

/**
 * System status codes for sensor-related operations
 * Range: 1000-1099 reserved for sensor status
 */
export const SENSOR_STATUS_CODES = {
  INITIALIZATION_SUCCESS: 1000,
  INITIALIZATION_FAILURE: 1001,
  CALIBRATION_SUCCESS: 1002,
  CALIBRATION_FAILURE: 1003,
  DATA_ACQUISITION_START: 1004,
  DATA_ACQUISITION_STOP: 1005,
  BUFFER_OVERFLOW: 1006,
  SENSOR_TIMEOUT: 1007,
  CONNECTION_LOST: 1008,
  HARDWARE_ERROR: 1009
} as const;