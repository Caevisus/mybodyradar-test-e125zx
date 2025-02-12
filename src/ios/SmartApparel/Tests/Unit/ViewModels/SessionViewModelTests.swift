//
// SessionViewModelTests.swift
// SmartApparel
//
// Comprehensive unit test suite for SessionViewModel
// XCTest version: Latest
// Combine version: Latest
//

import XCTest
import Combine
@testable import SmartApparel

final class SessionViewModelTests: XCTestCase {
    
    // MARK: - Properties
    
    private var sut: SessionViewModel!
    private var mockBluetoothManager: MockBluetoothManager!
    private var mockDataProcessor: MockSensorDataProcessor!
    private var cancellables: Set<AnyCancellable>!
    private var testQueue: DispatchQueue!
    private var performanceMetrics: XCTMeasureOptions!
    
    // MARK: - Test Lifecycle
    
    override func setUp() {
        super.setUp()
        
        // Initialize thread-safe test queue
        testQueue = DispatchQueue(label: "com.smartapparel.tests.session",
                                qos: .userInitiated,
                                attributes: .concurrent)
        
        // Initialize mocks
        mockBluetoothManager = MockBluetoothManager.shared
        mockDataProcessor = MockSensorDataProcessor()
        
        // Configure performance metrics
        performanceMetrics = XCTMeasureOptions()
        performanceMetrics.iterationCount = 100 // Ensure statistical significance
        
        // Initialize view model with mocks
        sut = SessionViewModel(bluetoothManager: mockBluetoothManager,
                             dataProcessor: mockDataProcessor)
        
        // Initialize cancellables set
        cancellables = Set<AnyCancellable>()
    }
    
    override func tearDown() {
        // Cancel all subscriptions
        cancellables.forEach { $0.cancel() }
        cancellables = nil
        
        // Reset mocks
        mockBluetoothManager.setSimulatedError(false, .unknown)
        mockDataProcessor.reset()
        
        // Clear performance metrics
        performanceMetrics = nil
        
        // Clear properties
        sut = nil
        mockBluetoothManager = nil
        mockDataProcessor = nil
        testQueue = nil
        
        super.tearDown()
    }
    
    // MARK: - Session Management Tests
    
    func testStartSession_Success() {
        // Given
        let expectation = XCTestExpectation(description: "Session started successfully")
        let athleteId = UUID().uuidString
        let config = SensorConfiguration()
        
        // When
        sut.startSession(athleteId: athleteId, configuration: config)
            .sink(receiveCompletion: { completion in
                if case .failure = completion {
                    XCTFail("Session start should succeed")
                }
            }, receiveValue: { status in
                XCTAssertEqual(status, .active)
                expectation.fulfill()
            })
            .store(in: &cancellables)
        
        // Then
        wait(for: [expectation], timeout: 5.0)
        XCTAssertTrue(mockBluetoothManager.processDataCalled)
        XCTAssertTrue(mockDataProcessor.calibrateSensorsCalled)
    }
    
    func testStartSession_BluetoothError() {
        // Given
        let expectation = XCTestExpectation(description: "Session start should fail")
        mockBluetoothManager.setSimulatedError(true, .connectionTimeout)
        
        // When
        sut.startSession(athleteId: UUID().uuidString, configuration: SensorConfiguration())
            .sink(receiveCompletion: { completion in
                if case .failure(let error) = completion {
                    XCTAssertEqual(error as? BluetoothManagerError, .connectionTimeout)
                    expectation.fulfill()
                }
            }, receiveValue: { _ in
                XCTFail("Should not receive success value")
            })
            .store(in: &cancellables)
        
        // Then
        wait(for: [expectation], timeout: 5.0)
        XCTAssertFalse(mockDataProcessor.calibrateSensorsCalled)
    }
    
    // MARK: - Performance Tests
    
    func testProcessSensorData_Performance() {
        measure(options: performanceMetrics) {
            // Given
            let expectation = XCTestExpectation(description: "Process sensor data")
            let readings = Array(repeating: Double.random(in: -1...1), count: DATA_BUFFER_SIZE)
            
            // When
            testQueue.async {
                do {
                    let sensorData = try SensorData(sensorId: "TEST_IMU",
                                                  type: .imu,
                                                  readings: readings)
                    
                    // Start timing
                    let start = CACurrentMediaTime()
                    
                    self.mockDataProcessor.processSensorData(sensorData)
                    
                    // End timing
                    let processingTime = CACurrentMediaTime() - start
                    
                    // Verify processing time is under 100ms
                    XCTAssertLessThan(processingTime, 0.100)
                    expectation.fulfill()
                } catch {
                    XCTFail("Failed to create test data: \(error)")
                }
            }
            
            wait(for: [expectation], timeout: 1.0)
        }
    }
    
    // MARK: - Anomaly Detection Tests
    
    func testAnomalyDetection() {
        // Given
        let expectation = XCTestExpectation(description: "Anomaly detected")
        mockDataProcessor.simulateAnomaly(enabled: true)
        
        // When
        sut.anomalyPublisher
            .sink { anomaly in
                // Then
                XCTAssertGreaterThan(anomaly.confidence, 0.8)
                XCTAssertEqual(anomaly.type, .spikePattern)
                expectation.fulfill()
            }
            .store(in: &cancellables)
        
        // Simulate sensor data that should trigger anomaly
        testQueue.async {
            do {
                let anomalyData = try SensorData(
                    sensorId: "TEST_ANOMALY",
                    type: .imu,
                    readings: Array(repeating: 10.0, count: DATA_BUFFER_SIZE)
                )
                self.mockDataProcessor.processSensorData(anomalyData)
            } catch {
                XCTFail("Failed to create anomaly data: \(error)")
            }
        }
        
        wait(for: [expectation], timeout: 5.0)
    }
    
    // MARK: - Concurrent Processing Tests
    
    func testConcurrentDataProcessing() {
        // Given
        let processingExpectation = XCTestExpectation(description: "Concurrent processing")
        processingExpectation.expectedFulfillmentCount = 10
        
        // When
        let processingGroup = DispatchGroup()
        
        for _ in 0..<10 {
            testQueue.async(group: processingGroup) {
                do {
                    let sensorData = try SensorData(
                        sensorId: UUID().uuidString,
                        type: .imu,
                        readings: Array(repeating: Double.random(in: -1...1),
                                     count: DATA_BUFFER_SIZE)
                    )
                    
                    self.mockDataProcessor.processSensorData(sensorData)
                    processingExpectation.fulfill()
                } catch {
                    XCTFail("Failed to process concurrent data: \(error)")
                }
            }
        }
        
        // Then
        processingGroup.notify(queue: .main) {
            XCTAssertTrue(self.mockDataProcessor.processDataCalled)
            XCTAssertNil(self.mockDataProcessor.lastProcessedData?.isValid().error)
        }
        
        wait(for: [expectation], timeout: 10.0)
    }
}