//
// Team.swift
// SmartApparel
//
// Core data model for team management with enhanced security and analytics
// Foundation version: Latest
//

import Foundation

// MARK: - Supporting Types

public enum TeamRole: String, Codable {
    case coach
    case trainer
    case medical
    case athlete
}

public struct TeamSettings: Codable {
    var dataRetentionDays: Int
    var alertThresholds: [String: Double]
    var autoSync: Bool
    var securityPolicy: SecurityPolicy
    
    init() {
        self.dataRetentionDays = 180 // 6 months default retention
        self.alertThresholds = [
            "impactForce": 850.0,
            "muscleImbalance": 15.0,
            "rangeOfMotion": 10.0
        ]
        self.autoSync = true
        self.securityPolicy = SecurityPolicy()
    }
}

public struct SecurityPolicy: Codable {
    var allowExternalSharing: Bool
    var requiredAuthLevel: AuthLevel
    var auditLoggingEnabled: Bool
    
    init() {
        self.allowExternalSharing = false
        self.requiredAuthLevel = .standard
        self.auditLoggingEnabled = true
    }
}

public enum AuthLevel: String, Codable {
    case standard
    case elevated
    case medical
}

public struct ConfidenceInterval: Codable {
    let mean: Double
    let lowerBound: Double
    let upperBound: Double
    let confidenceLevel: Double
}

public enum TeamError: Error {
    case unauthorized
    case invalidRole
    case athleteNotFound
    case threadingViolation
    case analyticsValidationFailed
    case securityPolicyViolation
}

// MARK: - Analytics Structure

@objc public final class TeamAnalytics: NSObject, Codable {
    private let lock = NSLock()
    private var averageMetrics: [String: Double]
    private var performanceDistribution: [String: [Double]]
    private var athleteComparisons: [UUID: [String: Double]]
    private var statisticalSignificance: [String: ConfidenceInterval]
    private(set) var lastUpdated: Date
    private(set) var dataPointCount: Int
    
    override init() {
        self.averageMetrics = [:]
        self.performanceDistribution = [:]
        self.athleteComparisons = [:]
        self.statisticalSignificance = [:]
        self.lastUpdated = Date()
        self.dataPointCount = 0
        super.init()
    }
    
    func update(with newData: [String: Double], for athleteId: UUID) {
        lock.lock()
        defer { lock.unlock() }
        
        // Update average metrics
        for (metric, value) in newData {
            if let existing = averageMetrics[metric] {
                averageMetrics[metric] = (existing * Double(dataPointCount) + value) / Double(dataPointCount + 1)
            } else {
                averageMetrics[metric] = value
            }
            
            // Update performance distribution
            if performanceDistribution[metric] == nil {
                performanceDistribution[metric] = []
            }
            performanceDistribution[metric]?.append(value)
        }
        
        // Update athlete comparisons
        athleteComparisons[athleteId] = newData
        
        // Update statistical significance
        updateStatisticalSignificance()
        
        dataPointCount += 1
        lastUpdated = Date()
    }
    
    private func updateStatisticalSignificance() {
        for (metric, values) in performanceDistribution {
            guard values.count >= 2 else { continue }
            
            let mean = values.reduce(0.0, +) / Double(values.count)
            let variance = values.map { pow($0 - mean, 2) }.reduce(0.0, +) / Double(values.count - 1)
            let stdDev = sqrt(variance)
            let confidenceLevel = 0.95
            let zScore = 1.96 // 95% confidence level
            let marginOfError = zScore * (stdDev / sqrt(Double(values.count)))
            
            statisticalSignificance[metric] = ConfidenceInterval(
                mean: mean,
                lowerBound: mean - marginOfError,
                upperBound: mean + marginOfError,
                confidenceLevel: confidenceLevel
            )
        }
    }
}

// MARK: - Team Class

@objc public final class Team: NSObject, Codable {
    private let lock = NSLock()
    
    // MARK: - Properties
    
    public let id: UUID
    public private(set) var name: String
    public private(set) var organization: String
    private var athleteIds: [UUID]
    private var memberRoles: [UUID: TeamRole]
    private var settings: TeamSettings
    private var analytics: TeamAnalytics
    private var securityLog: [String: Any]
    
    public private(set) var createdAt: Date
    public private(set) var updatedAt: Date
    
    // MARK: - Initialization
    
    public init(id: UUID, name: String, organization: String, settings: TeamSettings? = nil) {
        self.id = id
        self.name = name
        self.organization = organization
        self.athleteIds = []
        self.memberRoles = [:]
        self.settings = settings ?? TeamSettings()
        self.analytics = TeamAnalytics()
        self.securityLog = [:]
        self.createdAt = Date()
        self.updatedAt = Date()
        super.init()
    }
    
    // MARK: - Public Methods
    
    public func addAthlete(athleteId: UUID, role: TeamRole, auth: AuthContext) -> Result<Void, TeamError> {
        // Verify authorization
        guard auth.level >= .standard else {
            return .failure(.unauthorized)
        }
        
        lock.lock()
        defer { lock.unlock() }
        
        // Validate role assignment
        if role == .medical && auth.level != .medical {
            return .failure(.unauthorized)
        }
        
        // Add athlete
        athleteIds.append(athleteId)
        memberRoles[athleteId] = role
        
        // Log security event
        if settings.securityPolicy.auditLoggingEnabled {
            let event = [
                "type": "addAthlete",
                "athleteId": athleteId.uuidString,
                "role": role.rawValue,
                "timestamp": Date(),
                "authorizedBy": auth.userId
            ] as [String : Any]
            securityLog[UUID().uuidString] = event
        }
        
        updatedAt = Date()
        return .success(())
    }
    
    public func updateAnalytics(newAnalytics: TeamAnalytics, auth: AuthContext) -> Result<Void, TeamError> {
        // Verify authorization
        guard auth.level >= .standard else {
            return .failure(.unauthorized)
        }
        
        lock.lock()
        defer { lock.unlock() }
        
        // Validate analytics data
        guard newAnalytics.dataPointCount > 0 else {
            return .failure(.analyticsValidationFailed)
        }
        
        self.analytics = newAnalytics
        updatedAt = Date()
        
        // Log analytics update
        if settings.securityPolicy.auditLoggingEnabled {
            let event = [
                "type": "analyticsUpdate",
                "timestamp": Date(),
                "authorizedBy": auth.userId,
                "dataPoints": newAnalytics.dataPointCount
            ] as [String : Any]
            securityLog[UUID().uuidString] = event
        }
        
        return .success(())
    }
}