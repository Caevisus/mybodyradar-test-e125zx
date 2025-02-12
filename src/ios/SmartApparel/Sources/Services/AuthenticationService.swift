import Foundation // latest
import Combine // latest
import LocalAuthentication // latest

/// Enterprise-grade authentication service managing secure user authentication, session handling, and token management
/// with advanced security features including certificate pinning, rate limiting, and jailbreak detection.
@available(iOS 14.0, *)
public final class AuthenticationService {
    
    // MARK: - Types
    
    /// Authentication state tracking
    private enum AuthState {
        case initial
        case authenticating
        case authenticated(User)
        case refreshing
        case failed(AuthenticationError)
    }
    
    /// Rate limiting configuration
    private struct RateLimiter {
        let maxAttempts: Int = AppConstants.SESSION_CONFIG.MAX_FAILED_AUTH_ATTEMPTS
        let lockoutDuration: TimeInterval = TimeInterval(AppConstants.SESSION_CONFIG.LOCKOUT_DURATION_MINUTES * 60)
        var attempts: Int = 0
        var lastAttemptTime: Date?
        
        mutating func recordAttempt() -> Bool {
            let now = Date()
            if let lastAttempt = lastAttemptTime,
               now.timeIntervalSince(lastAttempt) > lockoutDuration {
                attempts = 0
            }
            
            attempts += 1
            lastAttemptTime = now
            return attempts <= maxAttempts
        }
        
        mutating func reset() {
            attempts = 0
            lastAttemptTime = nil
        }
    }
    
    // MARK: - Properties
    
    /// Shared singleton instance
    public static let shared = AuthenticationService()
    
    /// Thread-safe authentication state publisher
    private let authStateSubject = CurrentValueSubject<AuthenticationState, Never>(.unauthenticated)
    
    /// Current authenticated user
    private var currentUser: User? {
        didSet {
            if let user = currentUser {
                authStateSubject.send(.authenticated)
                setupSessionMonitoring(for: user)
            } else {
                authStateSubject.send(.unauthenticated)
                sessionMonitor?.cancel()
            }
        }
    }
    
    /// Network client for API requests
    private let apiClient: APIClient
    
    /// Serial queue for thread-safe operations
    private let queue: DispatchQueue
    
    /// Rate limiter for authentication attempts
    private var rateLimiter: RateLimiter
    
    /// Session monitoring cancellable
    private var sessionMonitor: AnyCancellable?
    
    /// Token refresh task
    private var tokenRefreshTask: Task<Void, Error>?
    
    // MARK: - Initialization
    
    private init() {
        self.apiClient = .shared
        self.queue = DispatchQueue(label: "com.smartapparel.auth", qos: .userInitiated)
        self.rateLimiter = RateLimiter()
        
        // Verify device security on initialization
        guard SecurityUtils.isDeviceSecure() else {
            authStateSubject.send(.error)
            return
        }
    }
    
    // MARK: - Public Methods
    
    /// Authenticates user with email and password
    /// - Parameters:
    ///   - email: User email
    ///   - password: User password
    /// - Returns: Publisher with authenticated user or error
    public func login(email: String, password: String) -> AnyPublisher<User, AuthenticationError> {
        return Future { [weak self] promise in
            guard let self = self else {
                promise(.failure(.serverError))
                return
            }
            
            self.queue.async {
                // Check rate limiting
                guard self.rateLimiter.recordAttempt() else {
                    promise(.failure(.rateLimitExceeded))
                    return
                }
                
                // Verify device integrity
                guard SecurityUtils.isDeviceSecure() else {
                    promise(.failure(.deviceCompromised))
                    return
                }
                
                // Prepare login request
                let credentials = [
                    "email": email,
                    "password": password,
                    "deviceId": UIDevice.current.identifierForVendor?.uuidString ?? ""
                ]
                
                // Make API request
                self.apiClient.request(
                    endpoint: APIConstants.API_ENDPOINTS["AUTH"]!["LOGIN"]!,
                    method: .post,
                    body: credentials,
                    requiresAuth: false
                )
                .retry(3)
                .tryMap { (response: LoginResponse) -> User in
                    // Handle successful authentication
                    self.handleSuccessfulAuth(
                        token: response.token,
                        refreshToken: response.refreshToken,
                        expiresIn: response.expiresIn
                    )
                    
                    // Reset rate limiter on success
                    self.rateLimiter.reset()
                    
                    return response.user
                }
                .sink(
                    receiveCompletion: { completion in
                        if case .failure(let error) = completion {
                            promise(.failure(self.mapError(error)))
                        }
                    },
                    receiveValue: { user in
                        self.currentUser = user
                        promise(.success(user))
                    }
                )
                .store(in: &self.sessionMonitor)
            }
        }.eraseToAnyPublisher()
    }
    
    /// Authenticates user using biometric authentication
    /// - Returns: Publisher with authenticated user or error
    public func loginWithBiometrics() -> AnyPublisher<User, AuthenticationError> {
        return Future { [weak self] promise in
            guard let self = self else {
                promise(.failure(.serverError))
                return
            }
            
            self.queue.async {
                // Verify biometric availability
                SecurityUtils.authenticateWithBiometrics(
                    reason: "Log in to Smart Apparel"
                ) { result in
                    switch result {
                    case .success:
                        // Retrieve stored credentials
                        switch SecurityUtils.retrieveSecureItem(key: "biometric_credentials") {
                        case .success(let credentialsData):
                            do {
                                let credentials = try JSONDecoder().decode(BiometricCredentials.self, from: credentialsData)
                                // Attempt login with stored credentials
                                self.login(email: credentials.email, password: credentials.password)
                                    .sink(
                                        receiveCompletion: { completion in
                                            if case .failure(let error) = completion {
                                                promise(.failure(error))
                                            }
                                        },
                                        receiveValue: { user in
                                            promise(.success(user))
                                        }
                                    )
                                    .store(in: &self.sessionMonitor)
                            } catch {
                                promise(.failure(.invalidCredentials))
                            }
                        case .failure:
                            promise(.failure(.biometricsFailed))
                        }
                    case .failure(let error):
                        promise(.failure(self.mapSecurityError(error)))
                    }
                }
            }
        }.eraseToAnyPublisher()
    }
    
    /// Logs out current user and cleans up session
    public func logout() {
        queue.async { [weak self] in
            guard let self = self else { return }
            
            // Cancel any ongoing token refresh
            self.tokenRefreshTask?.cancel()
            
            // Clear session monitoring
            self.sessionMonitor?.cancel()
            
            // Clear stored credentials
            _ = SecurityUtils.storeSecureItem(
                data: Data(),
                key: "biometric_credentials",
                accessLevel: .whenUnlockedThisDeviceOnly
            )
            
            // Clear current user and token
            self.currentUser = nil
            self.apiClient.handleAuthentication(token: "", expiration: Date())
            
            // Update authentication state
            self.authStateSubject.send(.unauthenticated)
        }
    }
    
    /// Provides publisher for observing authentication state changes
    public func observeAuthState() -> AnyPublisher<AuthenticationState, Never> {
        return authStateSubject.eraseToAnyPublisher()
    }
    
    // MARK: - Private Methods
    
    private func handleSuccessfulAuth(token: String, refreshToken: String, expiresIn: TimeInterval) {
        // Store authentication token
        self.apiClient.handleAuthentication(
            token: token,
            expiration: Date().addingTimeInterval(expiresIn)
        )
        
        // Store refresh token securely
        _ = SecurityUtils.storeSecureItem(
            data: refreshToken.data(using: .utf8) ?? Data(),
            key: "refresh_token",
            accessLevel: .whenUnlockedThisDeviceOnly
        )
        
        // Schedule token refresh
        setupTokenRefresh(expiresIn: expiresIn)
    }
    
    private func setupSessionMonitoring(for user: User) {
        sessionMonitor = Timer.publish(
            every: AppConstants.SESSION_CONFIG.SESSION_SYNC_INTERVAL,
            on: .main,
            in: .common
        )
        .autoconnect()
        .sink { [weak self] _ in
            self?.validateSession()
        }
    }
    
    private func setupTokenRefresh(expiresIn: TimeInterval) {
        let refreshInterval = expiresIn - 300 // Refresh 5 minutes before expiration
        
        tokenRefreshTask = Task {
            try await Task.sleep(nanoseconds: UInt64(refreshInterval * 1_000_000_000))
            await refreshToken()
        }
    }
    
    private func refreshToken() async {
        guard let refreshToken = try? SecurityUtils.retrieveSecureItem(key: "refresh_token")
            .get(),
            let tokenString = String(data: refreshToken, encoding: .utf8) else {
            logout()
            return
        }
        
        do {
            let response: LoginResponse = try await apiClient.request(
                endpoint: APIConstants.API_ENDPOINTS["AUTH"]!["REFRESH"]!,
                method: .post,
                body: ["refreshToken": tokenString],
                requiresAuth: false
            ).async()
            
            handleSuccessfulAuth(
                token: response.token,
                refreshToken: response.refreshToken,
                expiresIn: response.expiresIn
            )
        } catch {
            logout()
        }
    }
    
    private func validateSession() {
        guard currentUser != nil else {
            logout()
            return
        }
    }
    
    private func mapError(_ error: Error) -> AuthenticationError {
        switch error {
        case is URLError:
            return .networkError
        case is DecodingError:
            return .serverError
        default:
            return .invalidCredentials
        }
    }
    
    private func mapSecurityError(_ error: SecurityUtils.SecurityError) -> AuthenticationError {
        switch error {
        case .biometricsNotAvailable:
            return .biometricsFailed
        case .deviceNotSecure, .jailbreakDetected:
            return .deviceCompromised
        case .maxAttemptsExceeded:
            return .rateLimitExceeded
        default:
            return .unauthorized
        }
    }
}

// MARK: - Supporting Types

private struct LoginResponse: Decodable {
    let user: User
    let token: String
    let refreshToken: String
    let expiresIn: TimeInterval
}

private struct BiometricCredentials: Codable {
    let email: String
    let password: String
}