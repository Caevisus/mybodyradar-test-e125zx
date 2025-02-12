//
// AppDelegate.swift
// SmartApparel
//
// UIKit version: Latest
// UserNotifications version: Latest
// BackgroundTasks version: Latest
//

import UIKit
import UserNotifications
import BackgroundTasks

@main
class AppDelegate: NSObject, UIApplicationDelegate {
    
    // MARK: - Properties
    
    /// Main application window
    var window: UIWindow?
    
    /// Service registry for dependency management
    private let serviceRegistry: ServiceRegistry
    
    /// State manager for application state preservation
    private let stateManager: StateManager
    
    /// Error handler for comprehensive error recovery
    private let errorHandler: ErrorHandler
    
    /// Logger instance for structured logging
    private let logger = Logger.shared
    
    /// Notification service for HIPAA-compliant alerts
    private let notificationService = NotificationService.shared
    
    /// Bluetooth manager for sensor connectivity
    private let bluetoothManager = BluetoothManager.shared
    
    /// Background task identifiers
    private let backgroundTasks = [
        "com.smartapparel.sensor.monitoring",
        "com.smartapparel.data.sync",
        "com.smartapparel.analytics.upload"
    ]
    
    // MARK: - Initialization
    
    override init() {
        // Initialize core services
        self.serviceRegistry = ServiceRegistry()
        self.stateManager = StateManager()
        self.errorHandler = ErrorHandler()
        
        super.init()
        
        // Configure error handler
        configureErrorHandler()
    }
    
    // MARK: - UIApplicationDelegate Methods
    
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        logger.log(
            "Application launching",
            level: .info,
            category: .general,
            metadata: ["launchOptions": launchOptions ?? [:]]
        )
        
        do {
            // Initialize window and root view controller
            window = UIWindow(frame: UIScreen.main.bounds)
            window?.makeKeyAndVisible()
            
            // Configure core services
            try configureServices()
            
            // Configure background tasks
            configureBackgroundTasks()
            
            // Configure notifications with HIPAA compliance
            configureNotifications()
            
            // Initialize sensor monitoring
            initializeSensorMonitoring()
            
            // Restore previous state if available
            restoreApplicationState()
            
            return true
        } catch {
            handleError(error, context: .launch)
            return false
        }
    }
    
    func applicationDidEnterBackground(_ application: UIApplication) {
        logger.log("Application entering background", level: .info, category: .general)
        
        do {
            // Save application state
            try stateManager.saveState()
            
            // Schedule background tasks
            scheduleBackgroundTasks()
            
            // Configure background sensor monitoring
            configureSensorBackgroundMode()
            
        } catch {
            handleError(error, context: .background)
        }
    }
    
    func applicationWillEnterForeground(_ application: UIApplication) {
        logger.log("Application entering foreground", level: .info, category: .general)
        
        do {
            // Restore application state
            try stateManager.restoreState()
            
            // Resume sensor monitoring
            resumeSensorMonitoring()
            
            // Process pending notifications
            processPendingNotifications()
            
        } catch {
            handleError(error, context: .foreground)
        }
    }
    
    // MARK: - Private Methods
    
    private func configureServices() throws {
        // Configure service dependencies
        try serviceRegistry.registerServices()
        
        // Configure logging
        logger.configure(
            minimumLogLevel: AppConstants.APP_CONFIG.LOG_LEVEL,
            config: ["environment": AppConstants.APP_CONFIG.ENVIRONMENT.rawValue]
        )
        
        // Initialize monitoring systems
        initializeMonitoring()
    }
    
    private func configureBackgroundTasks() {
        backgroundTasks.forEach { identifier in
            BGTaskScheduler.shared.register(
                forTaskWithIdentifier: identifier,
                using: nil
            ) { task in
                self.handleBackgroundTask(task)
            }
        }
    }
    
    private func configureNotifications() {
        notificationService.requestAuthorization { result in
            switch result {
            case .success(let granted):
                self.logger.log(
                    "Notification authorization status",
                    level: .info,
                    category: .general,
                    metadata: ["granted": granted]
                )
            case .failure(let error):
                self.handleError(error, context: .notification)
            }
        }
    }
    
    private func initializeSensorMonitoring() {
        bluetoothManager.delegate = self
        bluetoothManager.startScanning()
    }
    
    private func scheduleBackgroundTasks() {
        let request = BGAppRefreshTaskRequest(identifier: backgroundTasks[0])
        request.earliestBeginDate = Date(timeIntervalSinceNow: AppConstants.APP_CONFIG.BACKGROUND_FETCH_INTERVAL)
        
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            handleError(error, context: .backgroundTask)
        }
    }
    
    private func handleBackgroundTask(_ task: BGTask) {
        // Schedule next background task
        scheduleBackgroundTasks()
        
        // Create task completion handler
        let taskCompletion: (Bool) -> Void = { success in
            task.setTaskCompleted(success: success)
        }
        
        // Handle different task types
        switch task.identifier {
        case backgroundTasks[0]:
            handleSensorMonitoringTask(completion: taskCompletion)
        case backgroundTasks[1]:
            handleDataSyncTask(completion: taskCompletion)
        case backgroundTasks[2]:
            handleAnalyticsUploadTask(completion: taskCompletion)
        default:
            taskCompletion(false)
        }
    }
    
    private func handleError(_ error: Error, context: ErrorContext) {
        logger.error(
            "Application error occurred",
            category: .general,
            error: error,
            metadata: ["context": context.rawValue]
        )
        
        errorHandler.handle(error, context: context) { resolution in
            switch resolution {
            case .recovered:
                self.logger.log(
                    "Error recovered",
                    level: .info,
                    category: .general,
                    metadata: ["context": context.rawValue]
                )
            case .failed:
                self.notificationService.scheduleAlert(
                    Alert(
                        type: "SystemError",
                        severity: .high,
                        message: "System encountered an error that requires attention",
                        sourceSystem: "AppDelegate",
                        statusCode: 1001,
                        requiresAudit: true
                    ),
                    securityLevel: .standard
                )
            }
        }
    }
}

// MARK: - BluetoothManagerDelegate

extension AppDelegate: BluetoothManagerDelegate {
    func didUpdateConnectionState(_ status: SensorStatus, peripheral: CBPeripheral) {
        logger.log(
            "Sensor connection status updated",
            level: .info,
            category: .bluetooth,
            metadata: [
                "status": status.rawValue,
                "peripheralId": peripheral.identifier.uuidString
            ]
        )
    }
    
    func didReceiveSensorData(_ data: SensorData, type: SensorType) {
        // Process and validate sensor data
        do {
            if try data.isValid().get() {
                // Handle valid sensor data
                serviceRegistry.sensorDataService?.processSensorData(data, type: type)
            }
        } catch {
            handleError(error, context: .sensorData)
        }
    }
    
    func didEncounterError(_ error: Error, peripheral: CBPeripheral?) {
        handleError(error, context: .bluetooth)
    }
    
    func didUpdateCalibrationProgress(_ progress: Double, params: SensorCalibrationParams) {
        logger.log(
            "Sensor calibration progress",
            level: .info,
            category: .sensor,
            metadata: [
                "progress": progress,
                "params": params
            ]
        )
    }
}

// MARK: - Error Types

private enum ErrorContext: String {
    case launch
    case background
    case foreground
    case notification
    case backgroundTask
    case bluetooth
    case sensorData
}