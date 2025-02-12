//
// User.swift
// SmartApparel
//
// Core data model for user management with enhanced security and thread-safety
// Foundation version: Latest
//

import Foundation

// MARK: - Supporting Types

public enum UserRole: String, Codable {
    case admin
    case coach
    case medical
    case athlete
    case system
}

public enum UserStatus: String, Codable {
    case active
    case inactive
    case suspended
    case pending
}

public struct UserPreferences: Codable {
    var theme: String
    var notifications: Bool
    var language: String
    var securityLevel: Int
    
    init() {
        self.theme = "system"
        self.notifications = true
        self.language = "en"
        self.securityLevel = 2
    }
}

// MARK: - User Class

@objc public final class User: NSObject, Codable {
    // MARK: - Properties
    
    public let id: UUID
    private var encryptedEmail: Data
    private var hashedPassword: String
    private var encryptedFirstName: Data
    private var encryptedLastName: Data
    public private(set) var role: UserRole
    public private(set) var status: UserStatus
    private var preferences: UserPreferences
    private var athleteId: UUID?
    
    private let teamLock = NSLock()
    private var teamIds: [UUID]
    private var teamRoles: [UUID: TeamRole]
    
    public private(set) var lastLogin: Date
    public private(set) var createdAt: Date
    public private(set) var updatedAt: Date
    private var auditLog: String
    
    private let encryptionKey: SymmetricKey
    
    // MARK: - Initialization
    
    public init(id: UUID, email: String, hashedPassword: String, firstName: String, lastName: String, role: UserRole) throws {
        self.id = id
        self.role = role
        self.status = .pending
        self.preferences = UserPreferences()
        self.teamIds = []
        self.teamRoles = [:]
        self.lastLogin = Date()
        self.createdAt = Date()
        self.updatedAt = Date()
        self.auditLog = ""
        
        // Initialize encryption key
        self.encryptionKey = SymmetricKey(size: .bits256)
        
        // Encrypt sensitive data
        do {
            let emailData = try JSONEncoder().encode(email)
            let firstNameData = try JSONEncoder().encode(firstName)
            let lastNameData = try JSONEncoder().encode(lastName)
            
            self.encryptedEmail = try AES.GCM.seal(emailData, using: encryptionKey).combined!
            self.encryptedFirstName = try AES.GCM.seal(firstNameData, using: encryptionKey).combined!
            self.encryptedLastName = try AES.GCM.seal(lastNameData, using: encryptionKey).combined!
        } catch {
            throw error
        }
        
        self.hashedPassword = hashedPassword
        super.init()
        
        logAuditEvent("User created")
    }
    
    // MARK: - Public Methods
    
    public func updateProfile(firstName: String, lastName: String, preferences: UserPreferences) throws {
        teamLock.lock()
        defer { teamLock.unlock() }
        
        do {
            let firstNameData = try JSONEncoder().encode(firstName)
            let lastNameData = try JSONEncoder().encode(lastName)
            
            self.encryptedFirstName = try AES.GCM.seal(firstNameData, using: encryptionKey).combined!
            self.encryptedLastName = try AES.GCM.seal(lastNameData, using: encryptionKey).combined!
            self.preferences = preferences
            self.updatedAt = Date()
            
            logAuditEvent("Profile updated")
        } catch {
            throw error
        }
    }
    
    public func addTeamRole(teamId: UUID, role: TeamRole) throws {
        teamLock.lock()
        defer { teamLock.unlock() }
        
        // Validate role assignment based on user role
        switch self.role {
        case .athlete:
            guard role == .athlete else { throw NSError(domain: "Unauthorized role assignment", code: 403) }
        case .medical:
            guard role == .medical else { throw NSError(domain: "Unauthorized role assignment", code: 403) }
        case .coach:
            guard role == .coach || role == .trainer else { throw NSError(domain: "Unauthorized role assignment", code: 403) }
        case .admin, .system:
            break // Can assign any role
        }
        
        if !teamIds.contains(teamId) {
            teamIds.append(teamId)
        }
        teamRoles[teamId] = role
        updatedAt = Date()
        
        logAuditEvent("Team role added: \(role.rawValue) for team: \(teamId.uuidString)")
    }
    
    public func toSecureJSON() -> [String: Any] {
        var json: [String: Any] = [
            "id": id.uuidString,
            "role": role.rawValue,
            "status": status.rawValue,
            "lastLogin": lastLogin.timeIntervalSince1970,
            "createdAt": createdAt.timeIntervalSince1970,
            "updatedAt": updatedAt.timeIntervalSince1970
        ]
        
        // Include non-sensitive preferences
        json["preferences"] = [
            "theme": preferences.theme,
            "language": preferences.language
        ]
        
        // Include team information
        json["teams"] = teamIds.map { $0.uuidString }
        
        return json
    }
    
    // MARK: - Private Methods
    
    private func logAuditEvent(_ event: String) {
        let timestamp = ISO8601DateFormatter().string(from: Date())
        auditLog += "[\(timestamp)] \(event)\n"
    }
    
    // MARK: - Codable Implementation
    
    private enum CodingKeys: String, CodingKey {
        case id, encryptedEmail, hashedPassword, encryptedFirstName, encryptedLastName
        case role, status, preferences, athleteId, teamIds, teamRoles
        case lastLogin, createdAt, updatedAt, auditLog
    }
}