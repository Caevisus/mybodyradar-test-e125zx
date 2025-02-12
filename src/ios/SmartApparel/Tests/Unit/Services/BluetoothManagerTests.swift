//
// BluetoothManagerTests.swift
// SmartApparel
//
// XCTest version: Latest
//

import XCTest
@testable import SmartApparel

final class BluetoothManagerTests: XCTestCase {
    
    // MARK: - Properties
    
    private var sut: BluetoothManager!
    private var mockManager: MockBluetoothManager!
    private var expectation: XCTestExpectation!
    private var testQueue: DispatchQueue!
    
    // MARK: - Setup & Teardown
    
    override func setUp() {
        super.setUp()
        sut = BluetoothManager.shared
        mockManager = MockBluetoothManager.shared
        testQueue = DispatchQueue(label: "com.smartapparel.tests", qos: .userInitiated)
        expectation = expectation(description: "Bluetooth Operation")
    }
    
    override func tearDown() {
        sut.stopScanning()
        mockManager.setSimulatedError(false, .invalidReadings)
        expectation = nil
        sut = nil
        mockManager = nil
        testQueue = nil
        super.tearDown()
    }
    
    // MARK: - Sampling Rate Tests
    
    func testIMUSamplingRate() {
        // Given
        let expectedRate = IMU_SAMPLING_RATE
        var actualRate: Double = 0.0
        
        // When
        mockManager.delegate = self
        mockManager.startScanning()
        
        // Then
        wait(for: [expectation], timeout: 5.0)
        XCTAssertEqual(actualRate, expectedRate, accuracy: 1.0, "IMU sampling rate should be \(expectedRate)Hz")
    }
    
    func testToFSamplingRate() {
        // Given
        let expectedRate = TOF_SAMPLING_RATE
        var actualRate: Double = 0.0
        
        // When
        mockManager.delegate = self
        mockManager.startScanning()
        
        // Then
        wait(for: [expectation], timeout: 5.0)
        XCTAssertEqual(actualRate, expectedRate, accuracy: 1.0, "ToF sampling rate should be \(expectedRate)Hz")
    }
    
    // MARK: - Calibration Tests
    
    func testCalibrationProcess() {
        // Given
        var calibrationProgress: Double = 0.0
        let calibrationExpectation = expectation(description: "Calibration Complete")
        
        // When
        mockManager.delegate = self
        mockManager.simulateCalibration()
        
        // Then
        DispatchQueue.main.asyncAfter(deadline: .now() + 6.0) {
            calibrationExpectation.fulfill()
        }
        
        wait(for: [calibrationExpectation], timeout: 7.0)
        XCTAssertEqual(calibrationProgress, 1.0, accuracy: 0.01, "Calibration should complete successfully")
    }
    
    func testCalibrationParameters() {
        // Given
        let config = SensorConfiguration()
        let params = SensorCalibrationParams()
        
        // When
        let result = sut.configureSensor(configuration: config, calibration: params)
        
        // Then
        switch result {
        case .success:
            XCTAssertTrue(true, "Sensor configuration should succeed")
        case .failure(let error):
            XCTFail("Sensor configuration failed with error: \(error)")
        }
    }
    
    // MARK: - Data Compression Tests
    
    func testDataCompressionRatio() {
        // Given
        let expectedRatio: Double = 10.0
        var actualRatio: Double = 0.0
        let compressionExpectation = expectation(description: "Compression Validation")
        
        // When
        mockManager.delegate = self
        mockManager.startScanning()
        
        // Then
        wait(for: [compressionExpectation], timeout: 5.0)
        XCTAssertEqual(actualRatio, expectedRatio, accuracy: 0.5, "Compression ratio should be approximately 10:1")
    }
    
    // MARK: - Error Handling Tests
    
    func testInvalidSensorData() {
        // Given
        let errorExpectation = expectation(description: "Error Handler")
        var receivedError: Error?
        
        // When
        mockManager.delegate = self
        mockManager.setSimulatedError(true, .invalidReadings)
        
        // Then
        wait(for: [errorExpectation], timeout: 5.0)
        XCTAssertNotNil(receivedError, "Should receive invalid readings error")
        XCTAssertTrue(receivedError is SensorError, "Error should be of type SensorError")
    }
    
    func testThreadSafety() {
        // Given
        let operationCount = 100
        let threadSafetyExpectation = expectation(description: "Thread Safety")
        threadSafetyExpectation.expectedFulfillmentCount = operationCount
        
        // When
        for _ in 0..<operationCount {
            testQueue.async {
                self.mockManager.startScanning()
                threadSafetyExpectation.fulfill()
            }
        }
        
        // Then
        wait(for: [threadSafetyExpectation], timeout: 10.0)
    }
}

// MARK: - BluetoothManagerDelegate

extension BluetoothManagerTests: BluetoothManagerDelegate {
    
    func didUpdateConnectionState(_ status: SensorStatus, peripheral: CBPeripheral?) {
        switch status {
        case .active:
            XCTAssertTrue(true, "Connection should be active")
        case .inactive:
            XCTFail("Connection should not be inactive")
        case .calibrating:
            XCTAssertTrue(true, "Device should be calibrating")
        case .error:
            XCTFail("Connection should not be in error state")
        }
    }
    
    func didReceiveSensorData(_ data: SensorData, type: SensorType) {
        // Verify data validity
        switch data.isValid() {
        case .success:
            XCTAssertTrue(true, "Sensor data should be valid")
        case .failure(let error):
            XCTFail("Sensor data validation failed: \(error)")
        }
        
        expectation.fulfill()
    }
    
    func didEncounterError(_ error: Error, peripheral: CBPeripheral?) {
        XCTAssertNotNil(error, "Error should not be nil")
        expectation.fulfill()
    }
    
    func didUpdateCalibrationProgress(_ progress: Double, params: SensorCalibrationParams) {
        XCTAssertTrue(progress >= 0.0 && progress <= 1.0, "Calibration progress should be between 0 and 1")
        XCTAssertTrue(params.validTofGainRange.contains(params.tofGain), "ToF gain should be within valid range")
        XCTAssertTrue(params.validDriftCorrectionRange.contains(params.imuDriftCorrection), "IMU drift correction should be within valid range")
    }
    
    func didValidateCompression(_ ratio: Double, for data: SensorData) {
        XCTAssertTrue(ratio >= 1.0 && ratio <= 10.0, "Compression ratio should be between 1 and 10")
        XCTAssertNotNil(data, "Sensor data should not be nil")
    }
    
    func didVerifySamplingRate(_ rate: Double, for type: SensorType) {
        let expectedRate = type == .imu ? IMU_SAMPLING_RATE : TOF_SAMPLING_RATE
        XCTAssertEqual(rate, expectedRate, accuracy: 1.0, "Sampling rate should match expected rate for sensor type")
    }
}