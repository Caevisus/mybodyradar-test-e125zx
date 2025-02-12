//
// SensorData.swift
// SmartApparel
//
// Core data structures for sensor data management
// Foundation version: Latest
//

import Foundation

/// Comprehensive structure containing calibration parameters matching technical specifications
public struct SensorCalibrationParams {
    public let validTofGainRange: ClosedRange<Double> = 1.0...16.0
    public let validDriftCorrectionRange: ClosedRange<Double> = 0.1...2.0
    public let validPressureRange: ClosedRange<Double> = 0.1...5.0
    public let validFilterRange: ClosedRange<Double> = 0.5...10.0
    
    public private(set) var tofGain: Double
    public private(set) var imuDriftCorrection: Double
    public private(set) var pressureThreshold: Double
    public private(set) var sampleWindow: Double
    public private(set) var filterCutoff: Double
    
    public init() {
        self.tofGain = DEFAULT_TOF_GAIN
        self.imuDriftCorrection = DEFAULT_IMU_DRIFT_CORRECTION
        self.pressureThreshold = MINIMUM_PRESSURE_THRESHOLD
        self.sampleWindow = 0.100 // 100ms default
        self.filterCutoff = 2.0 // 2Hz default
    }
}

/// Comprehensive structure containing metadata and processing information
public struct SensorMetadata {
    public private(set) var calibrationVersion: String
    public private(set) var processingSteps: [String]
    public private(set) var quality: Double
    public private(set) var calibrationParams: SensorCalibrationParams
    public private(set) var lastCalibrationDate: Date
    public private(set) var sampleRate: Int
    public private(set) var signalToNoiseRatio: Double
    
    public init() {
        self.calibrationVersion = "1.0.0"
        self.processingSteps = []
        self.quality = 1.0
        self.calibrationParams = SensorCalibrationParams()
        self.lastCalibrationDate = Date()
        self.sampleRate = 200 // Default to IMU rate
        self.signalToNoiseRatio = 1.0
    }
}

/// Error types for sensor data validation
public enum SensorError: Error {
    case invalidSensorId
    case invalidTimestamp
    case invalidReadings
    case invalidCalibration
    case compressionError
    case threadingError
}

/// Thread-safe class representing comprehensive sensor data readings with metadata
public class SensorData {
    public let sensorId: String
    public private(set) var timestamp: Date
    public private(set) var type: SensorType
    public private(set) var status: SensorStatus
    public private(set) var metadata: SensorMetadata
    
    private var readings: [Double]
    private let dataLock: NSLock
    private let bufferSize: Int
    private let compressionRatio: Double
    
    /// Thread-safe initializer for SensorData instance
    public init(sensorId: String, type: SensorType, readings: [Double], bufferSize: Int = DATA_BUFFER_SIZE, compressionRatio: Double = 10.0) throws {
        guard sensorId.count >= 8 else {
            throw SensorError.invalidSensorId
        }
        
        guard bufferSize > 0 && (bufferSize & (bufferSize - 1) == 0) else {
            throw SensorError.invalidReadings
        }
        
        guard compressionRatio >= 1.0 && compressionRatio <= 10.0 else {
            throw SensorError.compressionError
        }
        
        self.dataLock = NSLock()
        self.sensorId = sensorId
        self.timestamp = Date()
        self.type = type
        self.status = .calibrating
        self.metadata = SensorMetadata()
        self.readings = readings
        self.bufferSize = bufferSize
        self.compressionRatio = compressionRatio
        
        // Configure sample rate based on sensor type
        self.metadata.sampleRate = type == .imu ? Int(IMU_SAMPLING_RATE) : Int(TOF_SAMPLING_RATE)
    }
    
    /// Thread-safe access to readings
    public var currentReadings: [Double] {
        dataLock.lock()
        defer { dataLock.unlock() }
        return readings
    }
    
    /// Comprehensive validation of sensor data and calibration parameters
    public func isValid() -> Result<Bool, SensorError> {
        dataLock.lock()
        defer { dataLock.unlock() }
        
        // Validate sensor ID format
        guard sensorId.count >= 8 else {
            return .failure(.invalidSensorId)
        }
        
        // Check timestamp is within acceptable range (not in future, not too old)
        let now = Date()
        guard timestamp <= now && now.timeIntervalSince(timestamp) < 3600 else {
            return .failure(.invalidTimestamp)
        }
        
        // Verify readings array size
        let expectedSize = type == .imu ? Int(IMU_SAMPLING_RATE) : Int(TOF_SAMPLING_RATE)
        guard readings.count <= bufferSize && readings.count % expectedSize == 0 else {
            return .failure(.invalidReadings)
        }
        
        // Validate calibration parameters
        let params = metadata.calibrationParams
        guard params.validTofGainRange.contains(params.tofGain) &&
              params.validDriftCorrectionRange.contains(params.imuDriftCorrection) &&
              params.validPressureRange.contains(params.pressureThreshold) &&
              params.validFilterRange.contains(params.filterCutoff) else {
            return .failure(.invalidCalibration)
        }
        
        return .success(true)
    }
    
    /// Implements 10:1 data compression for storage optimization
    public func compressData() throws -> Data {
        dataLock.lock()
        defer { dataLock.unlock() }
        
        var compressed = Data()
        
        // Basic implementation of run-length encoding for demonstration
        var currentValue = readings.first ?? 0
        var count = 0
        
        for value in readings {
            if value == currentValue {
                count += 1
            } else {
                compressed.append(contentsOf: withUnsafeBytes(of: currentValue) { Data($0) })
                compressed.append(contentsOf: withUnsafeBytes(of: count) { Data($0) })
                currentValue = value
                count = 1
            }
        }
        
        // Handle last group
        compressed.append(contentsOf: withUnsafeBytes(of: currentValue) { Data($0) })
        compressed.append(contentsOf: withUnsafeBytes(of: count) { Data($0) })
        
        // Verify compression ratio
        let compressionAchieved = Double(readings.count * MemoryLayout<Double>.size) / Double(compressed.count)
        guard compressionAchieved >= compressionRatio else {
            throw SensorError.compressionError
        }
        
        return compressed
    }
}