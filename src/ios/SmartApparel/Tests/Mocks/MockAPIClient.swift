import Foundation // latest
import Combine // latest
import XCTest // latest

/// Mock response types for simulating different API scenarios
public enum MockResponseType {
    case success
    case networkError(Error)
    case invalidResponse(statusCode: Int)
    case authError(String)
    case serverError(Int)
    case timeoutError
    case customError(Error)
}

/// Default mock response delay to simulate network latency
private let MockDelay = TimeInterval(0.1)

/// Thread-safe mock implementation of APIClient for comprehensive testing scenarios
@available(iOS 13.0, *)
@testable
public class MockAPIClient {
    
    // MARK: - Properties
    
    /// Shared singleton instance
    public static let shared = MockAPIClient()
    
    /// Current mock response configuration
    private var responseType: MockResponseType = .success
    
    /// Mock data to return in responses
    private var mockData: Data?
    
    /// Mock authentication token
    private var authToken: String?
    
    /// JSON decoder for response parsing
    private let decoder: JSONDecoder
    
    /// Configurable response delay
    private var responseDelay: TimeInterval
    
    /// Request counter for verification
    private var requestCount: Int = 0
    
    /// Thread-safe queue for mock operations
    private let mockQueue = DispatchQueue(label: "com.smartapparel.mockapi", qos: .userInitiated)
    
    // MARK: - Initialization
    
    private init() {
        // Configure JSON decoder with date formatting
        self.decoder = JSONDecoder()
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
        decoder.dateDecodingStrategy = .formatted(dateFormatter)
        
        // Set default response delay
        self.responseDelay = MockDelay
        
        // Configure default empty mock data
        self.mockData = "{}".data(using: .utf8)
    }
    
    // MARK: - Public Methods
    
    /// Simulates API request with configurable responses
    @discardableResult
    public func request<T: Decodable>(
        endpoint: String,
        method: APIClient.HTTPMethod,
        body: Encodable? = nil,
        headers: [String: String]? = nil
    ) -> AnyPublisher<T, APIClient.APIError> {
        // Thread-safe request count increment
        mockQueue.sync {
            requestCount += 1
        }
        
        // Create publisher for mock response
        return Future<T, APIClient.APIError> { [weak self] promise in
            guard let self = self else {
                promise(.failure(.networkError))
                return
            }
            
            // Simulate network delay
            DispatchQueue.global().asyncAfter(deadline: .now() + self.responseDelay) {
                self.mockQueue.sync {
                    switch self.responseType {
                    case .success:
                        guard let mockData = self.mockData else {
                            promise(.failure(.invalidResponse))
                            return
                        }
                        
                        do {
                            let decoded = try self.decoder.decode(T.self, from: mockData)
                            promise(.success(decoded))
                        } catch {
                            promise(.failure(.decodingError))
                        }
                        
                    case .networkError(let error):
                        Logger.shared.error(
                            "Mock network error",
                            category: .network,
                            error: error
                        )
                        promise(.failure(.networkError))
                        
                    case .invalidResponse(let statusCode):
                        Logger.shared.log(
                            "Mock invalid response",
                            level: .error,
                            category: .network,
                            metadata: ["statusCode": statusCode]
                        )
                        promise(.failure(.invalidResponse))
                        
                    case .authError(let message):
                        Logger.shared.log(
                            "Mock auth error: \(message)",
                            level: .error,
                            category: .network
                        )
                        promise(.failure(.authenticationError))
                        
                    case .serverError(let code):
                        Logger.shared.log(
                            "Mock server error",
                            level: .error,
                            category: .network,
                            metadata: ["code": code]
                        )
                        promise(.failure(.serverError))
                        
                    case .timeoutError:
                        Logger.shared.log(
                            "Mock timeout error",
                            level: .error,
                            category: .network
                        )
                        promise(.failure(.timeoutError))
                        
                    case .customError(let error):
                        Logger.shared.error(
                            "Mock custom error",
                            category: .network,
                            error: error
                        )
                        promise(.failure(.networkError))
                    }
                }
            }
        }
        .receive(on: DispatchQueue.main)
        .eraseToAnyPublisher()
    }
    
    /// Configures mock response behavior
    public func setMockResponse(type: MockResponseType, mockData: Data? = nil) {
        mockQueue.sync {
            self.responseType = type
            if let mockData = mockData {
                self.mockData = mockData
            }
        }
    }
    
    /// Configures custom response delay
    public func setResponseDelay(_ delay: TimeInterval) {
        mockQueue.sync {
            self.responseDelay = delay
        }
    }
    
    /// Sets mock authentication token
    public func setAuthToken(_ token: String) {
        mockQueue.sync {
            self.authToken = token
        }
    }
    
    /// Clears mock authentication token
    public func clearAuthToken() {
        mockQueue.sync {
            self.authToken = nil
        }
    }
    
    /// Resets mock client to default state
    public func reset() {
        mockQueue.sync {
            responseType = .success
            mockData = "{}".data(using: .utf8)
            authToken = nil
            requestCount = 0
            responseDelay = MockDelay
        }
    }
    
    /// Returns number of requests made
    public func getRequestCount() -> Int {
        return mockQueue.sync { requestCount }
    }
}