import XCTest
import Combine
import LocalAuthentication
@testable import SmartApparel

/// Test constants for authentication testing
private struct TestConstants {
    static let validEmail = "test@example.com"
    static let validPassword = "Password123!"
    static let validTOTP = "123456"
    static let invalidEmail = "invalid"
    static let invalidPassword = "short"
    static let invalidTOTP = "000000"
    static let sessionTimeout = 3600.0
}

@available(iOS 14.0, *)
final class AuthenticationServiceTests: XCTestCase {
    
    // MARK: - Properties
    
    private var sut: AuthenticationService!
    private var mockAPIClient: MockAPIClient!
    private var securityUtils: SecurityUtils!
    private var cancellables: Set<AnyCancellable>!
    
    // MARK: - Setup/Teardown
    
    override func setUp() {
        super.setUp()
        
        // Initialize test dependencies
        mockAPIClient = MockAPIClient.shared
        securityUtils = SecurityUtils()
        sut = AuthenticationService.shared
        cancellables = Set<AnyCancellable>()
        
        // Reset mock state
        mockAPIClient.reset()
    }
    
    override func tearDown() {
        // Clean up test state
        mockAPIClient.reset()
        sut.logout()
        cancellables.removeAll()
        
        super.tearDown()
    }
    
    // MARK: - Login Tests
    
    func testLoginSuccess() throws {
        // Given
        let expectation = XCTestExpectation(description: "Login success")
        let mockResponse = LoginResponse(
            user: User(id: UUID(), email: TestConstants.validEmail, hashedPassword: "hash", firstName: "Test", lastName: "User", role: .athlete),
            token: "valid_token",
            refreshToken: "valid_refresh_token",
            expiresIn: TestConstants.sessionTimeout
        )
        let mockData = try JSONEncoder().encode(mockResponse)
        mockAPIClient.setMockResponse(type: .success, mockData: mockData)
        
        // When
        sut.login(email: TestConstants.validEmail, password: TestConstants.validPassword)
            .sink(
                receiveCompletion: { completion in
                    if case .failure = completion {
                        XCTFail("Login should succeed")
                    }
                },
                receiveValue: { user in
                    // Then
                    XCTAssertEqual(user.id, mockResponse.user.id)
                    XCTAssertTrue(SecurityUtils.verifyTokenSecurity("valid_token"))
                    expectation.fulfill()
                }
            )
            .store(in: &cancellables)
        
        wait(for: [expectation], timeout: 5.0)
    }
    
    func testLoginFailure() {
        // Given
        let expectation = XCTestExpectation(description: "Login failure")
        mockAPIClient.setMockResponse(type: .authError("Invalid credentials"))
        
        // When
        sut.login(email: TestConstants.invalidEmail, password: TestConstants.invalidPassword)
            .sink(
                receiveCompletion: { completion in
                    if case .failure(let error) = completion {
                        // Then
                        XCTAssertEqual(error, .invalidCredentials)
                        expectation.fulfill()
                    }
                },
                receiveValue: { _ in
                    XCTFail("Login should fail")
                }
            )
            .store(in: &cancellables)
        
        wait(for: [expectation], timeout: 5.0)
    }
    
    // MARK: - Biometric Authentication Tests
    
    func testBiometricLogin() throws {
        // Given
        let expectation = XCTestExpectation(description: "Biometric login")
        let context = LAContext()
        let mockResponse = LoginResponse(
            user: User(id: UUID(), email: TestConstants.validEmail, hashedPassword: "hash", firstName: "Test", lastName: "User", role: .athlete),
            token: "valid_token",
            refreshToken: "valid_refresh_token",
            expiresIn: TestConstants.sessionTimeout
        )
        let mockData = try JSONEncoder().encode(mockResponse)
        mockAPIClient.setMockResponse(type: .success, mockData: mockData)
        
        // When
        sut.loginWithBiometrics()
            .sink(
                receiveCompletion: { completion in
                    if case .failure = completion {
                        XCTFail("Biometric login should succeed")
                    }
                },
                receiveValue: { user in
                    // Then
                    XCTAssertEqual(user.id, mockResponse.user.id)
                    XCTAssertTrue(SecurityUtils.verifyTokenSecurity("valid_token"))
                    expectation.fulfill()
                }
            )
            .store(in: &cancellables)
        
        wait(for: [expectation], timeout: 5.0)
    }
    
    // MARK: - OAuth Flow Tests
    
    func testOAuthFlow() throws {
        // Given
        let expectation = XCTestExpectation(description: "OAuth flow")
        let mockResponse = LoginResponse(
            user: User(id: UUID(), email: TestConstants.validEmail, hashedPassword: "hash", firstName: "Test", lastName: "User", role: .athlete),
            token: "valid_token",
            refreshToken: "valid_refresh_token",
            expiresIn: TestConstants.sessionTimeout
        )
        let mockData = try JSONEncoder().encode(mockResponse)
        mockAPIClient.setMockResponse(type: .success, mockData: mockData)
        
        // When
        sut.loginWithOAuth()
            .sink(
                receiveCompletion: { completion in
                    if case .failure = completion {
                        XCTFail("OAuth flow should succeed")
                    }
                },
                receiveValue: { user in
                    // Then
                    XCTAssertEqual(user.id, mockResponse.user.id)
                    XCTAssertTrue(SecurityUtils.verifyTokenSecurity("valid_token"))
                    expectation.fulfill()
                }
            )
            .store(in: &cancellables)
        
        wait(for: [expectation], timeout: 5.0)
    }
    
    // MARK: - Multi-Factor Authentication Tests
    
    func testMultiFactorAuth() throws {
        // Given
        let expectation = XCTestExpectation(description: "MFA verification")
        let mockResponse = LoginResponse(
            user: User(id: UUID(), email: TestConstants.validEmail, hashedPassword: "hash", firstName: "Test", lastName: "User", role: .athlete),
            token: "valid_token",
            refreshToken: "valid_refresh_token",
            expiresIn: TestConstants.sessionTimeout
        )
        let mockData = try JSONEncoder().encode(mockResponse)
        mockAPIClient.setMockResponse(type: .success, mockData: mockData)
        
        // When
        sut.verifyTOTP(TestConstants.validTOTP)
            .sink(
                receiveCompletion: { completion in
                    if case .failure = completion {
                        XCTFail("TOTP verification should succeed")
                    }
                },
                receiveValue: { user in
                    // Then
                    XCTAssertEqual(user.id, mockResponse.user.id)
                    XCTAssertTrue(SecurityUtils.verifyTokenSecurity("valid_token"))
                    expectation.fulfill()
                }
            )
            .store(in: &cancellables)
        
        wait(for: [expectation], timeout: 5.0)
    }
    
    // MARK: - Session Management Tests
    
    func testSessionManagement() throws {
        // Given
        let expectation = XCTestExpectation(description: "Session management")
        let mockResponse = LoginResponse(
            user: User(id: UUID(), email: TestConstants.validEmail, hashedPassword: "hash", firstName: "Test", lastName: "User", role: .athlete),
            token: "valid_token",
            refreshToken: "valid_refresh_token",
            expiresIn: TestConstants.sessionTimeout
        )
        let mockData = try JSONEncoder().encode(mockResponse)
        mockAPIClient.setMockResponse(type: .success, mockData: mockData)
        
        // When
        sut.login(email: TestConstants.validEmail, password: TestConstants.validPassword)
            .flatMap { _ in
                // Simulate session timeout
                Timer.publish(every: TestConstants.sessionTimeout + 1, on: .main, in: .common)
                    .autoconnect()
                    .first()
                    .flatMap { _ in
                        self.sut.refreshToken()
                    }
                    .eraseToAnyPublisher()
            }
            .sink(
                receiveCompletion: { completion in
                    if case .failure = completion {
                        XCTFail("Session refresh should succeed")
                    }
                },
                receiveValue: { _ in
                    // Then
                    XCTAssertTrue(SecurityUtils.verifyTokenSecurity("valid_token"))
                    expectation.fulfill()
                }
            )
            .store(in: &cancellables)
        
        wait(for: [expectation], timeout: TestConstants.sessionTimeout + 5.0)
    }
}