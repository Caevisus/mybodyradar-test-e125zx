//
// BluetoothManagerDelegate.swift
// SmartApparel
//
// Protocol for handling Bluetooth connectivity and sensor data management
// CoreBluetooth version: Latest
// Foundation version: Latest
//

import Foundation
import CoreBluetooth

/// Protocol defining delegate methods for Bluetooth connectivity and sensor data management
public protocol BluetoothManagerDelegate: AnyObject {
    
    /// Called when Bluetooth connection state changes with enhanced calibration state tracking
    /// - Parameter status: Current sensor status indicating connection and calibration state
    /// - Parameter peripheral: The CoreBluetooth peripheral device that changed state
    func didUpdateConnectionState(_ status: SensorStatus, peripheral: CBPeripheral)
    
    /// Called when new sensor data is received, with validation for compression and sampling rates
    /// - Parameter data: Validated sensor data with compression ratio and sampling rate checks
    /// - Parameter type: Type of sensor that provided the data
    func didReceiveSensorData(_ data: SensorData, type: SensorType)
    
    /// Called when a Bluetooth or sensor-related error occurs
    /// - Parameter error: The encountered error with detailed categorization
    /// - Parameter peripheral: Optional peripheral associated with the error
    func didEncounterError(_ error: Error, peripheral: CBPeripheral?)
    
    /// Called during sensor calibration process with parameter validation
    /// - Parameter progress: Calibration progress from 0.0 to 1.0
    /// - Parameter params: Current calibration parameters being applied
    func didUpdateCalibrationProgress(_ progress: Double, params: SensorCalibrationParams)
    
    /// Optional: Called when compression ratio validation is completed
    /// - Parameter ratio: Achieved compression ratio
    /// - Parameter data: Original sensor data that was compressed
    func didValidateCompression(_ ratio: Double, for data: SensorData)
    
    /// Optional: Called when sampling rate verification is completed
    /// - Parameter rate: Verified sampling rate in Hz
    /// - Parameter type: Type of sensor being verified
    func didVerifySamplingRate(_ rate: Double, for type: SensorType)
}

// MARK: - Default Implementations

public extension BluetoothManagerDelegate {
    
    func didValidateCompression(_ ratio: Double, for data: SensorData) {
        // Default implementation for compression validation
        guard ratio <= 10.0 else {
            didEncounterError(SensorError.compressionError, peripheral: nil)
            return
        }
    }
    
    func didVerifySamplingRate(_ rate: Double, for type: SensorType) {
        // Default implementation for sampling rate verification
        let expectedRate = type == .imu ? IMU_SAMPLING_RATE : TOF_SAMPLING_RATE
        guard abs(rate - expectedRate) <= 1.0 else {
            didEncounterError(SensorError.invalidReadings, peripheral: nil)
            return
        }
    }
}

// MARK: - Type Definitions

/// Enumeration of possible Bluetooth manager errors
public enum BluetoothManagerError: Error {
    case connectionTimeout
    case invalidState
    case serviceDiscoveryFailed
    case characteristicReadFailed
    case notificationSetupFailed
    case calibrationFailed
    case compressionValidationFailed
    case samplingRateInvalid
    case peripheralDisconnected
    case unauthorizedAccess
    case powerOff
    case unknown
    
    var localizedDescription: String {
        switch self {
        case .connectionTimeout:
            return "Connection attempt timed out"
        case .invalidState:
            return "Bluetooth manager in invalid state"
        case .serviceDiscoveryFailed:
            return "Failed to discover required services"
        case .characteristicReadFailed:
            return "Failed to read characteristic"
        case .notificationSetupFailed:
            return "Failed to setup notifications"
        case .calibrationFailed:
            return "Sensor calibration failed"
        case .compressionValidationFailed:
            return "Data compression validation failed"
        case .samplingRateInvalid:
            return "Invalid sensor sampling rate detected"
        case .peripheralDisconnected:
            return "Peripheral disconnected unexpectedly"
        case .unauthorizedAccess:
            return "Bluetooth access unauthorized"
        case .powerOff:
            return "Bluetooth is powered off"
        case .unknown:
            return "Unknown Bluetooth error occurred"
        }
    }
}

/// Constants for Bluetooth operation timeouts
public struct BluetoothTimeouts {
    public static let connection: TimeInterval = 10.0
    public static let serviceDiscovery: TimeInterval = 5.0
    public static let characteristicRead: TimeInterval = 3.0
    public static let calibration: TimeInterval = 15.0
}

/// Constants for Bluetooth operation thresholds
public struct BluetoothThresholds {
    public static let rssiMinimum: Int = -70
    public static let maxReconnectionAttempts: Int = 3
    public static let calibrationMinimumProgress: Double = 0.1
    public static let calibrationCompletionThreshold: Double = 0.99
}