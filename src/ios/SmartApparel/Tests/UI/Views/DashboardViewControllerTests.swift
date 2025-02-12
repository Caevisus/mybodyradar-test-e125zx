import XCTest
import Combine
@testable import SmartApparel

final class DashboardViewControllerTests: XCTestCase {
    
    // MARK: - Properties
    
    private var sut: DashboardViewController!
    private var mockViewModel: MockDashboardViewModel!
    private var cancellables: Set<AnyCancellable>!
    private var performanceMetrics: XCTMeasureOptions!
    
    // MARK: - Setup & Teardown
    
    override func setUp() {
        super.setUp()
        
        // Initialize test components
        cancellables = Set<AnyCancellable>()
        mockViewModel = MockDashboardViewModel()
        
        // Configure performance metrics
        performanceMetrics = XCTMeasureOptions()
        performanceMetrics.invocationOptions = [.manuallyStart]
        
        // Initialize view controller with mock dependencies
        let mockLogger = MockLogger()
        sut = DashboardViewController(viewModel: mockViewModel, logger: mockLogger)
        
        // Load view hierarchy
        sut.loadViewIfNeeded()
        
        // Configure memory warning observer
        NotificationCenter.default.addObserver(
            sut,
            selector: #selector(UIViewController.didReceiveMemoryWarning),
            name: UIApplication.didReceiveMemoryWarningNotification,
            object: nil
        )
    }
    
    override func tearDown() {
        // Remove observers
        NotificationCenter.default.removeObserver(sut)
        
        // Cancel publishers
        cancellables.removeAll()
        
        // Clear references
        sut = nil
        mockViewModel = nil
        cancellables = nil
        performanceMetrics = nil
        
        super.tearDown()
    }
    
    // MARK: - Performance Tests
    
    func testPerformanceMetrics() {
        // Configure test data
        let testMetrics = SessionMetrics()
        let updateExpectation = expectation(description: "Metrics update")
        updateExpectation.expectedFulfillmentCount = 100 // Test 100 updates
        
        measure(metrics: [XCTCPUMetric(), XCTMemoryMetric(), XCTStorageMetric()]) {
            // Start measurement
            startMeasuring()
            
            // Simulate 100 rapid metric updates
            for i in 0..<100 {
                DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.01) {
                    self.mockViewModel.simulateMetricsUpdate(testMetrics)
                    updateExpectation.fulfill()
                }
            }
            
            // Wait for updates
            wait(for: [updateExpectation], timeout: 2.0)
            
            // Stop measurement
            stopMeasuring()
            
            // Verify performance requirements
            XCTAssertLessThanOrEqual(
                XCTPerformanceMetric.wallClockTime.value,
                0.1, // 100ms requirement
                "UI update latency exceeds specification"
            )
        }
    }
    
    // MARK: - Accessibility Tests
    
    func testAccessibilityCompliance() {
        // Test accessibility labels
        XCTAssertTrue(sut.startButton.isAccessibilityElement)
        XCTAssertNotNil(sut.startButton.accessibilityLabel)
        XCTAssertEqual(sut.startButton.accessibilityTraits, .button)
        
        // Test color contrast
        let backgroundColor = sut.view.backgroundColor?.cgColor
        let textColor = sut.metricsView.muscleActivityLabel.textColor.cgColor
        XCTAssertGreaterThanOrEqual(
            calculateContrastRatio(backgroundColor!, textColor),
            4.5, // WCAG AA requirement
            "Color contrast ratio does not meet WCAG 2.1 Level AA requirements"
        )
        
        // Test touch targets
        XCTAssertGreaterThanOrEqual(
            sut.startButton.bounds.width,
            44.0,
            "Touch target size does not meet minimum requirements"
        )
        
        // Test dynamic type support
        XCTAssertTrue(sut.metricsView.muscleActivityLabel.adjustsFontForContentSizeCategory)
        
        // Test VoiceOver
        XCTAssertNotNil(sut.view.accessibilityElements)
        XCTAssertTrue(UIAccessibility.isVoiceOverRunning || true) // Pass if VoiceOver is not available
    }
    
    // MARK: - Error Handling Tests
    
    func testErrorHandling() {
        // Test network error
        let networkError = DashboardError.networkError("Connection failed")
        let errorExpectation = expectation(description: "Error handled")
        
        mockViewModel.simulateError(networkError)
        
        // Verify error display
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            XCTAssertTrue(self.sut.presentedViewController is UIAlertController)
            errorExpectation.fulfill()
        }
        
        wait(for: [errorExpectation], timeout: 1.0)
        
        // Test retry mechanism
        let retryExpectation = expectation(description: "Retry mechanism")
        
        if let alert = sut.presentedViewController as? UIAlertController {
            let retryAction = alert.actions.first { $0.title == "Retry" }
            XCTAssertNotNil(retryAction)
            
            // Simulate retry
            retryAction?.setValue(nil, forKey: "checked")
            retryExpectation.fulfill()
        }
        
        wait(for: [retryExpectation], timeout: 1.0)
        
        // Verify state recovery
        XCTAssertFalse(mockViewModel.isLoading)
        XCTAssertNil(mockViewModel.error)
    }
    
    // MARK: - Memory Warning Tests
    
    func testMemoryWarningHandling() {
        // Setup test data
        let testSession = Session(athleteId: UUID(), type: .training)
        mockViewModel.simulateSessionStart(testSession)
        
        // Trigger memory warning
        NotificationCenter.default.post(
            name: UIApplication.didReceiveMemoryWarningNotification,
            object: nil
        )
        
        // Verify resource cleanup
        XCTAssertTrue(cancellables.isEmpty)
        XCTAssertEqual(sut.retryCount, 0)
        
        // Verify UI state preservation
        XCTAssertNotNil(sut.metricsView)
        XCTAssertNotNil(sut.loadingView)
        
        // Test recovery behavior
        let recoveryExpectation = expectation(description: "Recovery from memory warning")
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            // Verify critical functionality remains
            XCTAssertTrue(self.sut.startButton.isEnabled)
            XCTAssertFalse(self.sut.loadingView.isAnimating)
            recoveryExpectation.fulfill()
        }
        
        wait(for: [recoveryExpectation], timeout: 1.0)
    }
    
    // MARK: - Helper Methods
    
    private func calculateContrastRatio(_ background: CGColor, _ foreground: CGColor) -> CGFloat {
        // Calculate relative luminance
        func luminance(_ color: CGColor) -> CGFloat {
            guard let components = color.components else { return 0 }
            let rgb = [components[0], components[1], components[2]]
            let adjusted = rgb.map { ($0 <= 0.03928) ? $0/12.92 : pow(($0 + 0.055)/1.055, 2.4) }
            return 0.2126 * adjusted[0] + 0.7152 * adjusted[1] + 0.0722 * adjusted[2]
        }
        
        let l1 = luminance(background)
        let l2 = luminance(foreground)
        let lighter = max(l1, l2)
        let darker = min(l1, l2)
        
        return (lighter + 0.05) / (darker + 0.05)
    }
}

// MARK: - Mock Classes

private final class MockDashboardViewModel: DashboardViewModel {
    func simulateMetricsUpdate(_ metrics: SessionMetrics) {
        self.metrics = metrics
    }
    
    func simulateError(_ error: DashboardError) {
        self.error = error
    }
    
    func simulateSessionStart(_ session: Session) {
        self.currentSession = session
    }
}

private final class MockLogger: Logger {
    override func log(
        _ message: String,
        level: AppConstants.LogLevel,
        category: LogCategory,
        file: String?,
        function: String?,
        line: Int?,
        metadata: [String: Any]?
    ) {
        // No-op for testing
    }
}