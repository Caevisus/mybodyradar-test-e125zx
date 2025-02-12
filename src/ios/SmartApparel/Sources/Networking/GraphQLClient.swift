import Foundation // latest
import Combine // latest

/// A specialized networking client for handling GraphQL operations with comprehensive error handling,
/// real-time data streaming capabilities, and enhanced security features.
@available(iOS 13.0, *)
public class GraphQLClient {
    
    // MARK: - Types
    
    /// Represents possible GraphQL operation errors
    public enum GraphQLError: Error {
        case invalidQuery
        case invalidResponse
        case networkError
        case subscriptionError
        case securityError
        case timeoutError
        case parseError
        case connectionError
    }
    
    /// Types of GraphQL operations
    public enum GraphQLOperation: String {
        case query
        case mutation
        case subscription
    }
    
    /// WebSocket connection states for subscriptions
    public enum GraphQLConnectionState {
        case connected
        case disconnected
        case connecting
        case error
    }
    
    // MARK: - Properties
    
    /// Shared singleton instance
    public static let shared = GraphQLClient()
    
    /// Base API client for network operations
    private let apiClient: APIClient
    
    /// JSON decoder with custom date formatting
    private let decoder: JSONDecoder
    
    /// JSON encoder with custom date formatting
    private let encoder: JSONEncoder
    
    /// Active GraphQL subscriptions
    private var subscriptions: [String: AnyCancellable]
    
    /// Current WebSocket connection state
    private var connectionState: GraphQLConnectionState
    
    /// Retry policy for failed operations
    private let retryPolicy: RetryPolicy
    
    /// Serial queue for thread-safe operations
    private let queue: DispatchQueue
    
    // MARK: - Initialization
    
    private init() {
        // Initialize thread-safe dispatch queue
        self.queue = DispatchQueue(label: "com.smartapparel.graphqlclient", qos: .userInitiated)
        
        // Configure shared API client
        self.apiClient = APIClient.shared
        
        // Configure JSON encoder/decoder
        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
        decoder.dateDecodingStrategy = .formatted(dateFormatter)
        encoder.dateEncodingStrategy = .formatted(dateFormatter)
        
        // Initialize subscriptions and state
        self.subscriptions = [:]
        self.connectionState = .disconnected
        
        // Configure retry policy
        self.retryPolicy = RetryPolicy(
            maxAttempts: Int(APIConstants.RETRY_CONFIG["MAX_ATTEMPTS"] ?? 3),
            baseDelay: APIConstants.RETRY_CONFIG["INITIAL_DELAY"] ?? 1.0,
            maxDelay: APIConstants.RETRY_CONFIG["MAX_DELAY"] ?? 60.0,
            multiplier: APIConstants.RETRY_CONFIG["BACKOFF_MULTIPLIER"] ?? 2.0
        )
        
        // Configure WebSocket for subscriptions
        configureWebSocket()
    }
    
    // MARK: - Public Methods
    
    /// Performs a GraphQL operation with comprehensive error handling and retry logic
    /// - Parameters:
    ///   - query: GraphQL query string
    ///   - type: Operation type (query/mutation/subscription)
    ///   - variables: Optional query variables
    ///   - timeout: Optional custom timeout
    /// - Returns: Publisher with decoded response or error
    @discardableResult
    public func perform<T: Decodable>(
        query: String,
        type: GraphQLOperation,
        variables: [String: Any]? = nil,
        timeout: TimeInterval? = nil
    ) -> AnyPublisher<T, GraphQLError> {
        return queue.sync {
            // Validate query
            guard !query.isEmpty else {
                return Fail(error: .invalidQuery).eraseToAnyPublisher()
            }
            
            // Construct request body
            let body: [String: Any] = [
                "query": query,
                "operationType": type.rawValue,
                "variables": variables ?? [:]
            ]
            
            // Configure request headers
            var headers = APIConstants.HTTP_HEADERS
            headers["X-Operation-Type"] = type.rawValue
            
            // Set custom timeout if provided
            let requestTimeout = timeout ?? APIConstants.TIMEOUT_INTERVALS["REQUEST"] ?? 30.0
            
            Logger.shared.log(
                "Executing GraphQL operation",
                level: .info,
                category: .network,
                metadata: [
                    "type": type.rawValue,
                    "timeout": requestTimeout,
                    "variables": variables ?? [:]
                ]
            )
            
            return apiClient.request(
                endpoint: APIConstants.GRAPHQL_ENDPOINT,
                method: .post,
                body: body,
                headers: headers,
                priority: .realtime,
                customRetryPolicy: retryPolicy,
                requiresAuth: true
            )
            .timeout(seconds: requestTimeout, scheduler: queue)
            .mapError { error -> GraphQLError in
                Logger.shared.error(
                    "GraphQL operation failed",
                    category: .network,
                    error: error,
                    metadata: ["query": query]
                )
                switch error {
                case .networkError: return .networkError
                case .authenticationError: return .securityError
                case .timeoutError: return .timeoutError
                case .decodingError: return .parseError
                default: return .invalidResponse
                }
            }
            .eraseToAnyPublisher()
        }
    }
    
    /// Initiates a GraphQL subscription with connection management
    /// - Parameters:
    ///   - subscription: Subscription query
    ///   - variables: Optional subscription variables
    ///   - retryPolicy: Optional custom retry policy
    /// - Returns: Publisher with subscription updates
    public func subscribe<T: Decodable>(
        subscription: String,
        variables: [String: Any]? = nil,
        retryPolicy: RetryPolicy? = nil
    ) -> AnyPublisher<T, GraphQLError> {
        return queue.sync {
            // Validate subscription
            guard !subscription.isEmpty else {
                return Fail(error: .invalidQuery).eraseToAnyPublisher()
            }
            
            let subscriptionId = UUID().uuidString
            
            Logger.shared.log(
                "Initiating GraphQL subscription",
                level: .info,
                category: .network,
                metadata: [
                    "subscriptionId": subscriptionId,
                    "variables": variables ?? [:]
                ]
            )
            
            // Configure WebSocket connection
            let config = WebSocketConfiguration(
                url: URL(string: APIConstants.WEBSOCKET_URL)!,
                protocols: ["graphql-ws"],
                timeout: APIConstants.TIMEOUT_INTERVALS["WEBSOCKET"] ?? 30.0
            )
            
            // Initialize subscription
            let subscription = apiClient.configureWebSocket(config)
                .flatMap { _ -> AnyPublisher<T, GraphQLError> in
                    let message = [
                        "type": "start",
                        "id": subscriptionId,
                        "payload": [
                            "query": subscription,
                            "variables": variables ?? [:]
                        ]
                    ]
                    
                    return self.sendSubscriptionMessage(message)
                        .decode(type: T.self, decoder: self.decoder)
                        .mapError { _ in GraphQLError.parseError }
                        .eraseToAnyPublisher()
                }
                .handleEvents(
                    receiveSubscription: { [weak self] _ in
                        self?.connectionState = .connected
                    },
                    receiveCompletion: { [weak self] _ in
                        self?.connectionState = .disconnected
                    },
                    receiveCancel: { [weak self] in
                        self?.cancelSubscription(subscriptionId)
                    }
                )
                .retry(using: retryPolicy ?? self.retryPolicy)
                .eraseToAnyPublisher()
            
            // Store subscription
            subscriptions[subscriptionId] = subscription
            
            return subscription
        }
    }
    
    /// Safely cancels an active GraphQL subscription
    /// - Parameter subscriptionId: ID of subscription to cancel
    public func cancelSubscription(_ subscriptionId: String) {
        queue.async { [weak self] in
            guard let self = self else { return }
            
            Logger.shared.log(
                "Cancelling GraphQL subscription",
                level: .info,
                category: .network,
                metadata: ["subscriptionId": subscriptionId]
            )
            
            // Cancel and remove subscription
            self.subscriptions[subscriptionId]?.cancel()
            self.subscriptions.removeValue(forKey: subscriptionId)
            
            // Send stop message
            let message = [
                "type": "stop",
                "id": subscriptionId
            ]
            
            _ = self.sendSubscriptionMessage(message)
                .sink(
                    receiveCompletion: { _ in },
                    receiveValue: { _ in }
                )
        }
    }
    
    // MARK: - Private Methods
    
    private func configureWebSocket() {
        // Configure WebSocket with TLS 1.3
        let config = URLSessionConfiguration.default
        config.tlsMinimumSupportedProtocolVersion = .TLSv13
        
        // Additional WebSocket security configuration
        // Implementation details...
    }
    
    private func sendSubscriptionMessage(_ message: [String: Any]) -> AnyPublisher<Data, GraphQLError> {
        // Implementation for sending subscription messages
        // Implementation details...
        fatalError("Not implemented")
    }
}

// MARK: - Supporting Types

private struct WebSocketConfiguration {
    let url: URL
    let protocols: [String]
    let timeout: TimeInterval
}

private struct RetryPolicy {
    let maxAttempts: Int
    let baseDelay: TimeInterval
    let maxDelay: TimeInterval
    let multiplier: Double
}