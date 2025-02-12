import Foundation // latest
import Combine // latest
import os.log // latest

/// Thread-safe ViewModel managing team-related operations with comprehensive security and error handling
@available(iOS 14.0, *)
@MainActor
public final class TeamViewModel: ObservableObject {
    // MARK: - Published Properties
    
    @Published private(set) var currentTeam: Team?
    @Published private(set) var teamMembers: [UUID: TeamRole] = [:]
    @Published private(set) var teamAnalytics: TeamAnalytics?
    @Published private(set) var viewState: TeamViewState = .loading
    
    // MARK: - Private Properties
    
    private let analyticsService: AnalyticsService
    private let authService: AuthenticationService
    private let operationQueue: OperationQueue
    private let lock = NSLock()
    private var cancellables = Set<AnyCancellable>()
    private let logger = Logger(subsystem: "com.smartapparel.ios", category: "TeamViewModel")
    
    // MARK: - Initialization
    
    public init(analyticsService: AnalyticsService, authService: AuthenticationService) {
        self.analyticsService = analyticsService
        self.authService = authService
        
        // Configure operation queue with quality of service
        self.operationQueue = OperationQueue()
        self.operationQueue.maxConcurrentOperationCount = 1
        self.operationQueue.qualityOfService = .userInitiated
        
        setupSubscriptions()
    }
    
    // MARK: - Public Methods
    
    /// Loads team data with comprehensive security validation and error handling
    public func loadTeam(teamId: UUID) async {
        do {
            // Update view state
            viewState = .loading
            
            // Verify user authorization
            guard let currentUser = try await validateAccess(for: teamId) else {
                viewState = .error(.unauthorized)
                return
            }
            
            // Fetch team data with thread safety
            lock.lock()
            defer { lock.unlock() }
            
            let team = try await fetchTeamData(teamId: teamId)
            self.currentTeam = team
            self.teamMembers = team.memberRoles
            
            // Load team analytics
            await loadTeamAnalytics(team: team)
            
            viewState = .loaded(team)
            
            logger.info("Successfully loaded team data for team: \(teamId.uuidString)")
            
        } catch let error as TeamError {
            viewState = .error(error)
            logger.error("Failed to load team: \(error.localizedDescription)")
        } catch {
            viewState = .error(.networkError)
            logger.error("Unexpected error loading team: \(error.localizedDescription)")
        }
    }
    
    /// Updates team settings with role-based validation and conflict resolution
    public func updateTeamSettings(_ settings: TeamSettings) async throws -> Bool {
        guard let team = currentTeam else {
            throw TeamError.invalidOperation
        }
        
        // Verify user authorization
        guard let currentUser = try await validateAccess(for: team.id) else {
            throw TeamError.unauthorized
        }
        
        // Acquire lock for thread safety
        lock.lock()
        defer { lock.unlock() }
        
        do {
            // Validate security policy
            guard settings.securityPolicy.auditLoggingEnabled else {
                throw TeamError.securityViolation
            }
            
            // Update team settings
            let result = team.updateSettings(settings, auth: AuthContext(userId: currentUser.id, level: .standard))
            
            switch result {
            case .success:
                // Notify observers
                objectWillChange.send()
                
                logger.info("Successfully updated team settings for team: \(team.id.uuidString)")
                return true
                
            case .failure(let error):
                logger.error("Failed to update team settings: \(error.localizedDescription)")
                throw error
            }
            
        } catch {
            logger.error("Error updating team settings: \(error.localizedDescription)")
            throw error
        }
    }
    
    /// Adds a new member to the team with role-based access control
    public func addTeamMember(athleteId: UUID, role: TeamRole) async throws -> Bool {
        guard let team = currentTeam else {
            throw TeamError.invalidOperation
        }
        
        // Verify user authorization
        guard let currentUser = try await validateAccess(for: team.id) else {
            throw TeamError.unauthorized
        }
        
        // Acquire lock for thread safety
        lock.lock()
        defer { lock.unlock() }
        
        do {
            // Add team member
            let result = team.addAthlete(
                athleteId: athleteId,
                role: role,
                auth: AuthContext(userId: currentUser.id, level: .standard)
            )
            
            switch result {
            case .success:
                // Update local state
                teamMembers[athleteId] = role
                objectWillChange.send()
                
                logger.info("Successfully added team member: \(athleteId.uuidString)")
                return true
                
            case .failure(let error):
                logger.error("Failed to add team member: \(error.localizedDescription)")
                throw error
            }
            
        } catch {
            logger.error("Error adding team member: \(error.localizedDescription)")
            throw error
        }
    }
    
    // MARK: - Private Methods
    
    private func setupSubscriptions() {
        // Monitor authentication state changes
        authService.observeAuthState()
            .sink { [weak self] state in
                if case .unauthenticated = state {
                    self?.handleUnauthenticated()
                }
            }
            .store(in: &cancellables)
    }
    
    private func validateAccess(for teamId: UUID) async throws -> User? {
        guard let currentUser = try? await authService.getCurrentUser() else {
            throw TeamError.unauthorized
        }
        
        let validationResult = try await authService.validateAccess(
            resource: "team",
            resourceId: teamId.uuidString,
            requiredRole: .coach
        )
        
        guard validationResult else {
            throw TeamError.unauthorized
        }
        
        return currentUser
    }
    
    private func fetchTeamData(teamId: UUID) async throws -> Team {
        // Implementation would fetch team data from backend
        // This is a placeholder that throws an error
        throw TeamError.networkError
    }
    
    private func loadTeamAnalytics(team: Team) async {
        do {
            let analytics = try await analyticsService.calculatePerformanceMetrics(
                teamId: team.id,
                timeRange: .lastWeek
            )
            
            // Update analytics with thread safety
            lock.lock()
            self.teamAnalytics = analytics
            lock.unlock()
            
            logger.info("Successfully loaded team analytics for team: \(team.id.uuidString)")
            
        } catch {
            logger.error("Failed to load team analytics: \(error.localizedDescription)")
        }
    }
    
    private func handleUnauthenticated() {
        lock.lock()
        defer { lock.unlock() }
        
        currentTeam = nil
        teamMembers.removeAll()
        teamAnalytics = nil
        viewState = .error(.unauthorized)
        
        logger.info("Cleared team data due to authentication state change")
    }
}

// MARK: - Supporting Types

/// Represents possible states of the team view
public enum TeamViewState: Equatable {
    case loading
    case loaded(Team)
    case error(TeamError)
    case offline
}

/// Comprehensive error types for team operations
public enum TeamError: Error {
    case unauthorized
    case invalidOperation
    case networkError
    case dataError
    case concurrencyError
    case offlineError
    case securityViolation
}

/// Represents a team-related operation
public enum TeamOperation {
    case addMember
    case removeMember
    case updateSettings
    case refreshAnalytics
}