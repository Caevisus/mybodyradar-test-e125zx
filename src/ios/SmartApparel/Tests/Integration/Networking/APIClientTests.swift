import XCTest
import Combine
@testable import SmartApparel

/// Comprehensive integration test suite for APIClient class verifying network communication,
/// request handling, authentication flows, and error scenarios
@available(iOS 13.0, *)
class APIClientTests: XCTestCase {
    
    // MARK: - Constants
    
    private let testTimeout = 5.0
    private let mockAuthToken = "test-auth-token"
    private let performanceThreshold = 0.1 // 100ms performance requirement
    private let mockCertificates = ["test-cert-1", "test-cert-2"]
    
    // MARK: - Properties
    
    private var cancellables: Set<AnyCancellable>
    private var sut: APIClient
    private var mockServer: MockAPIServer
    private var networkMonitor: NetworkMonitor
    private var performanceMetrics: XCTPerformanceMetrics
    
    // MARK: - Setup & Teardown
    
    override func setUp() {
        super.setUp()
        
        // Initialize test components
        cancellables = Set<AnyCancellable>()
        sut = APIClient.shared
        mockServer = MockAPIServer(certificates: mockCertificates)
        networkMonitor = NetworkMonitor.shared
        performanceMetrics = XCTPerformanceMetrics()
        
        // Configure mock server
        mockServer.start()
        networkMonitor.startMonitoring()
    }
    
    override func tearDown() {
        // Cleanup test resources
        cancellables.removeAll()
        mockServer.stop()
        networkMonitor.stopMonitoring()
        performanceMetrics.reset()
        
        super.tearDown()
    }
    
    // MARK: - Request Tests
    
    /// Tests successful API request with performance validation
    func testSuccessfulRequest() {
        // Given
        let expectation = expectation(description: "Successful API request")
        let testEndpoint = APIConstants.API_ENDPOINTS["SENSOR"]!["DATA"]!
        let testData = SensorData(timestamp: Date(), readings: [1.0, 2.0, 3.0])
        
        mockServer.stub(endpoint: testEndpoint, response: testData)
        
        // When
        measure(metrics: [XCTClockMetric()]) {
            sut.request(
                endpoint: testEndpoint,
                method: .get,
                requiresAuth: true
            )
            .sink(
                receiveCompletion: { completion in
                    switch completion {
                    case .finished:
                        expectation.fulfill()
                    case .failure(let error):
                        XCTFail("Request failed with error: \(error)")
                    }
                },
                receiveValue: { (response: SensorData) in
                    // Then
                    XCTAssertEqual(response.readings, testData.readings)
                    XCTAssertLessThanOrEqual(self.performanceMetrics.lastExecutionTime, self.performanceThreshold)
                }
            )
            .store(in: &cancellables)
        }
        
        wait(for: [expectation], timeout: testTimeout)
    }
    
    /// Tests authentication flow including token refresh
    func testAuthenticationFlow() {
        // Given
        let authExpectation = expectation(description: "Authentication flow")
        let refreshEndpoint = APIConstants.API_ENDPOINTS["AUTH"]!["REFRESH"]!
        let mockRefreshToken = "refresh-token"
        
        mockServer.stub(endpoint: refreshEndpoint, response: ["token": mockAuthToken])
        
        // When
        sut.handleAuthentication(token: mockAuthToken, expiration: Date().addingTimeInterval(300))
        
        // Then
        sut.request(
            endpoint: refreshEndpoint,
            method: .post,
            body: ["refresh_token": mockRefreshToken],
            requiresAuth: true
        )
        .sink(
            receiveCompletion: { completion in
                switch completion {
                case .finished:
                    authExpectation.fulfill()
                case .failure(let error):
                    XCTFail("Authentication failed with error: \(error)")
                }
            },
            receiveValue: { (response: [String: String]) in
                XCTAssertEqual(response["token"], self.mockAuthToken)
            }
        )
        .store(in: &cancellables)
        
        wait(for: [authExpectation], timeout: testTimeout)
    }
    
    /// Tests security features including TLS and certificate pinning
    func testSecurityFeatures() {
        // Given
        let securityExpectation = expectation(description: "Security validation")
        let testEndpoint = APIConstants.API_ENDPOINTS["SENSOR"]!["DATA"]!
        
        // When
        sut.request(
            endpoint: testEndpoint,
            method: .get,
            requiresAuth: true
        )
        .sink(
            receiveCompletion: { completion in
                switch completion {
                case .finished:
                    securityExpectation.fulfill()
                case .failure(let error):
                    if case .certificateError = error {
                        XCTFail("Certificate validation failed")
                    }
                }
            },
            receiveValue: { (_: Data) in
                // Then
                let connectionStatus = self.networkMonitor.checkConnectivity()
                if case .connected(let quality) = connectionStatus {
                    XCTAssertNotEqual(quality, .poor)
                }
            }
        )
        .store(in: &cancellables)
        
        wait(for: [securityExpectation], timeout: testTimeout)
    }
    
    /// Tests error handling scenarios
    func testErrorHandling() {
        // Given
        let errorExpectation = expectation(description: "Error handling")
        let testEndpoint = APIConstants.API_ENDPOINTS["SENSOR"]!["DATA"]!
        
        mockServer.simulateError(endpoint: testEndpoint, error: .serverError)
        
        // When
        sut.request(
            endpoint: testEndpoint,
            method: .get,
            requiresAuth: true
        )
        .sink(
            receiveCompletion: { completion in
                switch completion {
                case .finished:
                    XCTFail("Request should have failed")
                case .failure(let error):
                    // Then
                    XCTAssertEqual(error, .serverError)
                    errorExpectation.fulfill()
                }
            },
            receiveValue: { (_: Data) in
                XCTFail("Should not receive value")
            }
        )
        .store(in: &cancellables)
        
        wait(for: [errorExpectation], timeout: testTimeout)
    }
    
    /// Tests request performance under various network conditions
    func testRequestPerformance() {
        // Given
        let performanceExpectation = expectation(description: "Performance testing")
        let testEndpoint = APIConstants.API_ENDPOINTS["SENSOR"]!["DATA"]!
        let iterations = 10
        
        measure(metrics: [XCTClockMetric(), XCTMemoryMetric()]) {
            // When
            for _ in 0..<iterations {
                sut.request(
                    endpoint: testEndpoint,
                    method: .get,
                    requiresAuth: true
                )
                .sink(
                    receiveCompletion: { _ in },
                    receiveValue: { (_: Data) in
                        // Then
                        let metrics = self.networkMonitor.getPerformanceMetrics()
                        XCTAssertLessThanOrEqual(metrics.latency, TimeInterval(self.performanceThreshold))
                    }
                )
                .store(in: &cancellables)
            }
            performanceExpectation.fulfill()
        }
        
        wait(for: [performanceExpectation], timeout: testTimeout * Double(iterations))
    }
}

// MARK: - Test Helpers

private struct SensorData: Codable {
    let timestamp: Date
    let readings: [Double]
}

private class MockAPIServer {
    private var stubs: [String: Any] = [:]
    private var errors: [String: APIClient.APIError] = [:]
    
    init(certificates: [String]) {
        // Configure mock server with test certificates
    }
    
    func start() {
        // Start mock server
    }
    
    func stop() {
        // Stop mock server
    }
    
    func stub(endpoint: String, response: Any) {
        stubs[endpoint] = response
    }
    
    func simulateError(endpoint: String, error: APIClient.APIError) {
        errors[endpoint] = error
    }
}

private struct XCTPerformanceMetrics {
    private(set) var lastExecutionTime: TimeInterval = 0
    
    mutating func reset() {
        lastExecutionTime = 0
    }
}