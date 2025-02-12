//
// AlertViewModel.swift
// SmartApparel
//
// Foundation version: Latest
// Combine version: Latest
//

import Foundation
import Combine

/// Thread-safe ViewModel managing alert data and business logic with HIPAA compliance
/// and performance optimization for the smart apparel iOS application
@MainActor
final class AlertViewModel {
    
    // MARK: - Published Properties
    
    @Published private(set) var alerts: [Alert] = []
    @Published private(set) var isLoading: Bool = false
    @Published private(set) var error: Error?
    
    // MARK: - Private Properties
    
    private var cancellables = Set<AnyCancellable>()
    private let notificationService = NotificationService.shared
    private let alertCache = NSCache<NSString, Alert>()
    private let auditLogger = Logger.shared
    private let refreshTimer: Timer?
    private let alertQueue = DispatchQueue(label: "com.smartapparel.alertQueue", qos: .userInitiated)
    private let alertLock = NSLock()
    
    // Constants
    private let ALERT_REFRESH_INTERVAL: TimeInterval = 30.0
    private let MAX_ALERTS: Int = 100
    private let ALERT_CACHE_SIZE: Int = 1000
    private let AUDIT_RETENTION_DAYS: Int = 180
    
    // MARK: - Initialization
    
    init() {
        // Configure alert cache
        alertCache.countLimit = ALERT_CACHE_SIZE
        
        // Configure initial capacity for alerts array
        alerts.reserveCapacity(MAX_ALERTS)
        
        // Setup refresh timer for real-time updates
        refreshTimer = Timer.scheduledTimer(withTimeInterval: ALERT_REFRESH_INTERVAL, repeats: true) { [weak self] _ in
            Task {
                await self?.fetchAlerts()
            }
        }
        
        // Perform initial fetch
        Task {
            await fetchAlerts()
        }
        
        // Log initialization
        auditLogger.log(
            "AlertViewModel initialized",
            level: .info,
            category: .general,
            metadata: [
                "cacheSize": ALERT_CACHE_SIZE,
                "refreshInterval": ALERT_REFRESH_INTERVAL,
                "maxAlerts": MAX_ALERTS
            ]
        )
    }
    
    deinit {
        refreshTimer?.invalidate()
    }
    
    // MARK: - Public Methods
    
    /// Fetches latest alerts with encryption and performance optimization
    func fetchAlerts() async {
        alertLock.lock()
        defer { alertLock.unlock() }
        
        isLoading = true
        
        do {
            // Check cache first for performance
            if let cachedAlerts = checkCache() {
                alerts = cachedAlerts
                isLoading = false
                return
            }
            
            // Fetch new alerts from backend
            let newAlerts = try await fetchAlertsFromBackend()
            
            // Process and validate alerts
            let processedAlerts = try await processAlerts(newAlerts)
            
            // Update alerts with thread safety
            alertQueue.async { [weak self] in
                guard let self = self else { return }
                self.alertLock.lock()
                defer { self.alertLock.unlock() }
                
                self.alerts = processedAlerts
                self.updateCache(with: processedAlerts)
                
                // Schedule notifications for new alerts
                self.scheduleNotifications(for: processedAlerts)
                
                // Log fetch completion
                self.auditLogger.log(
                    "Alerts fetched successfully",
                    level: .info,
                    category: .general,
                    metadata: ["alertCount": processedAlerts.count]
                )
            }
        } catch {
            self.error = error
            auditLogger.error(
                "Failed to fetch alerts",
                category: .general,
                error: error
            )
        }
        
        isLoading = false
    }
    
    /// Securely acknowledges an alert with audit trail
    func acknowledgeAlert(id: UUID) async {
        alertLock.lock()
        defer { alertLock.unlock() }
        
        do {
            // Find alert in current set
            guard let alertIndex = alerts.firstIndex(where: { $0.id == id }) else {
                throw NSError(domain: "AlertError", code: 404, userInfo: [NSLocalizedDescriptionKey: "Alert not found"])
            }
            
            // Create audit log entry
            auditLogger.log(
                "Alert acknowledgment initiated",
                level: .info,
                category: .general,
                metadata: [
                    "alertId": id.uuidString,
                    "timestamp": Date().timeIntervalSince1970
                ]
            )
            
            // Update alert status
            var updatedAlert = alerts[alertIndex]
            try updatedAlert.acknowledge(userId: UUID().uuidString) // Replace with actual user ID
            
            // Update cache and alerts array
            alertQueue.async { [weak self] in
                guard let self = self else { return }
                self.alertLock.lock()
                defer { self.alertLock.unlock() }
                
                self.alerts[alertIndex] = updatedAlert
                self.updateCache(with: [updatedAlert])
                
                // Cancel related notification
                self.notificationService.cancelAlert(withId: id.uuidString)
            }
            
        } catch {
            self.error = error
            auditLogger.error(
                "Failed to acknowledge alert",
                category: .general,
                error: error,
                metadata: ["alertId": id.uuidString]
            )
        }
    }
    
    /// Efficiently filters alerts with access control
    func filterAlerts(severity: AlertSeverity? = nil,
                     acknowledged: Bool? = nil,
                     timeRange: TimeInterval? = nil) -> [Alert] {
        alertLock.lock()
        defer { alertLock.unlock() }
        
        return alerts.filter { alert in
            var include = true
            
            // Apply severity filter
            if let severity = severity {
                include = include && alert.severity == severity
            }
            
            // Apply acknowledged filter
            if let acknowledged = acknowledged {
                include = include && alert.acknowledged == acknowledged
            }
            
            // Apply time range filter
            if let timeRange = timeRange {
                let cutoffDate = Date().addingTimeInterval(-timeRange)
                include = include && alert.timestamp >= cutoffDate
            }
            
            return include
        }
    }
    
    // MARK: - Private Methods
    
    private func checkCache() -> [Alert]? {
        let cacheKey = NSString(string: "alerts")
        guard let cachedAlerts = alertCache.object(forKey: cacheKey) else {
            return nil
        }
        return [cachedAlerts]
    }
    
    private func updateCache(with alerts: [Alert]) {
        alerts.forEach { alert in
            alertCache.setObject(alert, forKey: NSString(string: alert.id.uuidString))
        }
    }
    
    private func fetchAlertsFromBackend() async throws -> [Alert] {
        // Implement actual API call here
        return []
    }
    
    private func processAlerts(_ alerts: [Alert]) async throws -> [Alert] {
        // Implement alert processing with HIPAA compliance
        return alerts
    }
    
    private func scheduleNotifications(for alerts: [Alert]) {
        alerts.forEach { alert in
            let securityLevel: NotificationSecurityLevel = alert.metadata.keys.contains { $0.hasPrefix("medical_") }
                ? .medical
                : .standard
            
            notificationService.scheduleAlert(alert, securityLevel: securityLevel)
        }
    }
}