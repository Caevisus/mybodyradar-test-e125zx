//
// SensorDataProcessorTests.swift
// SmartApparel
//
// Comprehensive test suite for SensorDataProcessor
// XCTest version: Latest
//

import XCTest
@testable import SmartApparel

final class SensorDataProcessorTests: XCTestCase {
    // MARK: - Properties
    
    private var sut: SensorDataProcessor!
    private var mockDelegate: MockSensorDataDelegate!
    private let processingLatencyThreshold: TimeInterval = 0.1 // 100ms as per specs
    private var testDataQueue: DispatchQueue!
    private let anomalyThreshold: Double = 0.85
    
    // MARK: - Test Lifecycle
    
    override func setUp() {
        super.setUp()
        mockDelegate = MockSensorDataDelegate()
        sut = SensorDataProcessor(delegate: mockDelegate, anomalyThreshold: anomalyThreshold)
        testDataQueue = DispatchQueue(label: "com.smartapparel.tests.dataqueue", attributes: .concurrent)
    }
    
    override func tearDown() {
        sut = nil
        mockDelegate = nil
        testDataQueue = nil
        super.tearDown()
    }
    
    // MARK: - Test Cases
    
    func testProcessSensorData() throws {
        // Given
        let imuData = try createTestSensorData(type: .imu, sampleCount: Int(IMU_SAMPLING_RATE))
        let expectation = XCTestExpectation(description: "Process sensor data")
        var processingTime: TimeInterval = 0
        
        // When
        let startTime = CACurrentMediaTime()
        sut.processSensorData(imuData)
        
        // Then
        mockDelegate.onDataProcessed = { data in
            processingTime = CACurrentMediaTime() - startTime
            XCTAssertLessThan(processingTime, self.processingLatencyThreshold, "Processing time exceeds 100ms requirement")
            XCTAssertEqual(data.type, .imu)
            XCTAssertEqual(data.currentReadings.count, Int(IMU_SAMPLING_RATE))
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 1.0)
    }
    
    func testConcurrentDataProcessing() throws {
        // Given
        let concurrentOperations = 10
        let expectations = (0..<concurrentOperations).map { 
            XCTestExpectation(description: "Process concurrent data \($0)")
        }
        var processedCount = 0
        let countLock = NSLock()
        
        // When
        for i in 0..<concurrentOperations {
            testDataQueue.async {
                do {
                    let sensorType: SensorType = i % 2 == 0 ? .imu : .tof
                    let sampleCount = Int(sensorType == .imu ? IMU_SAMPLING_RATE : TOF_SAMPLING_RATE)
                    let data = try self.createTestSensorData(type: sensorType, sampleCount: sampleCount)
                    
                    self.sut.processSensorData(data)
                } catch {
                    XCTFail("Failed to create test data: \(error)")
                }
            }
        }
        
        // Then
        mockDelegate.onDataProcessed = { _ in
            countLock.lock()
            processedCount += 1
            if processedCount == concurrentOperations {
                expectations.forEach { $0.fulfill() }
            }
            countLock.unlock()
        }
        
        wait(for: expectations, timeout: 5.0)
        XCTAssertEqual(processedCount, concurrentOperations)
    }
    
    func testAnomalyDetection() throws {
        // Given
        let anomalyExpectation = XCTestExpectation(description: "Detect anomaly")
        let anomalousData = try createAnomalousTestData()
        var detectedAnomaly: AnomalyResult?
        
        // When
        mockDelegate.onAnomalyDetected = { anomaly in
            detectedAnomaly = anomaly
            anomalyExpectation.fulfill()
        }
        
        sut.processSensorData(anomalousData)
        
        // Then
        wait(for: [anomalyExpectation], timeout: 1.0)
        XCTAssertNotNil(detectedAnomaly)
        XCTAssertGreaterThan(detectedAnomaly?.confidence ?? 0, anomalyThreshold)
        XCTAssertGreaterThan(detectedAnomaly?.magnitude ?? 0, 0)
    }
    
    func testSensorCalibration() throws {
        // Given
        let calibrationExpectation = XCTestExpectation(description: "Complete calibration")
        var calibrationResult: CalibrationResult?
        
        // When
        mockDelegate.onCalibrationComplete = { result in
            calibrationResult = result
            calibrationExpectation.fulfill()
        }
        
        _ = sut.calibrateSensors()
        
        // Then
        wait(for: [calibrationExpectation], timeout: 2.0)
        XCTAssertNotNil(calibrationResult)
        XCTAssertTrue(calibrationResult?.success ?? false)
        XCTAssertGreaterThanOrEqual(calibrationResult?.accuracy ?? 0, 0.95)
        
        // Verify calibration parameters are within specified ranges
        let params = calibrationResult?.parameters
        XCTAssertTrue(TOF_GAIN_RANGE.contains(params?.tofGain ?? 0))
        XCTAssertTrue(IMU_DRIFT_CORRECTION_RANGE.contains(params?.imuDriftCorrection ?? 0))
    }
    
    // MARK: - Helper Methods
    
    private func createTestSensorData(type: SensorType, sampleCount: Int) throws -> SensorData {
        let readings = (0..<sampleCount).map { _ in Double.random(in: -1...1) }
        return try SensorData(
            sensorId: type == .imu ? "IMU_TEST_001" : "TOF_TEST_001",
            type: type,
            readings: readings
        )
    }
    
    private func createAnomalousTestData() throws -> SensorData {
        let sampleCount = Int(IMU_SAMPLING_RATE)
        var readings = [Double](repeating: 1.0, count: sampleCount)
        
        // Insert anomalous spike
        let spikeIndex = sampleCount / 2
        readings[spikeIndex] = 10.0 // Significant deviation
        
        return try SensorData(
            sensorId: "IMU_TEST_001",
            type: .imu,
            readings: readings
        )
    }
}

// MARK: - Mock Delegate

private class MockSensorDataDelegate: SensorDataDelegate {
    var onDataProcessed: ((SensorData) -> Void)?
    var onAnomalyDetected: ((AnomalyResult) -> Void)?
    var onCalibrationComplete: ((CalibrationResult) -> Void)?
    
    func processor(_ processor: SensorDataProcessor, didProcessData data: SensorData) {
        onDataProcessed?(data)
    }
    
    func processor(_ processor: SensorDataProcessor, didDetectAnomaly anomaly: AnomalyResult) {
        onAnomalyDetected?(anomaly)
    }
    
    func processor(_ processor: SensorDataProcessor, didCompleteCalibration result: CalibrationResult) {
        onCalibrationComplete?(result)
    }
}