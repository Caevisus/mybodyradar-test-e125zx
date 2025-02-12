//
// NotificationService.swift
// SmartApparel
//
// Foundation version: Latest
// UserNotifications version: Latest
// LocalAuthentication version: Latest
//

import Foundation
import UserNotifications
import LocalAuthentication
import "../Models/Alert"
import "../Utils/Logger"
import "../Constants/AppConstants"

/// Defines notification categories for different types of alerts
@objc public enum NotificationCategory: String {
    case alert
    case sensor
    case performance
    case system
    case medical
}

/// Security levels for notifications based on content sensitivity
@objc public enum NotificationSecurityLevel: Int {
    case standard = 1
    case sensitive = 2
    case medical = 3
}

/// Thread-safe service managing secure local and push notifications with HIPAA compliance
@objc public final class NotificationService: NSObject {
    
    // MARK: - Properties
    
    /// Shared singleton instance
    public static let shared = NotificationService()
    
    /// Notification center instance
    private let notificationCenter: UNUserNotificationCenter
    
    /// Authorization status
    private var isAuthorized: Bool = false
    
    /// Queue for processing notifications
    private let notificationQueue: OperationQueue
    
    /// Security provider for biometric authentication
    private let securityProvider: LAContext
    
    /// Cache for notification content
    private let notificationCache: NSCache<NSString, UNNotificationContent>
    
    /// Rate limiting configuration
    private let rateLimiter: [NotificationCategory: TimeInterval]
    
    /// Last notification timestamps for rate limiting
    private var lastNotificationTimes: [NotificationCategory: Date]
    
    // MARK: - Initialization
    
    private override init() {
        // Initialize core components
        self.notificationCenter = UNUserNotificationCenter.current()
        self.notificationQueue = OperationQueue()
        self.securityProvider = LAContext()
        self.notificationCache = NSCache<NSString, UNNotificationContent>()
        
        // Configure rate limiting
        self.rateLimiter = [
            .alert: 1.0,      // 1 second minimum interval
            .sensor: 5.0,     // 5 seconds minimum interval
            .performance: 30.0, // 30 seconds minimum interval
            .system: 60.0,    // 1 minute minimum interval
            .medical: 300.0   // 5 minutes minimum interval
        ]
        self.lastNotificationTimes = [:]
        
        super.init()
        
        // Configure notification queue
        notificationQueue.maxConcurrentOperationCount = 1
        notificationQueue.qualityOfService = .userInitiated
        
        // Configure notification cache
        notificationCache.countLimit = 100
        notificationCache.totalCostLimit = 1024 * 1024 // 1MB
        
        // Setup notification categories with actions
        configureNotificationCategories()
    }
    
    // MARK: - Public Methods
    
    /// Requests notification permissions with enhanced security options
    public func requestAuthorization(completion: @escaping (Result<Bool, Error>) -> Void) {
        // Check biometric capability for sensitive notifications
        var authOptions: UNAuthorizationOptions = [.alert, .sound, .badge]
        if securityProvider.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) {
            authOptions.insert(.provisional)
        }
        
        notificationCenter.requestAuthorization(options: authOptions) { [weak self] granted, error in
            guard let self = self else { return }
            
            if let error = error {
                Logger.shared.error("Failed to request notification authorization",
                                  category: .security,
                                  error: error)
                completion(.failure(error))
                return
            }
            
            self.isAuthorized = granted
            Logger.shared.info("Notification authorization status: \(granted)",
                             category: .security)
            completion(.success(granted))
        }
    }
    
    /// Schedules HIPAA-compliant local notification for an alert
    public func scheduleAlert(_ alert: Alert, securityLevel: NotificationSecurityLevel) {
        notificationQueue.addOperation { [weak self] in
            guard let self = self else { return }
            
            // Validate HIPAA compliance
            guard alert.validateHIPAACompliance() else {
                Logger.shared.error("Alert failed HIPAA compliance check",
                                  category: .security,
                                  metadata: ["alertId": alert.id.uuidString])
                return
            }
            
            // Check rate limiting
            let category = self.determineCategory(for: alert)
            if !self.shouldDeliverNotification(for: category) {
                return
            }
            
            // Create notification content
            let content = self.createNotificationContent(from: alert, securityLevel: securityLevel)
            
            // Configure trigger based on priority
            let trigger = self.createTrigger(for: alert)
            
            // Create notification request
            let request = UNNotificationRequest(identifier: alert.id.uuidString,
                                             content: content,
                                             trigger: trigger)
            
            // Schedule notification
            self.notificationCenter.add(request) { error in
                if let error = error {
                    Logger.shared.error("Failed to schedule notification",
                                      category: .general,
                                      error: error,
                                      metadata: ["alertId": alert.id.uuidString])
                } else {
                    self.updateLastNotificationTime(for: category)
                    Logger.shared.info("Successfully scheduled notification",
                                     category: .general,
                                     metadata: ["alertId": alert.id.uuidString])
                }
            }
        }
    }
    
    // MARK: - Private Methods
    
    private func configureNotificationCategories() {
        let categories: Set<UNNotificationCategory> = [
            UNNotificationCategory(
                identifier: NotificationCategory.alert.rawValue,
                actions: [
                    UNNotificationAction(identifier: "VIEW", title: "View", options: .foreground),
                    UNNotificationAction(identifier: "DISMISS", title: "Dismiss", options: .destructive)
                ],
                intentIdentifiers: [],
                options: .customDismissAction
            ),
            UNNotificationCategory(
                identifier: NotificationCategory.medical.rawValue,
                actions: [
                    UNNotificationAction(identifier: "VIEW_SECURE", title: "View", options: [.foreground, .authenticationRequired]),
                    UNNotificationAction(identifier: "DISMISS", title: "Dismiss", options: .destructive)
                ],
                intentIdentifiers: [],
                options: [.customDismissAction, .hiddenPreviewsShowTitle]
            )
        ]
        
        notificationCenter.setNotificationCategories(categories)
    }
    
    private func createNotificationContent(from alert: Alert, securityLevel: NotificationSecurityLevel) -> UNMutableNotificationContent {
        let content = UNMutableNotificationContent()
        content.title = alert.type
        content.body = alert.message
        content.sound = securityLevel == .medical ? .defaultCritical : .default
        content.categoryIdentifier = determineCategory(for: alert).rawValue
        
        // Add secure metadata
        var userInfo = alert.toJSON()
        userInfo["securityLevel"] = securityLevel.rawValue
        content.userInfo = userInfo
        
        // Configure privacy options for sensitive data
        if securityLevel != .standard {
            content.targetContentIdentifier = alert.id.uuidString
            content.threadIdentifier = "secure_notifications"
        }
        
        return content
    }
    
    private func createTrigger(for alert: Alert) -> UNNotificationTrigger {
        switch alert.severity {
        case .critical:
            return UNTimeIntervalNotificationTrigger(timeInterval: 0.1, repeats: false)
        case .high:
            return UNTimeIntervalNotificationTrigger(timeInterval: 1.0, repeats: false)
        default:
            return UNTimeIntervalNotificationTrigger(timeInterval: 2.0, repeats: false)
        }
    }
    
    private func determineCategory(for alert: Alert) -> NotificationCategory {
        if alert.metadata.keys.contains(where: { $0.hasPrefix("medical_") }) {
            return .medical
        }
        
        switch alert.type {
        case "SensorError", "CalibrationRequired":
            return .sensor
        case "PerformanceWarning", "FatigueAlert":
            return .performance
        case "SystemUpdate", "ConnectionLost":
            return .system
        default:
            return .alert
        }
    }
    
    private func shouldDeliverNotification(for category: NotificationCategory) -> Bool {
        guard let lastTime = lastNotificationTimes[category],
              let minInterval = rateLimiter[category] else {
            return true
        }
        
        return Date().timeIntervalSince(lastTime) >= minInterval
    }
    
    private func updateLastNotificationTime(for category: NotificationCategory) {
        lastNotificationTimes[category] = Date()
    }
}