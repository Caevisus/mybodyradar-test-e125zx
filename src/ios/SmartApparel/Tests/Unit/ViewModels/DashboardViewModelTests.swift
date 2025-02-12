//
// DashboardViewModelTests.swift
// SmartApparel
//
// Comprehensive test suite for DashboardViewModel with performance validation
// XCTest version: Latest
// Combine version: Latest
//

import XCTest
import Combine
@testable import SmartApparel

@MainActor
final class DashboardViewModelTests: XCTestCase {
    // MARK: - Properties
    
    private var sut: DashboardViewModel!
    private var mockSensorProcessor: MockSensorDataProcessor!
    private var mockAnalyticsService: MockAnalyticsService!
    private var mockSessionManager: MockSecureSessionManager!
    private var mockPerformanceMonitor: MockPerformanceMonitor!
    private var mockAuditLogger: MockAuditLogger!
    private var cancellables: Set<AnyCancellable>!
    private var performanceMetrics: XCTMeasureOptions!
    
    // MARK: - Setup & Teardown
    
    override func setUpWithError() throws {
        try super.setUpWithError()
        
        // Initialize mocks
        mockSensorProcessor = MockSensorDataProcessor()
        mockAnalyticsService = MockAnalyticsService()
        mockSessionManager = MockSecureSessionManager()
        mockPerformanceMonitor = MockPerformanceMonitor()
        mockAuditLogger = MockAuditLogger()
        
        // Initialize view model
        sut = DashboardViewModel(
            analyticsService: mockAnalyticsService,
            sessionManager: mockSessionManager,
            performanceMonitor: mockPerformanceMonitor,
            auditLogger: mockAuditLogger
        )
        
        // Initialize cancellables set
        cancellables = Set<AnyCancellable>()
        
        // Configure performance metrics
        performanceMetrics = XCTMeasureOptions()
        performanceMetrics.iterationCount = 100
        
        // Add memory leak tracking
        addTeardownBlock { [weak sut] in
            XCTAssertNil(sut, "DashboardViewModel should be deallocated")
        }
    }
    
    override func tearDownWithError() throws {
        sut = nil
        mockSensorProcessor = nil
        mockAnalyticsService = nil
        mockSessionManager = nil
        mockPerformanceMonitor = nil
        mockAuditLogger = nil
        cancellables = nil
        performanceMetrics = nil
        try super.tearDownWithError()
    }
    
    // MARK: - Real-time Processing Tests
    
    func testRealTimeProcessingPerformance() throws {
        // Given
        let processingExpectation = expectation(description: "Processing completed")
        let latencyThreshold = 0.100 // 100ms requirement
        var processingTimes: [TimeInterval] = []
        
        // Configure performance monitoring
        mockPerformanceMonitor.onOperationEnd = { token, duration in
            processingTimes.append(duration)
            if processingTimes.count == 100 {
                processingExpectation.fulfill()
            }
        }
        
        // When
        measure(options: performanceMetrics) {
            // Generate test sensor data
            let sensorData = try! SensorData(
                sensorId: "TEST_SENSOR",
                type: .imu,
                readings: Array(repeating: 1.0, count: 100)
            )
            
            // Process data
            Task {
                _ = await sut.processSensorUpdate(sensorData)
            }
        }
        
        // Then
        wait(for: [processingExpectation], timeout: 10.0)
        
        let averageProcessingTime = processingTimes.reduce(0, +) / Double(processingTimes.count)
        XCTAssertLessThan(averageProcessingTime, latencyThreshold, "Processing time exceeds 100ms requirement")
        
        // Verify memory usage
        let memoryMetrics = XCTMemoryMetric()
        measure(metrics: [memoryMetrics]) {
            autoreleasepool {
                Task {
                    _ = await sut.processSensorUpdate(try! SensorData(
                        sensorId: "TEST_SENSOR",
                        type: .imu,
                        readings: Array(repeating: 1.0, count: 100)
                    ))
                }
            }
        }
    }
    
    // MARK: - Session Handling Tests
    
    func testConcurrentSessionHandling() async throws {
        // Given
        let concurrentSessions = 5
        let sessionsExpectation = expectation(description: "All sessions processed")
        sessionsExpectation.expectedFulfillmentCount = concurrentSessions
        
        var activeSessionCount = 0
        let sessionCountLock = NSLock()
        
        // When
        for i in 0..<concurrentSessions {
            Task {
                let athleteId = UUID()
                let result = await sut.startSession(athleteId: athleteId)
                
                // Then
                XCTAssertTrue(result.isSuccess, "Session \(i) failed to start")
                
                sessionCountLock.lock()
                activeSessionCount += 1
                if activeSessionCount == concurrentSessions {
                    sessionsExpectation.fulfill()
                }
                sessionCountLock.unlock()
                
                // Verify session state
                XCTAssertNotNil(sut.currentSession, "Session should be active")
                XCTAssertNotNil(sut.metrics, "Metrics should be initialized")
                XCTAssertFalse(sut.isLoading, "Loading state should be false")
            }
        }
        
        await fulfillment(of: [sessionsExpectation], timeout: 5.0)
        
        // Verify thread safety
        XCTAssertEqual(activeSessionCount, concurrentSessions, "All sessions should complete")
        XCTAssertNil(sut.error, "No errors should occur during concurrent sessions")
    }
    
    // MARK: - Error Handling Tests
    
    func testErrorHandling() async throws {
        // Given
        let errorExpectation = expectation(description: "Error handled")
        
        // Configure mock analytics service to throw error
        mockAnalyticsService.shouldSimulateError = true
        mockAnalyticsService.simulatedError = DashboardError.dataProcessingError("Test error")
        
        // When
        let invalidData = try SensorData(
            sensorId: "INVALID_SENSOR",
            type: .imu,
            readings: []
        )
        
        let result = await sut.processSensorUpdate(invalidData)
        
        // Then
        switch result {
        case .success:
            XCTFail("Should fail with invalid data")
        case .failure(let error):
            XCTAssertEqual(error as? DashboardError, .dataProcessingError("Test error"))
            errorExpectation.fulfill()
        }
        
        await fulfillment(of: [errorExpectation], timeout: 2.0)
        
        // Verify error state
        XCTAssertNotNil(sut.error, "Error should be set")
        XCTAssertFalse(sut.isLoading, "Loading state should be false")
        
        // Verify audit logging
        XCTAssertTrue(mockAuditLogger.logCalled, "Error should be logged")
    }
    
    // MARK: - Heat Map Tests
    
    func testHeatMapGeneration() async throws {
        // Given
        let heatMapExpectation = expectation(description: "Heat map generated")
        let testData = try SensorData(
            sensorId: "TEST_SENSOR",
            type: .tof,
            readings: Array(repeating: 1.0, count: 100)
        )
        
        // Configure mock analytics service
        mockAnalyticsService.mockHeatMapData = ["0:0": 0.5, "1:1": 0.75]
        
        // When
        let result = await sut.processSensorUpdate(testData)
        
        // Then
        XCTAssertTrue(result.isSuccess, "Heat map generation should succeed")
        XCTAssertFalse(sut.heatMapData.isEmpty, "Heat map data should not be empty")
        XCTAssertEqual(sut.heatMapData.count, 2, "Heat map should contain expected data points")
        
        // Verify performance
        let startTime = CACurrentMediaTime()
        _ = await sut.processSensorUpdate(testData)
        let processingTime = CACurrentMediaTime() - startTime
        
        XCTAssertLessThan(processingTime, 0.100, "Heat map generation should complete within 100ms")
        heatMapExpectation.fulfill()
        
        await fulfillment(of: [heatMapExpectation], timeout: 2.0)
    }
    
    // MARK: - Helper Methods
    
    private func createMockSensorData() throws -> SensorData {
        return try SensorData(
            sensorId: "TEST_SENSOR",
            type: .imu,
            readings: Array(repeating: 1.0, count: 100),
            bufferSize: 1024,
            compressionRatio: 10.0
        )
    }
}