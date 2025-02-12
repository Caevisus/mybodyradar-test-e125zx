//
// Alert.swift
// SmartApparel
//
// Thread-safe model for system alerts with HIPAA compliance
// Foundation version: Latest
//

import Foundation // v13.0+

/// Defines severity levels for system alerts
@objc public enum AlertSeverity: Int {
    case low = 0
    case medium = 1
    case high = 2
    case critical = 3
    
    var description: String {
        switch self {
        case .low: return "Low"
        case .medium: return "Medium"
        case .high: return "High"
        case .critical: return "Critical"
        }
    }
}

/// Thread-safe model representing a system alert with HIPAA compliance and audit support
@objc public final class Alert: NSObject {
    // MARK: - Properties
    
    public private(set) var id: UUID
    public private(set) var type: String
    public private(set) var severity: AlertSeverity
    public private(set) var message: String
    public private(set) var timestamp: Date
    public private(set) var metadata: Dictionary<String, Any>
    public private(set) var acknowledged: Bool
    public private(set) var acknowledgedAt: Date?
    public private(set) var acknowledgedBy: String?
    public private(set) var sourceSystem: String
    public private(set) var statusCode: Int
    public private(set) var requiresAudit: Bool
    public private(set) var auditTrail: String?
    
    private let alertLock = NSLock()
    private static let alertRefreshInterval: TimeInterval = 30.0
    private static let alertRetentionPeriod: TimeInterval = 157680000.0 // 5 years in seconds
    private static let maxMetadataSize = 524288 // 512KB
    
    // MARK: - Initialization
    
    /// Initializes a new Alert instance with comprehensive metadata and audit support
    public init(type: String, 
                severity: AlertSeverity,
                message: String,
                metadata: Dictionary<String, Any>? = nil,
                sourceSystem: String,
                statusCode: Int,
                requiresAudit: Bool) throws {
        alertLock.lock()
        defer { alertLock.unlock() }
        
        // Validate status code range
        guard (1000...1799).contains(statusCode) else {
            throw NSError(domain: "AlertError", code: 1001, userInfo: [NSLocalizedDescriptionKey: "Invalid status code"])
        }
        
        // Initialize properties
        self.id = UUID()
        self.type = type
        self.severity = severity
        self.message = message
        self.timestamp = Date()
        self.sourceSystem = sourceSystem
        self.statusCode = statusCode
        self.requiresAudit = requiresAudit
        self.acknowledged = false
        
        // Process and validate metadata
        if let meta = metadata {
            let jsonData = try JSONSerialization.data(withJSONObject: meta)
            guard jsonData.count <= Alert.maxMetadataSize else {
                throw NSError(domain: "AlertError", code: 1002, userInfo: [NSLocalizedDescriptionKey: "Metadata size exceeds limit"])
            }
            self.metadata = meta
        } else {
            self.metadata = [:]
        }
        
        // Initialize audit trail if required
        if requiresAudit {
            self.auditTrail = """
            Alert Created:
            Timestamp: \(DataFormatter.formatTimestamp(self.timestamp))
            Type: \(type)
            Severity: \(severity.description)
            Source: \(sourceSystem)
            Status Code: \(statusCode)
            """
        }
        
        super.init()
        
        // Apply HIPAA compliance checks for medical data
        if metadata?.keys.contains(where: { $0.hasPrefix("medical_") }) ?? false {
            self.metadata = DataFormatter.maskSensitiveData(self.metadata)
        }
    }
    
    // MARK: - Public Methods
    
    /// Marks the alert as acknowledged with audit trail update
    public func acknowledge(userId: String, notes: String? = nil) {
        alertLock.lock()
        defer { alertLock.unlock() }
        
        guard !acknowledged else { return }
        
        acknowledged = true
        acknowledgedAt = Date()
        acknowledgedBy = userId
        
        if requiresAudit {
            let acknowledgmentEntry = """
            
            Alert Acknowledged:
            Timestamp: \(DataFormatter.formatTimestamp(acknowledgedAt!))
            User: \(userId)
            \(notes != nil ? "Notes: \(notes!)" : "")
            """
            auditTrail? += acknowledgmentEntry
        }
    }
    
    /// Converts alert to JSON format with sensitive data handling
    public func toJSON() -> Dictionary<String, Any> {
        alertLock.lock()
        defer { alertLock.unlock() }
        
        var json: Dictionary<String, Any> = [
            "id": id.uuidString,
            "type": type,
            "severity": severity.rawValue,
            "message": message,
            "timestamp": DataFormatter.formatTimestamp(timestamp),
            "sourceSystem": sourceSystem,
            "statusCode": statusCode,
            "acknowledged": acknowledged,
            "requiresAudit": requiresAudit
        ]
        
        // Add optional fields if present
        if !metadata.isEmpty {
            json["metadata"] = DataFormatter.maskSensitiveData(metadata)
        }
        
        if let acknowledgedAt = acknowledgedAt {
            json["acknowledgedAt"] = DataFormatter.formatTimestamp(acknowledgedAt)
        }
        
        if let acknowledgedBy = acknowledgedBy {
            json["acknowledgedBy"] = acknowledgedBy
        }
        
        if let auditTrail = auditTrail {
            json["auditTrail"] = auditTrail
        }
        
        return json
    }
}