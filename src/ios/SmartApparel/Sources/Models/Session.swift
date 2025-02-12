//
// Session.swift
// SmartApparel
//
// Thread-safe session management with enhanced security and real-time monitoring
// Foundation version: Latest
//

import Foundation

// MARK: - Enums

@objc public enum SessionStatus: Int {
    case pending = 0
    case active = 1
    case completed = 2
    case cancelled = 3
    
    var description: String {
        switch self {
        case .pending: return "Pending"
        case .active: return "Active"
        case .completed: return "Completed"
        case .cancelled: return "Cancelled"
        }
    }
}

@objc public enum SessionType: Int {
    case training = 0
    case calibration = 1
    case assessment = 2
    
    var description: String {
        switch self {
        case .training: return "Training"
        case .calibration: return "Calibration"
        case .assessment: return "Assessment"
        }
    }
}

// MARK: - Session Metrics

@objc public final class SessionMetrics: NSObject {
    private let metricsLock = NSLock()
    
    public private(set) var muscleActivity: [String: Double]
    public private(set) var forceDistribution: [String: Double]
    public private(set) var rangeOfMotion: [String: (current: Double, baseline: Double, deviation: Double)]
    public private(set) var anomalyScores: [String: (score: Double, threshold: Double)]
    public private(set) var historicalData: [String: [Double]]
    
    override init() {
        self.muscleActivity = [:]
        self.forceDistribution = [:]
        self.rangeOfMotion = [:]
        self.anomalyScores = [:]
        self.historicalData = [:]
        super.init()
    }
    
    func update(with newMetrics: [String: Double]) -> Result<Void, SessionError> {
        metricsLock.lock()
        defer { metricsLock.unlock() }
        
        for (key, value) in newMetrics {
            muscleActivity[key] = value
            
            // Update historical data for trend analysis
            if historicalData[key] == nil {
                historicalData[key] = []
            }
            historicalData[key]?.append(value)
            
            // Calculate anomaly score
            if let baseline = rangeOfMotion[key]?.baseline {
                let deviation = abs(value - baseline)
                let score = deviation / baseline
                anomalyScores[key] = (score: score, threshold: 0.15)
            }
        }
        
        return .success(())
    }
}

// MARK: - Session Configuration

@objc public final class SessionConfig: NSObject {
    public let type: SessionType
    public private(set) var alertThresholds: [String: (min: Double, max: Double, critical: Double)]
    public private(set) var samplingRates: [String: (rate: Double, minimum: Double)]
    public private(set) var dataRetention: TimeInterval
    public private(set) var encryptionKeys: [String: String]
    public private(set) var enableAuditLogging: Bool
    
    public init(type: SessionType) {
        self.type = type
        self.alertThresholds = [:]
        self.samplingRates = [
            "imu": (rate: IMU_SAMPLING_RATE, minimum: 100.0),
            "tof": (rate: TOF_SAMPLING_RATE, minimum: 50.0)
        ]
        self.dataRetention = 157680000 // 5 years in seconds
        self.encryptionKeys = [:]
        self.enableAuditLogging = true
        super.init()
        
        // Initialize alert thresholds based on session type
        switch type {
        case .training:
            alertThresholds = [
                "muscleLoad": (min: 0.1, max: 0.8, critical: 0.9),
                "impactForce": (min: 0.0, max: 500.0, critical: 750.0),
                "rangeDeviation": (min: -0.15, max: 0.15, critical: 0.25)
            ]
        case .calibration:
            alertThresholds = [
                "sensorDrift": (min: -0.05, max: 0.05, critical: 0.1),
                "signalQuality": (min: 0.8, max: 1.0, critical: 0.7)
            ]
        case .assessment:
            alertThresholds = [
                "asymmetry": (min: -0.1, max: 0.1, critical: 0.2),
                "fatigue": (min: 0.0, max: 0.7, critical: 0.85)
            ]
        }
    }
}

// MARK: - Session Errors

public enum SessionError: Error {
    case invalidConfiguration
    case dataValidationFailed
    case threadingViolation
    case securityViolation
    case storageError
}

// MARK: - Session Class

@objc public final class Session: NSObject {
    // MARK: - Properties
    
    public let id: UUID
    public let athleteId: UUID
    public private(set) var startTime: Date
    public private(set) var endTime: Date?
    public private(set) var config: SessionConfig
    public private(set) var metrics: SessionMetrics
    public private(set) var status: SessionStatus
    
    private let dataLock = NSLock()
    private var sensorData: [SensorData]
    private var alerts: [Alert]
    private var auditLog: FileHandle?
    
    // MARK: - Initialization
    
    public init(athleteId: UUID, type: SessionType) throws {
        self.id = UUID()
        self.athleteId = athleteId
        self.startTime = Date()
        self.config = SessionConfig(type: type)
        self.metrics = SessionMetrics()
        self.status = .pending
        self.sensorData = []
        self.alerts = []
        
        super.init()
        
        // Initialize audit logging if enabled
        if config.enableAuditLogging {
            let logPath = FileManager.default.temporaryDirectory
                .appendingPathComponent("session_\(id.uuidString)_audit.log")
            FileManager.default.createFile(atPath: logPath.path, contents: nil)
            auditLog = try FileHandle(forWritingTo: logPath)
            try logAuditEvent("Session initialized for athlete \(athleteId)")
        }
    }
    
    deinit {
        auditLog?.closeFile()
    }
    
    // MARK: - Public Methods
    
    public func addSensorData(_ data: SensorData) -> Result<Void, SessionError> {
        dataLock.lock()
        defer { dataLock.unlock() }
        
        // Validate session is active
        guard status == .active else {
            return .failure(.invalidConfiguration)
        }
        
        // Validate sensor data
        guard case .success = data.isValid() else {
            return .failure(.dataValidationFailed)
        }
        
        // Add sensor data and update metrics
        sensorData.append(data)
        
        // Process sensor data for metrics
        let newMetrics = processSensorData(data)
        if case .failure = metrics.update(with: newMetrics) {
            return .failure(.dataValidationFailed)
        }
        
        // Check for anomalies and generate alerts
        checkAnomalies()
        
        // Log audit event
        try? logAuditEvent("Added sensor data: \(data.sensorId)")
        
        return .success(())
    }
    
    public func updateMetrics(_ newMetrics: SessionMetrics) -> Result<Void, SessionError> {
        dataLock.lock()
        defer { dataLock.unlock() }
        
        guard status == .active else {
            return .failure(.invalidConfiguration)
        }
        
        self.metrics = newMetrics
        
        // Check for anomalies after metrics update
        checkAnomalies()
        
        // Log audit event
        try? logAuditEvent("Updated session metrics")
        
        return .success(())
    }
    
    // MARK: - Private Methods
    
    private func processSensorData(_ data: SensorData) -> [String: Double] {
        // Process sensor data based on type
        var processedMetrics: [String: Double] = [:]
        
        switch data.type {
        case .imu:
            // Process IMU data for movement patterns
            processedMetrics["acceleration"] = data.currentReadings.reduce(0, +) / Double(data.currentReadings.count)
            processedMetrics["stability"] = calculateStability(data.currentReadings)
            
        case .tof:
            // Process ToF data for muscle activity
            processedMetrics["muscleVolume"] = data.currentReadings.max() ?? 0
            processedMetrics["tissueDeformation"] = calculateDeformation(data.currentReadings)
        }
        
        return processedMetrics
    }
    
    private func checkAnomalies() {
        for (metric, (score, threshold)) in metrics.anomalyScores {
            if score > threshold {
                let severity: AlertSeverity = score > config.alertThresholds[metric]?.critical ?? 1.0 
                    ? .critical 
                    : .high
                
                let alert = try? Alert(
                    type: "anomaly_detection",
                    severity: severity,
                    message: "Anomaly detected in \(metric): \(score)",
                    metadata: ["metric": metric, "score": score, "threshold": threshold],
                    sourceSystem: "session_monitoring",
                    statusCode: 1001,
                    requiresAudit: true
                )
                
                if let alert = alert {
                    alerts.append(alert)
                }
            }
        }
    }
    
    private func calculateStability(_ readings: [Double]) -> Double {
        let mean = readings.reduce(0, +) / Double(readings.count)
        let variance = readings.reduce(0) { $0 + pow($1 - mean, 2) }
        return 1.0 - (sqrt(variance / Double(readings.count)) / mean)
    }
    
    private func calculateDeformation(_ readings: [Double]) -> Double {
        guard let baseline = readings.first else { return 0 }
        return readings.reduce(0) { $0 + abs($1 - baseline) } / Double(readings.count)
    }
    
    private func logAuditEvent(_ message: String) throws {
        guard let auditLog = auditLog else { return }
        
        let timestamp = ISO8601DateFormatter().string(from: Date())
        let logEntry = "[\(timestamp)] \(message)\n"
        
        if let data = logEntry.data(using: .utf8) {
            auditLog.write(data)
        }
    }
}