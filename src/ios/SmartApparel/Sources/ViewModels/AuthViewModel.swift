import Foundation // latest
import Combine // latest

/// Enterprise-grade ViewModel responsible for managing secure authentication state, multi-factor authentication flows,
/// and user session management with comprehensive security, performance monitoring, and compliance features.
@MainActor
@available(iOS 14.0, *)
public final class AuthViewModel: ObservableObject {
    
    // MARK: - Types
    
    /// Represents the current authentication state with detailed status information
    private enum AuthState {
        case initial
        case authenticating
        case authenticated(User)
        case failed(AuthViewModelError)
        case sessionExpired
    }
    
    // MARK: - Properties
    
    private let authService: AuthenticationService
    private let securityUtils: SecurityUtils
    private var cancellables = Set<AnyCancellable>()
    private var authAttempts: [Date] = []
    
    @Published private(set) var isLoading = false
    @Published private(set) var error: AuthViewModelError?
    @Published private(set) var currentUser: User?
    @Published private(set) var isAuthenticated = false
    @Published private(set) var sessionExpiryDate: Date?
    
    private let sessionDuration: TimeInterval
    private let maxAuthAttempts: Int
    private let authTimeoutInterval: TimeInterval
    private var sessionRefreshTask: Task<Void, Never>?
    
    // MARK: - Initialization
    
    public init() {
        self.authService = .shared
        self.securityUtils = SecurityUtils()
        self.sessionDuration = TimeInterval(AppConstants.SESSION_CONFIG.MAX_SESSION_DURATION_HOURS * 3600)
        self.maxAuthAttempts = AppConstants.SESSION_CONFIG.MAX_FAILED_AUTH_ATTEMPTS
        self.authTimeoutInterval = AppConstants.SESSION_CONFIG.REQUEST_TIMEOUT
        
        setupAuthenticationObserver()
        setupSessionMonitoring()
    }
    
    // MARK: - Public Methods
    
    /// Authenticates user with email and password with comprehensive security checks
    /// - Parameters:
    ///   - email: User's email address
    ///   - password: User's password
    public func login(email: String, password: String) async {
        guard validateLoginAttempt() else {
            error = .rateLimitExceeded
            return
        }
        
        await performSecureLogin {
            try await authService.login(email: email, password: password)
                .async()
        }
    }
    
    /// Authenticates user using device biometrics with security validation
    public func loginWithBiometrics() async {
        guard validateLoginAttempt() else {
            error = .rateLimitExceeded
            return
        }
        
        await performSecureLogin {
            try await authService.loginWithBiometrics()
                .async()
        }
    }
    
    /// Securely logs out user and cleans up session state
    public func logout() async {
        isLoading = true
        error = nil
        
        do {
            // Cancel any ongoing session refresh
            sessionRefreshTask?.cancel()
            
            // Perform secure logout
            try await authService.logout()
                .async()
            
            // Clean up session state
            await cleanupSession()
            
            Logger.shared.log(
                "User logged out successfully",
                level: .info,
                category: .security
            )
        } catch {
            self.error = .securityError
            
            Logger.shared.error(
                "Logout failed",
                category: .security,
                error: error
            )
        }
        
        isLoading = false
    }
    
    // MARK: - Private Methods
    
    private func setupAuthenticationObserver() {
        authService.observeAuthState()
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                self?.handleAuthStateChange(state)
            }
            .store(in: &cancellables)
    }
    
    private func setupSessionMonitoring() {
        // Monitor session expiry
        Timer.publish(every: AppConstants.SESSION_CONFIG.SESSION_SYNC_INTERVAL, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.validateSession()
            }
            .store(in: &cancellables)
    }
    
    private func validateLoginAttempt() -> Bool {
        // Clean up old attempts
        let cutoff = Date().addingTimeInterval(-3600) // 1 hour window
        authAttempts = authAttempts.filter { $0 > cutoff }
        
        // Check rate limiting
        guard authAttempts.count < maxAuthAttempts else {
            Logger.shared.log(
                "Rate limit exceeded for login attempts",
                level: .warning,
                category: .security,
                metadata: ["attempts": authAttempts.count]
            )
            return false
        }
        
        authAttempts.append(Date())
        return true
    }
    
    private func performSecureLogin(loginOperation: () async throws -> User) async {
        isLoading = true
        error = nil
        
        do {
            // Verify device security
            guard SecurityUtils.isDeviceSecure() else {
                error = .securityError
                return
            }
            
            // Perform login
            let user = try await loginOperation()
            
            // Update authentication state
            currentUser = user
            isAuthenticated = true
            setupSessionExpiry(for: user)
            
            Logger.shared.log(
                "User authenticated successfully",
                level: .info,
                category: .security,
                metadata: ["userId": user.id.uuidString]
            )
        } catch {
            handleLoginError(error)
        }
        
        isLoading = false
    }
    
    private func setupSessionExpiry(for user: User) {
        // Calculate session expiry based on user role
        let duration: TimeInterval
        switch user.role {
        case .admin:
            duration = sessionDuration / 2 // Shorter sessions for admins
        case .medical:
            duration = sessionDuration / 1.5 // Medium sessions for medical staff
        default:
            duration = sessionDuration
        }
        
        sessionExpiryDate = Date().addingTimeInterval(duration)
        
        // Schedule session refresh
        setupSessionRefresh(duration: duration)
    }
    
    private func setupSessionRefresh(duration: TimeInterval) {
        sessionRefreshTask?.cancel()
        
        sessionRefreshTask = Task {
            let refreshInterval = duration - 300 // Refresh 5 minutes before expiry
            try? await Task.sleep(nanoseconds: UInt64(refreshInterval * 1_000_000_000))
            
            if !Task.isCancelled {
                await refreshSession()
            }
        }
    }
    
    private func refreshSession() async {
        do {
            try await authService.refreshToken()
                .async()
            
            if let user = currentUser {
                setupSessionExpiry(for: user)
            }
        } catch {
            await handleSessionExpiry()
        }
    }
    
    private func validateSession() {
        guard let expiryDate = sessionExpiryDate else { return }
        
        if Date() >= expiryDate {
            Task {
                await handleSessionExpiry()
            }
        }
    }
    
    private func handleSessionExpiry() async {
        await cleanupSession()
        error = .tokenExpired
    }
    
    private func cleanupSession() async {
        currentUser = nil
        isAuthenticated = false
        sessionExpiryDate = nil
        sessionRefreshTask?.cancel()
        authAttempts.removeAll()
    }
    
    private func handleLoginError(_ error: Error) {
        if let apiError = error as? APIClient.APIError {
            switch apiError {
            case .authenticationError:
                self.error = .authenticationFailed
            case .rateLimitExceeded:
                self.error = .rateLimitExceeded
            case .networkError:
                self.error = .networkError
            default:
                self.error = .authenticationFailed
            }
        } else {
            self.error = .authenticationFailed
        }
        
        Logger.shared.error(
            "Login failed",
            category: .security,
            error: error,
            metadata: ["attempts": authAttempts.count]
        )
    }
    
    private func handleAuthStateChange(_ state: AuthenticationState) {
        switch state {
        case .authenticated:
            isAuthenticated = true
            error = nil
        case .unauthenticated:
            Task {
                await cleanupSession()
            }
        case .error:
            error = .securityError
        }
    }
}

// MARK: - Supporting Types

public enum AuthViewModelError: Error {
    case invalidInput
    case authenticationFailed
    case biometricsNotAvailable
    case rateLimitExceeded
    case tokenExpired
    case networkError
    case securityError
    case stateError
}