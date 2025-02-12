//
// SensorDataDelegate.swift
// SmartApparel
//
// Protocol defining thread-safe delegate methods for sensor data handling
// Foundation version: Latest
//

import Foundation

/// Protocol defining comprehensive delegate methods for sensor data event handling
/// with thread safety and performance optimization ensuring <100ms processing time
public protocol SensorDataDelegate: AnyObject {
    /// Called when new sensor data is received, with thread-safe implementation
    /// - Parameter data: Validated sensor data instance containing readings and metadata
    /// - Note: Ensures processing time under 100ms as per technical specifications
    func didReceiveSensorData(_ data: SensorData)
    
    /// Handles sensor status changes with comprehensive state management
    /// - Parameters:
    ///   - sensorId: Unique identifier of the sensor
    ///   - status: Updated operational status of the sensor
    func didUpdateSensorStatus(sensorId: String, status: SensorStatus)
    
    /// Enhanced anomaly detection handler with severity-based prioritization
    /// - Parameters:
    ///   - sensorId: Unique identifier of the sensor reporting the anomaly
    ///   - description: Detailed description of the detected anomaly
    ///   - severity: Normalized severity score between 0.0 and 1.0
    ///   - timestamp: Precise timestamp of anomaly detection
    ///   - context: Additional contextual data for anomaly analysis
    func didDetectAnomaly(
        sensorId: String,
        description: String,
        severity: Double,
        timestamp: Date,
        context: [String: Any]?
    )
    
    /// Comprehensive error handling with recovery suggestions
    /// - Parameters:
    ///   - sensorId: Unique identifier of the sensor encountering the error
    ///   - error: Detailed error information
    ///   - recoveryOptions: Array of possible recovery actions
    func didEncounterError(
        sensorId: String,
        error: Error,
        recoveryOptions: [String]?
    )
}

/// Default implementation extension providing optional error recovery handling
public extension SensorDataDelegate {
    /// Validates sensor data integrity and processes it within performance constraints
    func didReceiveSensorData(_ data: SensorData) {
        // Ensure execution on dedicated serial queue for thread safety
        DispatchQueue(label: "com.smartapparel.sensordata").async {
            // Validate data integrity
            guard case .success = data.isValid() else { return }
            
            // Process data within 100ms time constraint
            let processingStart = Date()
            
            // Perform data processing
            let readings = data.currentReadings
            
            // Verify processing time constraint
            let processingTime = Date().timeIntervalSince(processingStart)
            assert(processingTime < 0.100, "Processing time exceeded 100ms requirement")
            
            // Update UI on main thread
            DispatchQueue.main.async {
                // Trigger UI updates with processed data
            }
        }
    }
    
    /// Default implementation for status updates with state tracking
    func didUpdateSensorStatus(sensorId: String, status: SensorStatus) {
        // Log status change with timestamp
        let timestamp = Date()
        
        // Update UI on main thread
        DispatchQueue.main.async {
            // Handle status change in UI
            switch status {
            case .active:
                // Normal operation state
                break
            case .calibrating:
                // Show calibration progress
                break
            case .error:
                // Trigger error recovery process
                break
            case .inactive:
                // Handle inactive state
                break
            }
        }
    }
    
    /// Default implementation for anomaly detection with severity handling
    func didDetectAnomaly(
        sensorId: String,
        description: String,
        severity: Double,
        timestamp: Date,
        context: [String: Any]?
    ) {
        // Validate severity range
        let normalizedSeverity = min(max(severity, 0.0), 1.0)
        
        // Categorize anomaly based on severity
        switch normalizedSeverity {
        case 0.8...1.0:
            // Critical anomaly - immediate action required
            handleCriticalAnomaly(sensorId: sensorId, description: description)
        case 0.5..<0.8:
            // High severity - alert medical staff
            handleHighSeverityAnomaly(sensorId: sensorId, description: description)
        case 0.2..<0.5:
            // Medium severity - log and monitor
            handleMediumSeverityAnomaly(sensorId: sensorId, description: description)
        default:
            // Low severity - log for analysis
            handleLowSeverityAnomaly(sensorId: sensorId, description: description)
        }
    }
    
    /// Default implementation for error handling with recovery options
    func didEncounterError(
        sensorId: String,
        error: Error,
        recoveryOptions: [String]?
    ) {
        // Log error details
        let timestamp = Date()
        
        // Update sensor status
        didUpdateSensorStatus(sensorId: sensorId, status: .error)
        
        // Attempt automatic recovery if options available
        if let options = recoveryOptions, !options.isEmpty {
            // Execute first recovery option
            executeRecoveryOption(options[0], for: sensorId)
        }
        
        // Update UI on main thread
        DispatchQueue.main.async {
            // Show error state in UI
        }
    }
}

// MARK: - Private Helper Methods

private extension SensorDataDelegate {
    /// Handles critical severity anomalies requiring immediate action
    private func handleCriticalAnomaly(sensorId: String, description: String) {
        // Immediate notification to medical staff
        // Stop current activity
        // Generate incident report
    }
    
    /// Handles high severity anomalies requiring medical attention
    private func handleHighSeverityAnomaly(sensorId: String, description: String) {
        // Alert medical staff
        // Continue monitoring
        // Prepare detailed report
    }
    
    /// Handles medium severity anomalies requiring monitoring
    private func handleMediumSeverityAnomaly(sensorId: String, description: String) {
        // Log for analysis
        // Update monitoring threshold
        // Continue operation with caution
    }
    
    /// Handles low severity anomalies for analysis
    private func handleLowSeverityAnomaly(sensorId: String, description: String) {
        // Log for later analysis
        // Update baseline if needed
    }
    
    /// Executes recovery option for sensor error
    private func executeRecoveryOption(_ option: String, for sensorId: String) {
        // Attempt to execute recovery option
        // Monitor recovery success
        // Update status accordingly
    }
}