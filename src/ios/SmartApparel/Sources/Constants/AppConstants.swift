import Foundation // latest
import UIKit // latest

/// Defines core application constants and configuration parameters for the Smart Apparel iOS application.
/// This struct provides centralized access to system-wide defaults, feature flags, and configuration settings
/// while maintaining security and performance standards.
public struct AppConstants {
    
    // MARK: - Environment Configuration
    
    /// Application environment types
    public enum Environment: String {
        case development
        case staging
        case production
    }
    
    /// Log level configuration
    public enum LogLevel: Int {
        case debug = 0
        case info = 1
        case warning = 2
        case error = 3
    }
    
    // MARK: - App Configuration
    
    /// Core application configuration parameters
    public struct APP_CONFIG {
        public static let MIN_IOS_VERSION: String = "14.0"
        public static let APP_NAME: String = "Smart Apparel"
        public static let BUNDLE_ID: String = "com.smartapparel.ios"
        public static let ENVIRONMENT: Environment = .production
        public static let LOG_LEVEL: LogLevel = .info
        public static let MAX_RETRY_ATTEMPTS: Int = 3
        public static let BACKGROUND_FETCH_INTERVAL: TimeInterval = 900 // 15 minutes
        public static let API_VERSION: String = APIConstants.API_VERSION
    }
    
    // MARK: - UI Configuration
    
    /// User interface configuration parameters
    public struct UI_CONFIG {
        public static let ANIMATION_DURATION: TimeInterval = 0.3
        public static let CORNER_RADIUS: CGFloat = 8.0
        public static let SHADOW_OPACITY: Float = 0.1
        public static let SHADOW_RADIUS: CGFloat = 4.0
        public static let DEFAULT_PADDING: CGFloat = 16.0
        public static let REFRESH_INTERVAL: TimeInterval = 60.0
        public static let LOADING_TIMEOUT: TimeInterval = 30.0
        public static let MINIMUM_TARGET_SIZE: CGFloat = 44.0 // WCAG compliance
        public static let MAXIMUM_CONTENT_WIDTH: CGFloat = 414.0
    }
    
    // MARK: - Storage Configuration
    
    /// Data storage and caching configuration
    public struct STORAGE_CONFIG {
        public static let MAX_CACHE_SIZE_MB: Int = 512
        public static let CACHE_EXPIRY_HOURS: Int = 24
        public static let LOCAL_DATA_RETENTION_DAYS: Int = 30
        public static let MAX_OFFLINE_SESSIONS: Int = 50
        public static let CLEANUP_INTERVAL_HOURS: Int = 6
        public static let COMPRESSION_ENABLED: Bool = true
        public static let COMPRESSION_RATIO: Int = 10
        public static let ENCRYPTION_ENABLED: Bool = true
        public static let ENCRYPTION_ALGORITHM: String = "AES-256-GCM"
        public static let BACKUP_ENABLED: Bool = true
        public static let BACKUP_INTERVAL_HOURS: Int = 24
        public static let SENSOR_BUFFER_SIZE: Int = SensorConstants.DATA_BUFFER_SIZE
    }
    
    // MARK: - Session Configuration
    
    /// Session management and authentication parameters
    public struct SESSION_CONFIG {
        public static let MAX_SESSION_DURATION_HOURS: Int = 8
        public static let AUTO_SAVE_INTERVAL_MINUTES: Int = 5
        public static let INACTIVITY_TIMEOUT_MINUTES: Int = 30
        public static let MAX_CONCURRENT_SESSIONS: Int = 1
        public static let SESSION_SYNC_INTERVAL: TimeInterval = 300 // 5 minutes
        public static let TOKEN_REFRESH_INTERVAL_MINUTES: Int = 15
        public static let MAX_FAILED_AUTH_ATTEMPTS: Int = 5
        public static let LOCKOUT_DURATION_MINUTES: Int = 15
        public static let BIOMETRIC_AUTH_ENABLED: Bool = true
        public static let SECURE_ENCLAVE_ENABLED: Bool = true
        public static let REQUEST_TIMEOUT: TimeInterval = APIConstants.TIMEOUT_INTERVALS["REQUEST"] ?? 30.0
    }
    
    // MARK: - Analytics Configuration
    
    /// Analytics and monitoring configuration
    public struct ANALYTICS_CONFIG {
        public static let BATCH_SIZE: Int = 100
        public static let UPLOAD_INTERVAL: TimeInterval = 300 // 5 minutes
        public static let MAX_EVENTS_PER_SESSION: Int = 10000
        public static let SAMPLING_RATE: Double = 1.0
        public static let RETENTION_DAYS: Int = 90
        public static let ANONYMIZATION_ENABLED: Bool = true
        public static let CRASH_REPORTING_ENABLED: Bool = true
        public static let PERFORMANCE_MONITORING_ENABLED: Bool = true
        public static let USER_TRACKING_ENABLED: Bool = true
        public static let HEALTH_METRICS_ENABLED: Bool = true
        public static let IMU_SAMPLING_RATE: Double = SensorConstants.IMU_SAMPLING_RATE
        public static let TOF_SAMPLING_RATE: Double = SensorConstants.TOF_SAMPLING_RATE
    }
    
    // MARK: - Sensor Configuration
    
    /// Sensor-specific configuration parameters
    public struct SENSOR_CONFIG {
        public static let TOF_GAIN: Double = SensorConstants.DEFAULT_TOF_GAIN
        public static let IMU_DRIFT_CORRECTION: Double = SensorConstants.DEFAULT_IMU_DRIFT_CORRECTION
        public static let PRESSURE_THRESHOLD: Double = SensorConstants.MINIMUM_PRESSURE_THRESHOLD
        public static let TOF_GAIN_RANGE: ClosedRange<Double> = SensorConstants.TOF_GAIN_RANGE
        public static let IMU_DRIFT_CORRECTION_RANGE: ClosedRange<Double> = SensorConstants.IMU_DRIFT_CORRECTION_RANGE
        public static let WEBSOCKET_TIMEOUT: TimeInterval = APIConstants.TIMEOUT_INTERVALS["WEBSOCKET"] ?? 30.0
    }
}