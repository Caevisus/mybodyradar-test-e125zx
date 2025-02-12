//
// DataFormatter.swift
// SmartApparel
//
// Thread-safe utility class for high-precision data formatting
// Foundation version: Latest
//

import Foundation
import "../Models/SensorData"
import "../Constants/SensorConstants"

/// Comprehensive error types for data formatting operations
public enum FormattingError: Error {
    case invalidSamplingRate
    case compressionRatioNotMet
    case invalidMetricValue
    case invalidCalibrationParameter
    case threadingError
    case invalidInput
}

/// Thread-safe utility class providing high-precision data formatting capabilities
public class DataFormatter {
    // MARK: - Properties
    
    private let formatterLock = NSLock()
    private let dateFormatter: DateFormatter
    private let numberFormatter: NumberFormatter
    private let imuSamplingRate: Double
    private let tofSamplingRate: Double
    private let compressionRatio: Double
    
    // Valid ranges for metric values
    private let validMetricRange: ClosedRange<Double> = -1000.0...1000.0
    
    // MARK: - Initialization
    
    public init() {
        // Configure date formatter for ISO8601 with microsecond precision
        dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSSSS'Z'"
        dateFormatter.timeZone = TimeZone(secondsFromGMT: 0)
        dateFormatter.locale = Locale(identifier: "en_US_POSIX")
        
        // Configure number formatter for scientific notation with 3 decimal places
        numberFormatter = NumberFormatter()
        numberFormatter.numberStyle = .scientific
        numberFormatter.maximumFractionDigits = 3
        numberFormatter.minimumFractionDigits = 3
        numberFormatter.usesGroupingSeparator = false
        
        // Set sampling rates from constants
        imuSamplingRate = IMU_SAMPLING_RATE
        tofSamplingRate = TOF_SAMPLING_RATE
        compressionRatio = 10.0 // Required 10:1 compression ratio
    }
    
    // MARK: - Public Methods
    
    /// Formats sensor data with thread-safety and comprehensive validation
    public func formatSensorData(_ data: SensorData, type: SensorType) -> Result<String, FormattingError> {
        formatterLock.lock()
        defer { formatterLock.unlock() }
        
        // Validate sampling rate based on sensor type
        let expectedRate = type == .imu ? imuSamplingRate : tofSamplingRate
        guard data.metadata.sampleRate == Int(expectedRate) else {
            return .failure(.invalidSamplingRate)
        }
        
        do {
            // Validate compression ratio
            let compressed = try data.compressData()
            let rawSize = Double(data.currentReadings.count * MemoryLayout<Double>.size)
            let compressedSize = Double(compressed.count)
            guard (rawSize / compressedSize) >= compressionRatio else {
                return .failure(.compressionRatioNotMet)
            }
            
            // Format timestamp
            let timestampStr = dateFormatter.string(from: data.timestamp)
            
            // Format readings array
            let readingsStr = data.currentReadings.map { reading -> String in
                guard let formattedReading = numberFormatter.string(from: NSNumber(value: reading)) else {
                    return "0.000E+00"
                }
                return formattedReading
            }.joined(separator: ",")
            
            // Combine formatted elements
            let formattedData = """
            {
                "timestamp": "\(timestampStr)",
                "sensorId": "\(data.sensorId)",
                "type": "\(type)",
                "readings": [\(readingsStr)],
                "sampleRate": \(data.metadata.sampleRate)
            }
            """
            
            return .success(formattedData)
        } catch {
            return .failure(.invalidInput)
        }
    }
    
    /// Formats performance metrics with thread-safety and validation
    public func formatMetrics(_ metrics: [String: Double]) -> Result<[String: String], FormattingError> {
        formatterLock.lock()
        defer { formatterLock.unlock() }
        
        var formattedMetrics: [String: String] = [:]
        
        for (key, value) in metrics {
            // Validate metric value is within acceptable range
            guard validMetricRange.contains(value) else {
                return .failure(.invalidMetricValue)
            }
            
            // Format metric value with high precision
            guard let formattedValue = numberFormatter.string(from: NSNumber(value: value)) else {
                return .failure(.invalidInput)
            }
            
            formattedMetrics[key] = formattedValue
        }
        
        return .success(formattedMetrics)
    }
    
    /// Formats calibration parameters with thread-safety and comprehensive validation
    public func formatCalibrationData(_ params: SensorCalibrationParams) -> Result<String, FormattingError> {
        formatterLock.lock()
        defer { formatterLock.unlock() }
        
        // Validate calibration parameters are within specification ranges
        guard params.validTofGainRange.contains(params.tofGain) &&
              params.validDriftCorrectionRange.contains(params.imuDriftCorrection) &&
              params.validPressureRange.contains(params.pressureThreshold) &&
              params.validFilterRange.contains(params.filterCutoff) else {
            return .failure(.invalidCalibrationParameter)
        }
        
        // Format calibration values with high precision
        guard let formattedGain = numberFormatter.string(from: NSNumber(value: params.tofGain)),
              let formattedDrift = numberFormatter.string(from: NSNumber(value: params.imuDriftCorrection)),
              let formattedPressure = numberFormatter.string(from: NSNumber(value: params.pressureThreshold)),
              let formattedFilter = numberFormatter.string(from: NSNumber(value: params.filterCutoff)) else {
            return .failure(.invalidInput)
        }
        
        // Combine formatted calibration parameters
        let formattedCalibration = """
        {
            "tofGain": \(formattedGain),
            "driftCorrection": \(formattedDrift),
            "pressureThreshold": \(formattedPressure),
            "sampleWindow": \(params.sampleWindow),
            "filterCutoff": \(formattedFilter)
        }
        """
        
        return .success(formattedCalibration)
    }
}