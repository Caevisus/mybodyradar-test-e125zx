//
// MockSensorDataProcessor.swift
// SmartApparel
//
// Thread-safe mock implementation of SensorDataProcessor for testing
// Foundation version: Latest
// XCTest version: Latest
//

import Foundation
import XCTest

/// Thread-safe mock implementation of SensorDataProcessor for testing purposes
public class MockSensorDataProcessor {
    // MARK: - Properties
    
    /// Serial queue for thread-safe operations
    private let queue: DispatchQueue
    
    /// Delegate for sensor data events
    public weak var delegate: SensorDataDelegate?
    
    /// Tracking flags for test verification
    public private(set) var processDataCalled: Bool = false
    public private(set) var calibrateSensorsCalled: Bool = false
    public private(set) var detectAnomaliesCalled: Bool = false
    
    /// Last processed sensor data for verification
    public private(set) var lastProcessedData: SensorData?
    
    /// Flag to control anomaly simulation
    public var shouldSimulateAnomaly: Bool = false
    
    /// Configurable processing delay to simulate real processing time
    public var processingDelay: TimeInterval = 0.1 // 0.1ms default for <100ms requirement
    
    // MARK: - Initialization
    
    /// Initializes the mock processor with thread-safe queue and default values
    /// - Parameter delegate: Optional delegate to receive sensor data events
    public init(delegate: SensorDataDelegate? = nil) {
        self.queue = DispatchQueue(label: "com.smartapparel.mocksensorprocessor",
                                 qos: .userInitiated)
        self.delegate = delegate
    }
    
    // MARK: - Public Methods
    
    /// Thread-safe mock implementation of sensor data processing
    /// - Parameter data: SensorData instance to process
    public func processSensorData(_ data: SensorData) {
        queue.async { [weak self] in
            guard let self = self else { return }
            
            // Track method call
            self.processDataCalled = true
            self.lastProcessedData = data
            
            // Simulate processing delay
            if self.processingDelay > 0 {
                Thread.sleep(forTimeInterval: self.processingDelay)
            }
            
            // Notify delegate of processed data
            DispatchQueue.main.async {
                self.delegate?.didReceiveSensorData(data)
                
                // Check for anomaly simulation
                if self.shouldSimulateAnomaly {
                    self.detectAnomaliesCalled = true
                    self.simulateAnomaly(for: data)
                }
            }
        }
    }
    
    /// Thread-safe mock implementation of sensor calibration
    public func calibrateSensors() {
        queue.async { [weak self] in
            guard let self = self else { return }
            
            // Track method call
            self.calibrateSensorsCalled = true
            
            // Simulate calibration delay
            Thread.sleep(forTimeInterval: self.processingDelay)
            
            // Notify delegate of calibration completion
            DispatchQueue.main.async {
                self.delegate?.didUpdateSensorStatus(
                    sensorId: self.lastProcessedData?.sensorId ?? "MOCK_SENSOR",
                    status: .active
                )
            }
        }
    }
    
    /// Simulates anomaly detection with configurable behavior
    /// - Parameter enabled: Flag to enable/disable anomaly simulation
    public func simulateAnomaly(enabled: Bool) {
        queue.async { [weak self] in
            guard let self = self else { return }
            self.shouldSimulateAnomaly = enabled
        }
    }
    
    /// Resets all tracking variables for fresh test
    public func reset() {
        queue.async { [weak self] in
            guard let self = self else { return }
            
            self.processDataCalled = false
            self.calibrateSensorsCalled = false
            self.detectAnomaliesCalled = false
            self.lastProcessedData = nil
            self.shouldSimulateAnomaly = false
            self.processingDelay = 0.1
        }
    }
    
    // MARK: - Private Methods
    
    /// Simulates anomaly detection and notification
    /// - Parameter data: SensorData instance for anomaly context
    private func simulateAnomaly(for data: SensorData) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            self.delegate?.didDetectAnomaly(
                sensorId: data.sensorId,
                description: "Mock anomaly detected",
                severity: 0.8,
                timestamp: Date(),
                context: [
                    "type": "mock_anomaly",
                    "sensor_type": data.type,
                    "readings_count": data.currentReadings.count
                ]
            )
        }
    }
}