import Foundation // v13.0+

/// Provides centralized access to all API-related configuration constants throughout the iOS application.
/// This struct contains comprehensive definitions for API endpoints, headers, timeouts, and other
/// networking-related configuration parameters supporting both REST and GraphQL APIs.
public struct APIConstants {
    
    // MARK: - Base Configuration
    
    /// Base URL for all API endpoints
    public static let BASE_URL = "https://api.smartapparel.com"
    
    /// Current API version
    public static let API_VERSION = "v1"
    
    /// WebSocket URL for real-time data streaming
    public static let WEBSOCKET_URL = "wss://api.smartapparel.com/ws"
    
    /// GraphQL endpoint for complex queries
    public static let GRAPHQL_ENDPOINT = "/graphql"
    
    // MARK: - API Endpoints
    
    /// Dictionary containing all API endpoint paths organized by domain
    public static let API_ENDPOINTS: [String: [String: String]] = [
        "AUTH": [
            "LOGIN": "/auth/login",
            "SIGNUP": "/auth/signup",
            "REFRESH": "/auth/refresh",
            "LOGOUT": "/auth/logout",
            "MFA": "/auth/mfa",
            "BIOMETRIC": "/auth/biometric"
        ],
        "SENSOR": [
            "DATA": "/sensor/data",
            "CALIBRATION": "/sensor/calibrate",
            "STATUS": "/sensor/status",
            "STREAM": "/sensor/stream",
            "BATCH": "/sensor/batch",
            "HEALTH": "/sensor/health"
        ],
        "SESSION": [
            "CREATE": "/session/create",
            "UPDATE": "/session/update",
            "END": "/session/end",
            "LIST": "/session/list",
            "EXPORT": "/session/export",
            "SHARE": "/session/share"
        ],
        "ANALYTICS": [
            "PERFORMANCE": "/analytics/performance",
            "HEATMAP": "/analytics/heatmap",
            "METRICS": "/analytics/metrics",
            "EXPORT": "/analytics/export",
            "TRENDS": "/analytics/trends",
            "PREDICTIONS": "/analytics/predictions"
        ],
        "TEAM": [
            "LIST": "/team/list",
            "DETAILS": "/team/details",
            "MEMBERS": "/team/members",
            "STATS": "/team/stats",
            "PERMISSIONS": "/team/permissions",
            "INVITES": "/team/invites"
        ]
    ]
    
    // MARK: - HTTP Headers
    
    /// Standard HTTP headers used in API requests
    public static let HTTP_HEADERS: [String: String] = [
        "CONTENT_TYPE": "application/json",
        "ACCEPT": "application/json",
        "API_KEY": "X-API-Key",
        "AUTH_TOKEN": "Authorization",
        "DEVICE_ID": "X-Device-ID",
        "APP_VERSION": "X-App-Version",
        "CORRELATION_ID": "X-Correlation-ID",
        "REQUEST_ID": "X-Request-ID",
        "SIGNATURE": "X-Signature",
        "TIMESTAMP": "X-Timestamp"
    ]
    
    // MARK: - Timeout Configuration
    
    /// Timeout intervals for different types of network operations (in seconds)
    public static let TIMEOUT_INTERVALS: [String: TimeInterval] = [
        "REQUEST": 30.0,      // Standard API request timeout
        "RESOURCE": 300.0,    // Resource loading timeout
        "WEBSOCKET": 30.0,    // WebSocket connection timeout
        "UPLOAD": 600.0,      // File upload timeout
        "DOWNLOAD": 600.0,    // File download timeout
        "STREAM": 3600.0      // Long-running stream timeout
    ]
    
    // MARK: - Error Codes
    
    /// Standard HTTP error codes used in the application
    public static let ERROR_CODES: [String: Int] = [
        "UNAUTHORIZED": 401,
        "FORBIDDEN": 403,
        "NOT_FOUND": 404,
        "RATE_LIMIT": 429,
        "SERVER_ERROR": 500,
        "SERVICE_UNAVAILABLE": 503,
        "GATEWAY_TIMEOUT": 504
    ]
    
    // MARK: - Retry Configuration
    
    /// Configuration parameters for request retry behavior
    public static let RETRY_CONFIG: [String: Double] = [
        "MAX_ATTEMPTS": 3,            // Maximum number of retry attempts
        "BACKOFF_MULTIPLIER": 2.0,    // Exponential backoff multiplier
        "INITIAL_DELAY": 1.0,         // Initial retry delay in seconds
        "MAX_DELAY": 60.0,           // Maximum retry delay in seconds
        "JITTER": 0.1                // Random jitter factor for retry timing
    ]
}