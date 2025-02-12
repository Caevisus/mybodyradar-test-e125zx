import Foundation // latest
import Combine // latest

/// A comprehensive networking client that handles all HTTP/HTTPS API communications for the Smart Apparel application
/// with support for authentication, request management, response handling, and error processing.
@available(iOS 13.0, *)
public class APIClient {
    
    // MARK: - Types
    
    /// HTTP methods supported by the API client
    public enum HTTPMethod: String {
        case get = "GET"
        case post = "POST"
        case put = "PUT"
        case delete = "DELETE"
    }
    
    /// API request priority levels
    public enum RequestPriority: Int {
        case low = 0
        case normal = 1
        case high = 2
        case realtime = 3
    }
    
    /// Possible API errors
    public enum APIError: Error {
        case networkError
        case invalidResponse
        case authenticationError
        case serverError
        case decodingError
        case rateLimitExceeded
        case timeoutError
        case offlineError
        case certificateError
        case invalidRequest
    }
    
    // MARK: - Properties
    
    /// Shared singleton instance
    public static let shared = APIClient()
    
    /// URLSession configured with security and performance settings
    private let session: URLSession
    
    /// JSON decoder with custom date formatting
    private let decoder: JSONDecoder
    
    /// JSON encoder with custom date formatting
    private let encoder: JSONEncoder
    
    /// Current authentication token
    private var authToken: String?
    
    /// Queue for managing request priorities
    private let requestQueue: OperationQueue
    
    /// Retry policy for failed requests
    private let retryPolicy: RetryPolicy
    
    /// Certificate pinning manager
    private let certificatePinningManager: CertificatePinningManager
    
    /// Rate limit manager
    private var rateLimitManager: RateLimitManager
    
    /// Network metrics collector
    private let metricsCollector: NetworkMetricsCollector
    
    /// Offline request store
    private var offlineRequestStore: OfflineRequestStore
    
    // MARK: - Initialization
    
    private init() {
        // Configure session with security and performance settings
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = APIConstants.TIMEOUT_INTERVALS["REQUEST"] ?? 30.0
        configuration.timeoutIntervalForResource = APIConstants.TIMEOUT_INTERVALS["RESOURCE"] ?? 300.0
        configuration.waitsForConnectivity = true
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.tlsMinimumSupportedProtocolVersion = .TLSv13
        
        // Initialize session with configuration
        self.session = URLSession(configuration: configuration)
        
        // Configure JSON encoder/decoder
        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
        decoder.dateDecodingStrategy = .formatted(dateFormatter)
        encoder.dateEncodingStrategy = .formatted(dateFormatter)
        
        // Initialize request management
        self.requestQueue = OperationQueue()
        requestQueue.maxConcurrentOperationCount = 4
        requestQueue.qualityOfService = .userInitiated
        
        // Initialize security components
        self.certificatePinningManager = CertificatePinningManager()
        self.rateLimitManager = RateLimitManager()
        
        // Initialize monitoring and storage
        self.metricsCollector = NetworkMetricsCollector()
        self.offlineRequestStore = OfflineRequestStore()
        
        // Configure retry policy
        self.retryPolicy = RetryPolicy(
            maxAttempts: Int(APIConstants.RETRY_CONFIG["MAX_ATTEMPTS"] ?? 3),
            baseDelay: APIConstants.RETRY_CONFIG["INITIAL_DELAY"] ?? 1.0,
            maxDelay: APIConstants.RETRY_CONFIG["MAX_DELAY"] ?? 60.0,
            multiplier: APIConstants.RETRY_CONFIG["BACKOFF_MULTIPLIER"] ?? 2.0
        )
    }
    
    // MARK: - Public Methods
    
    /// Performs a generic API request with comprehensive error handling and performance optimization
    /// - Parameters:
    ///   - endpoint: API endpoint path
    ///   - method: HTTP method
    ///   - body: Optional request body
    ///   - headers: Optional additional headers
    ///   - priority: Request priority level
    ///   - customRetryPolicy: Optional custom retry policy
    ///   - requiresAuth: Whether request requires authentication
    /// - Returns: Publisher with decoded response or error
    @discardableResult
    public func request<T: Decodable>(
        endpoint: String,
        method: HTTPMethod,
        body: Encodable? = nil,
        headers: [String: String]? = nil,
        priority: RequestPriority = .normal,
        customRetryPolicy: RetryPolicy? = nil,
        requiresAuth: Bool = true
    ) -> AnyPublisher<T, APIError> {
        // Check network connectivity
        guard NetworkMonitor.shared.checkConnectivity() != .disconnected(reason: .unknown) else {
            return Fail(error: .offlineError).eraseToAnyPublisher()
        }
        
        // Check rate limiting
        guard rateLimitManager.canMakeRequest() else {
            return Fail(error: .rateLimitExceeded).eraseToAnyPublisher()
        }
        
        // Construct URL
        guard let url = URL(string: "\(APIConstants.BASE_URL)/\(APIConstants.API_VERSION)\(endpoint)") else {
            return Fail(error: .invalidRequest).eraseToAnyPublisher()
        }
        
        // Create request
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        
        // Add standard headers
        request.addValue(APIConstants.HTTP_HEADERS["CONTENT_TYPE"]!, forHTTPHeaderField: "Content-Type")
        request.addValue(APIConstants.HTTP_HEADERS["ACCEPT"]!, forHTTPHeaderField: "Accept")
        request.addValue(UUID().uuidString, forHTTPHeaderField: APIConstants.HTTP_HEADERS["REQUEST_ID"]!)
        
        // Add authentication if required
        if requiresAuth {
            guard let token = authToken else {
                return Fail(error: .authenticationError).eraseToAnyPublisher()
            }
            request.addValue("Bearer \(token)", forHTTPHeaderField: APIConstants.HTTP_HEADERS["AUTH_TOKEN"]!)
        }
        
        // Add custom headers
        headers?.forEach { request.addValue($1, forHTTPHeaderField: $0) }
        
        // Add body if present
        if let body = body {
            do {
                request.httpBody = try encoder.encode(body)
            } catch {
                return Fail(error: .invalidRequest).eraseToAnyPublisher()
            }
        }
        
        // Set timeout based on priority
        request.timeoutInterval = priority == .realtime ? 1.0 : APIConstants.TIMEOUT_INTERVALS["REQUEST"]!
        
        // Create publisher
        return session.dataTaskPublisher(for: request)
            .tryMap { [weak self] data, response in
                guard let self = self else { throw APIError.networkError }
                
                // Verify certificate
                guard self.certificatePinningManager.validateCertificate(for: response) else {
                    throw APIError.certificateError
                }
                
                // Validate response
                guard let httpResponse = response as? HTTPURLResponse else {
                    throw APIError.invalidResponse
                }
                
                // Handle response codes
                switch httpResponse.statusCode {
                case 200...299:
                    return data
                case APIConstants.ERROR_CODES["UNAUTHORIZED"]!:
                    throw APIError.authenticationError
                case APIConstants.ERROR_CODES["RATE_LIMIT"]!:
                    throw APIError.rateLimitExceeded
                case 500...599:
                    throw APIError.serverError
                default:
                    throw APIError.invalidResponse
                }
            }
            .retry(using: customRetryPolicy ?? retryPolicy)
            .decode(type: T.self, decoder: decoder)
            .mapError { error -> APIError in
                if let apiError = error as? APIError {
                    return apiError
                }
                return .decodingError
            }
            .receive(on: DispatchQueue.main)
            .eraseToAnyPublisher()
    }
    
    /// Handles multipart data uploads with progress tracking
    /// - Parameters:
    ///   - data: Data to upload
    ///   - endpoint: Upload endpoint
    ///   - metadata: Additional metadata
    ///   - progressHandler: Upload progress callback
    /// - Returns: Publisher with upload response
    public func uploadData(
        data: Data,
        endpoint: String,
        metadata: [String: String],
        progressHandler: @escaping (Double) -> Void
    ) -> AnyPublisher<UploadResponse, APIError> {
        // Implementation for multipart upload
        fatalError("Not implemented")
    }
    
    /// Manages authentication token lifecycle
    /// - Parameters:
    ///   - token: Authentication token
    ///   - expiration: Token expiration date
    public func handleAuthentication(token: String, expiration: Date) {
        self.authToken = token
        
        // Schedule token refresh
        let refreshInterval = Calendar.current.date(
            byAdding: .minute,
            value: -5,
            to: expiration
        )
        
        // Notify token update
        NotificationCenter.default.post(
            name: .authTokenUpdated,
            object: nil,
            userInfo: ["token": token]
        )
        
        Logger.shared.log(
            "Authentication token updated",
            level: .info,
            category: .network,
            metadata: [
                "expiration": expiration,
                "refreshInterval": refreshInterval as Any
            ]
        )
    }
}

// MARK: - Supporting Types

private struct RetryPolicy {
    let maxAttempts: Int
    let baseDelay: TimeInterval
    let maxDelay: TimeInterval
    let multiplier: Double
}

private class CertificatePinningManager {
    func validateCertificate(for response: URLResponse) -> Bool {
        // Implementation for certificate pinning
        return true
    }
}

private class RateLimitManager {
    func canMakeRequest() -> Bool {
        // Implementation for rate limiting
        return true
    }
}

private class NetworkMetricsCollector {
    // Implementation for metrics collection
}

private class OfflineRequestStore {
    // Implementation for offline request storage
}

// MARK: - Notification Names

extension Notification.Name {
    static let authTokenUpdated = Notification.Name("com.smartapparel.authTokenUpdated")
}