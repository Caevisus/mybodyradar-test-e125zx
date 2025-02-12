//
// Athlete.swift
// SmartApparel
//
// Core data model for athlete information with enhanced security and thread-safety
// Foundation version: Latest
// CryptoKit version: Latest
//

import Foundation
import CryptoKit

// MARK: - Property Wrapper for Field-Level Encryption

@propertyWrapper
struct EncryptedField<T: Codable> {
    private var value: Data
    private let key: SymmetricKey
    
    init(wrappedValue: T) throws {
        self.key = SymmetricKey(size: .bits256)
        let encoder = JSONEncoder()
        let data = try encoder.encode(wrappedValue)
        self.value = try AES.GCM.seal(data, using: key).combined!
    }
    
    var wrappedValue: T {
        get throws {
            let sealedBox = try AES.GCM.SealedBox(combined: value)
            let decryptedData = try AES.GCM.open(sealedBox, using: key)
            return try JSONDecoder().decode(T.self, from: decryptedData)
        }
        set {
            guard let encoded = try? JSONEncoder().encode(newValue),
                  let sealed = try? AES.GCM.seal(encoded, using: key),
                  let combined = sealed.combined else {
                return
            }
            value = combined
        }
    }
}

// MARK: - Supporting Types

public struct AthletePreferences: Codable {
    var notifications: NotificationPreferences
    var dataSharingSettings: DataSharingSettings
    var measurementUnits: String
    var displaySettings: [String: Any]
    var privacySettings: [String: Bool]
    
    enum CodingKeys: String, CodingKey {
        case notifications, dataSharingSettings, measurementUnits
        case displaySettings, privacySettings
    }
}

public struct NotificationPreferences: Codable {
    var email: Bool
    var push: Bool
    var sms: Bool
    var frequency: TimeInterval
}

public struct DataSharingSettings: Codable {
    var medical: Bool
    var coach: Bool
    var team: Bool
    var retentionPeriod: TimeInterval
}

public enum AthleteError: Error {
    case invalidSensorData
    case encryptionFailure
    case threadingViolation
    case invalidBaseline
    case dataValidationFailure
}

// MARK: - BaselineData Class

@objc public final class BaselineData: NSObject, Codable {
    private var muscleProfiles: [String: Double]
    private var rangeOfMotion: [String: (min: Double, max: Double)]
    private var forceDistribution: [String: Double]
    private var calibrationFactors: [String: Double]
    private(set) var lastUpdated: Date
    private let dataLock: NSLock
    
    override init() {
        self.muscleProfiles = [:]
        self.rangeOfMotion = [:]
        self.forceDistribution = [:]
        self.calibrationFactors = [:]
        self.lastUpdated = Date()
        self.dataLock = NSLock()
        super.init()
    }
    
    func update(with newData: BaselineData) throws {
        dataLock.lock()
        defer { dataLock.unlock() }
        
        self.muscleProfiles = newData.muscleProfiles
        self.rangeOfMotion = newData.rangeOfMotion
        self.forceDistribution = newData.forceDistribution
        self.calibrationFactors = newData.calibrationFactors
        self.lastUpdated = Date()
    }
}

// MARK: - Athlete Class

@objc public final class Athlete: NSObject, Codable {
    // MARK: - Properties
    
    public let id: UUID
    @EncryptedField private var name: String
    @EncryptedField private var email: String
    public private(set) var teamId: UUID?
    private var baselineData: BaselineData
    private var preferences: AthletePreferences
    private var sessionIds: [UUID]
    private var currentSensorData: SensorData?
    
    private let sensorDataLock: NSLock
    private let preferencesLock: NSLock
    private let sessionLock: NSLock
    
    public private(set) var createdAt: Date
    public private(set) var updatedAt: Date
    
    // MARK: - Initialization
    
    public init(id: UUID, name: String, email: String) throws {
        self.id = id
        self.baselineData = BaselineData()
        self.sessionIds = []
        self.createdAt = Date()
        self.updatedAt = Date()
        
        // Initialize locks
        self.sensorDataLock = NSLock()
        self.preferencesLock = NSLock()
        self.sessionLock = NSLock()
        
        // Initialize preferences with defaults
        self.preferences = AthletePreferences(
            notifications: NotificationPreferences(
                email: true,
                push: true,
                sms: false,
                frequency: 3600
            ),
            dataSharingSettings: DataSharingSettings(
                medical: true,
                coach: true,
                team: true,
                retentionPeriod: 180 * 24 * 3600 // 180 days
            ),
            measurementUnits: "metric",
            displaySettings: [:],
            privacySettings: [:]
        )
        
        super.init()
        
        // Initialize encrypted fields
        do {
            _name = try EncryptedField(wrappedValue: name)
            _email = try EncryptedField(wrappedValue: email)
        } catch {
            throw AthleteError.encryptionFailure
        }
    }
    
    // MARK: - Public Methods
    
    public func updateBaselineData(_ newData: BaselineData) -> Result<Void, AthleteError> {
        do {
            try baselineData.update(with: newData)
            updatedAt = Date()
            return .success(())
        } catch {
            return .failure(.invalidBaseline)
        }
    }
    
    public func updateSensorData(_ sensorData: SensorData) -> Result<Void, AthleteError> {
        sensorDataLock.lock()
        defer { sensorDataLock.unlock() }
        
        // Validate sensor data
        guard case .success = sensorData.isValid() else {
            return .failure(.invalidSensorData)
        }
        
        currentSensorData = sensorData
        updatedAt = Date()
        return .success(())
    }
    
    public func addSession(_ sessionId: UUID) {
        sessionLock.lock()
        defer { sessionLock.unlock() }
        
        sessionIds.append(sessionId)
        updatedAt = Date()
    }
    
    public func updatePreferences(_ newPreferences: AthletePreferences) -> Result<Void, AthleteError> {
        preferencesLock.lock()
        defer { preferencesLock.unlock() }
        
        preferences = newPreferences
        updatedAt = Date()
        return .success(())
    }
    
    // MARK: - Codable Implementation
    
    private enum CodingKeys: String, CodingKey {
        case id, name, email, teamId, baselineData, preferences
        case sessionIds, createdAt, updatedAt
    }
}