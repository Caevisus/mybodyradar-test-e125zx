//
// SensorConstants.swift
// SmartApparel
//
// Constants and configurations for sensor management
// Foundation version: Latest
//

import Foundation

// MARK: - Global Constants

/// IMU sensor sampling rate in Hz (200Hz as per technical specifications)
public let IMU_SAMPLING_RATE: Double = 200.0

/// Time-of-Flight sensor sampling rate in Hz (100Hz as per technical specifications)
public let TOF_SAMPLING_RATE: Double = 100.0

/// Default Time-of-Flight sensor gain value (8.0 as per calibration parameters)
public let DEFAULT_TOF_GAIN: Double = 8.0

/// Default IMU drift correction in degrees (0.5° as per calibration parameters)
public let DEFAULT_IMU_DRIFT_CORRECTION: Double = 0.5

/// Minimum pressure threshold in kg for sensor activation
public let MINIMUM_PRESSURE_THRESHOLD: Double = 1.0

/// Default data buffer size (1024 samples)
public let DATA_BUFFER_SIZE: Int = 1024

/// Valid range for Time-of-Flight sensor gain (1.0 to 16.0 as per specifications)
public let TOF_GAIN_RANGE: ClosedRange<Double> = 1.0...16.0

/// Valid range for IMU drift correction in degrees (0.1° to 2.0° as per specifications)
public let IMU_DRIFT_CORRECTION_RANGE: ClosedRange<Double> = 0.1...2.0

// MARK: - Enumerations

/// Enumeration of available sensor types
public enum SensorType {
    case imu
    case tof
}

/// Enumeration of possible sensor operational states
public enum SensorStatus {
    case inactive
    case calibrating
    case active
    case error
}

/// Enumeration of possible sensor configuration errors
public enum SensorConfigError: Error {
    case invalidTofGain
    case invalidDriftCorrection
    case invalidPressureThreshold
    case invalidBufferSize
    case calibrationExpired
}

// MARK: - Sensor Configuration

/// Structure containing sensor configuration parameters
public struct SensorConfiguration {
    /// Time-of-Flight sensor gain value
    public var tofGain: Double
    
    /// IMU drift correction value in degrees
    public var driftCorrection: Double
    
    /// Pressure threshold for sensor activation in kg
    public var pressureThreshold: Double
    
    /// Size of the data buffer for sensor readings
    public var bufferSize: Int
    
    /// Date of last sensor calibration
    public var lastCalibrationDate: Date
    
    /// Unique identifier for this configuration
    public var configurationId: UUID
    
    /// Initializes a new sensor configuration with default values
    public init() {
        self.tofGain = DEFAULT_TOF_GAIN
        self.driftCorrection = DEFAULT_IMU_DRIFT_CORRECTION
        self.pressureThreshold = MINIMUM_PRESSURE_THRESHOLD
        self.bufferSize = DATA_BUFFER_SIZE
        self.lastCalibrationDate = Date()
        self.configurationId = UUID()
    }
    
    /// Validates the current configuration parameters
    public func isValid() -> Bool {
        return TOF_GAIN_RANGE.contains(tofGain) &&
               IMU_DRIFT_CORRECTION_RANGE.contains(driftCorrection) &&
               pressureThreshold > 0 &&
               bufferSize > 0 && (bufferSize & (bufferSize - 1) == 0) // Power of 2 check
    }
}

// MARK: - Validation Functions

/// Validates sensor configuration parameters with detailed error reporting
public func validateSensorConfig(_ config: SensorConfiguration) -> Result<Bool, SensorConfigError> {
    // Validate ToF gain
    guard TOF_GAIN_RANGE.contains(config.tofGain) else {
        return .failure(.invalidTofGain)
    }
    
    // Validate drift correction
    guard IMU_DRIFT_CORRECTION_RANGE.contains(config.driftCorrection) else {
        return .failure(.invalidDriftCorrection)
    }
    
    // Validate pressure threshold
    guard config.pressureThreshold > 0 else {
        return .failure(.invalidPressureThreshold)
    }
    
    // Validate buffer size is power of 2
    guard config.bufferSize > 0 && (config.bufferSize & (config.bufferSize - 1) == 0) else {
        return .failure(.invalidBufferSize)
    }
    
    // Validate calibration date (within last 24 hours)
    guard Date().timeIntervalSince(config.lastCalibrationDate) <= 24 * 3600 else {
        return .failure(.calibrationExpired)
    }
    
    return .success(true)
}