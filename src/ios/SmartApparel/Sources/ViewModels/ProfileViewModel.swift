import Foundation // latest
import Combine // latest
import CryptoKit // latest
import os.log // latest

/// View model responsible for managing user profile data, settings, and interactions
/// with enhanced security, accessibility, and performance features
@MainActor
public final class ProfileViewModel: ObservableObject {
    // MARK: - Published Properties
    
    @Published private(set) var viewState: ProfileViewState = .loading
    @Published private(set) var user: User?
    @Published private(set) var isAccessibilityEnabled: Bool = false
    
    // MARK: - Private Properties
    
    private let authService: AuthenticationService
    private let storageService: LocalStorageService
    private let logger: OSLog
    private var cancellables = Set<AnyCancellable>()
    private let debounceInterval: TimeInterval = 0.5
    
    // MARK: - Initialization
    
    public init() {
        self.authService = .shared
        self.storageService = .shared
        self.logger = OSLog(subsystem: AppConstants.APP_CONFIG.BUNDLE_ID, category: "ProfileViewModel")
        
        setupAccessibilityNotifications()
        loadCachedUserData()
        setupSessionMonitoring()
    }
    
    // MARK: - Public Methods
    
    /// Loads and decrypts the current user's profile data
    public func loadUserProfile() {
        Task {
            do {
                viewState = .loading
                
                // Check cached data first
                if let cachedData = try await getCachedUserData() {
                    self.user = cachedData
                    viewState = .loaded
                    return
                }
                
                // Validate current session
                guard let currentUser = authService.getCurrentUser() else {
                    viewState = .error(.sessionExpired)
                    return
                }
                
                // Update user and cache data
                self.user = currentUser
                try await cacheUserData(currentUser)
                viewState = .loaded
                
                os_log("Profile loaded successfully", log: logger, type: .info)
            } catch {
                os_log("Failed to load profile: %{public}@", log: logger, type: .error, error.localizedDescription)
                viewState = .error(.networkError)
            }
        }
    }
    
    /// Updates user profile information with encryption
    public func updateProfile(firstName: String, lastName: String, preferences: UserPreferences) -> AnyPublisher<Void, ProfileError> {
        return Future { [weak self] promise in
            guard let self = self else {
                promise(.failure(.validationError))
                return
            }
            
            Task {
                do {
                    // Validate session
                    guard let user = self.user else {
                        promise(.failure(.sessionExpired))
                        return
                    }
                    
                    // Update user profile
                    try user.updateProfile(firstName: firstName, lastName: lastName, preferences: preferences)
                    
                    // Save to local storage
                    try await self.cacheUserData(user)
                    
                    os_log("Profile updated successfully", log: self.logger, type: .info)
                    promise(.success(()))
                } catch {
                    os_log("Failed to update profile: %{public}@", log: self.logger, type: .error, error.localizedDescription)
                    promise(.failure(.storageError))
                }
            }
        }
        .receive(on: DispatchQueue.main)
        .eraseToAnyPublisher()
    }
    
    /// Updates user's password with security validations
    public func updatePassword(currentPassword: String, newPassword: String) -> AnyPublisher<Void, ProfileError> {
        return Future { [weak self] promise in
            guard let self = self else {
                promise(.failure(.validationError))
                return
            }
            
            Task {
                do {
                    // Validate session
                    guard authService.validateSession() else {
                        promise(.failure(.sessionExpired))
                        return
                    }
                    
                    // Verify password complexity
                    guard self.validatePasswordComplexity(newPassword) else {
                        promise(.failure(.validationError))
                        return
                    }
                    
                    // Update password through auth service
                    try await self.authService.updatePassword(current: currentPassword, new: newPassword)
                    
                    os_log("Password updated successfully", log: self.logger, type: .info)
                    promise(.success(()))
                } catch {
                    os_log("Failed to update password: %{public}@", log: self.logger, type: .error, error.localizedDescription)
                    promise(.failure(.securityError))
                }
            }
        }
        .receive(on: DispatchQueue.main)
        .eraseToAnyPublisher()
    }
    
    /// Saves user preferences with encryption
    public func savePreferences(_ preferences: UserPreferences) -> AnyPublisher<Void, ProfileError> {
        return Future { [weak self] promise in
            guard let self = self else {
                promise(.failure(.validationError))
                return
            }
            
            Task {
                do {
                    // Validate session
                    guard let user = self.user else {
                        promise(.failure(.sessionExpired))
                        return
                    }
                    
                    // Save preferences to local storage
                    try await self.storageService.saveData(
                        preferences,
                        forKey: "user_preferences_\(user.id)",
                        encrypt: true
                    )
                    
                    os_log("Preferences saved successfully", log: self.logger, type: .info)
                    promise(.success(()))
                } catch {
                    os_log("Failed to save preferences: %{public}@", log: self.logger, type: .error, error.localizedDescription)
                    promise(.failure(.storageError))
                }
            }
        }
        .receive(on: DispatchQueue.main)
        .eraseToAnyPublisher()
    }
    
    // MARK: - Private Methods
    
    private func setupAccessibilityNotifications() {
        NotificationCenter.default.publisher(for: UIAccessibility.voiceOverStatusDidChangeNotification)
            .sink { [weak self] _ in
                self?.isAccessibilityEnabled = UIAccessibility.isVoiceOverRunning
            }
            .store(in: &cancellables)
    }
    
    private func setupSessionMonitoring() {
        Timer.publish(every: AppConstants.SESSION_CONFIG.SESSION_SYNC_INTERVAL, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.validateSession()
            }
            .store(in: &cancellables)
    }
    
    private func validateSession() {
        guard !authService.validateSession() else { return }
        handleSessionExpiration()
    }
    
    private func handleSessionExpiration() {
        viewState = .error(.sessionExpired)
        user = nil
        
        os_log("Session expired", log: logger, type: .error)
    }
    
    private func validatePasswordComplexity(_ password: String) -> Bool {
        // Minimum 12 characters, at least one uppercase, lowercase, number, and special character
        let passwordRegex = "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{12,}$"
        return NSPredicate(format: "SELF MATCHES %@", passwordRegex).evaluate(with: password)
    }
    
    private func getCachedUserData() async throws -> User? {
        guard let userId = user?.id else { return nil }
        
        let result = await storageService.getData(forKey: "user_profile_\(userId)", decrypt: true)
        switch result {
        case .success(let data):
            return data as? User
        case .failure:
            return nil
        }
    }
    
    private func cacheUserData(_ user: User) async throws {
        try await storageService.saveData(
            user,
            forKey: "user_profile_\(user.id)",
            encrypt: true
        )
    }
}

// MARK: - Supporting Types

/// Represents the current state of the profile view
public enum ProfileViewState {
    case loading
    case loaded
    case error(ProfileError)
}

/// Possible errors that can occur during profile operations
public enum ProfileError: Error {
    case sessionExpired
    case networkError
    case validationError
    case securityError
    case storageError
}