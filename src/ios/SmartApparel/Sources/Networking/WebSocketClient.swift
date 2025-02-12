import Foundation // latest
import Combine // latest
import Network // latest

/// Represents the current state of the WebSocket connection
@objc public enum WebSocketState: Int {
    case connecting
    case connected
    case disconnected
    case error
    case reconnecting
}

/// Custom errors for WebSocket operations
@objc public enum WebSocketError: Int, Error {
    case connectionFailed
    case invalidData
    case timeout
    case networkQualityLow
    case compressionFailed
    case reconnectionFailed
    case invalidMessageFormat
}

/// Connection quality levels for adaptive behavior
@objc public enum ConnectionQuality: Int {
    case excellent
    case good
    case fair
    case poor
    
    var maxBatchSize: Int {
        switch self {
        case .excellent: return 100
        case .good: return 50
        case .fair: return 25
        case .poor: return 10
        }
    }
}

/// WebSocket client implementation for real-time sensor data communication
@objc public class WebSocketClient: NSObject {
    
    // MARK: - Properties
    
    private var webSocket: URLSessionWebSocketTask?
    private var session: URLSession!
    private var state: WebSocketState = .disconnected {
        didSet {
            NotificationCenter.default.post(name: .webSocketStateChanged, object: self, userInfo: ["state": state])
        }
    }
    private var reconnectAttempts: Int = 0
    private let maxReconnectAttempts: Int = 5
    private var messageQueue: [Data] = []
    private let maxQueueSize: Int = 1000
    private var networkPathMonitor: NWPathMonitor!
    private var connectionQuality: ConnectionQuality = .good
    private let operationQueue: DispatchQueue
    private var backgroundTask: UIBackgroundTaskIdentifier = .invalid
    private var cancellables = Set<AnyCancellable>()
    
    public weak var delegate: SensorDataDelegate?
    
    // MARK: - Initialization
    
    public init(delegate: SensorDataDelegate? = nil) {
        self.operationQueue = DispatchQueue(label: "com.smartapparel.websocket", qos: .userInitiated)
        super.init()
        
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = APIConstants.TIMEOUT_INTERVALS["WEBSOCKET"] ?? 30.0
        configuration.waitsForConnectivity = true
        
        self.session = URLSession(configuration: configuration, delegate: nil, delegateQueue: .main)
        self.delegate = delegate
        
        setupNetworkMonitoring()
        setupBackgroundHandling()
    }
    
    // MARK: - Public Methods
    
    /// Establishes WebSocket connection with automatic reconnection
    public func connect() {
        guard state == .disconnected else { return }
        
        state = .connecting
        
        guard let url = URL(string: APIConstants.WEBSOCKET_URL) else {
            handleError(.connectionFailed)
            return
        }
        
        var request = URLRequest(url: url)
        request.timeoutInterval = APIConstants.TIMEOUT_INTERVALS["WEBSOCKET"] ?? 30.0
        
        webSocket = session.webSocketTask(with: request)
        webSocket?.maximumMessageSize = 1024 * 1024 // 1MB limit
        
        setupMessageHandler()
        webSocket?.resume()
        
        // Start ping timer for connection monitoring
        startPingTimer()
        
        Logger.shared.log("WebSocket connecting to: \(url)", level: .info, category: .network)
    }
    
    /// Gracefully closes the WebSocket connection
    public func disconnect() {
        guard state != .disconnected else { return }
        
        state = .disconnected
        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = nil
        reconnectAttempts = 0
        
        Logger.shared.log("WebSocket disconnected", level: .info, category: .network)
    }
    
    /// Sends sensor data with compression and batching
    public func sendData(_ data: Data) {
        guard state == .connected else {
            queueMessage(data)
            return
        }
        
        do {
            let compressedData = try compressData(data)
            let message = URLSessionWebSocketTask.Message.data(compressedData)
            
            webSocket?.send(message) { [weak self] error in
                if let error = error {
                    self?.handleError(.invalidData, underlyingError: error)
                    self?.queueMessage(data)
                }
            }
        } catch {
            handleError(.compressionFailed, underlyingError: error)
            queueMessage(data)
        }
    }
    
    // MARK: - Private Methods
    
    private func setupNetworkMonitoring() {
        networkPathMonitor = NWPathMonitor()
        networkPathMonitor.pathUpdateHandler = { [weak self] path in
            self?.handleNetworkPathUpdate(path)
        }
        networkPathMonitor.start(queue: operationQueue)
    }
    
    private func setupMessageHandler() {
        receiveMessage()
    }
    
    private func receiveMessage() {
        webSocket?.receive { [weak self] result in
            guard let self = self else { return }
            
            switch result {
            case .success(let message):
                self.handleMessage(message)
                self.receiveMessage() // Continue receiving
                
            case .failure(let error):
                self.handleError(.invalidData, underlyingError: error)
            }
        }
    }
    
    private func handleMessage(_ message: URLSessionWebSocketTask.Message) {
        switch message {
        case .data(let data):
            do {
                let decompressedData = try decompressData(data)
                processSensorData(decompressedData)
            } catch {
                handleError(.compressionFailed, underlyingError: error)
            }
            
        case .string(let string):
            handleControlMessage(string)
            
        @unknown default:
            handleError(.invalidMessageFormat)
        }
    }
    
    private func processSensorData(_ data: Data) {
        do {
            let decoder = JSONDecoder()
            let sensorData = try decoder.decode(SensorData.self, from: data)
            
            DispatchQueue.main.async {
                self.delegate?.didReceiveSensorData(sensorData)
            }
        } catch {
            handleError(.invalidData, underlyingError: error)
        }
    }
    
    private func handleControlMessage(_ message: String) {
        guard let data = message.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            handleError(.invalidMessageFormat)
            return
        }
        
        if let status = json["status"] as? String,
           let sensorId = json["sensorId"] as? String {
            updateSensorStatus(sensorId: sensorId, status: status)
        }
    }
    
    private func updateSensorStatus(sensorId: String, status: String) {
        guard let sensorStatus = SensorStatus(rawValue: status) else { return }
        
        DispatchQueue.main.async {
            self.delegate?.didUpdateSensorStatus(sensorId: sensorId, status: sensorStatus)
        }
    }
    
    private func handleNetworkPathUpdate(_ path: NWPath) {
        let newQuality: ConnectionQuality
        
        switch path.status {
        case .satisfied:
            switch path.currentPath?.unsatisfiedReason {
            case .none:
                newQuality = path.isExpensive ? .good : .excellent
            case .cellularDenied, .wifiDenied:
                newQuality = .fair
            default:
                newQuality = .poor
            }
        case .unsatisfied:
            newQuality = .poor
        case .requiresConnection:
            newQuality = .poor
        @unknown default:
            newQuality = .poor
        }
        
        if newQuality != connectionQuality {
            connectionQuality = newQuality
            adjustForConnectionQuality()
        }
    }
    
    private func adjustForConnectionQuality() {
        switch connectionQuality {
        case .excellent, .good:
            processPendingMessages()
        case .fair:
            // Reduce message frequency
            break
        case .poor:
            if state == .connected {
                handleError(.networkQualityLow)
            }
        }
    }
    
    private func queueMessage(_ data: Data) {
        guard messageQueue.count < maxQueueSize else {
            Logger.shared.error("Message queue full, dropping oldest message", category: .network)
            messageQueue.removeFirst()
        }
        messageQueue.append(data)
    }
    
    private func processPendingMessages() {
        guard !messageQueue.isEmpty else { return }
        
        let batchSize = connectionQuality.maxBatchSize
        let messages = Array(messageQueue.prefix(batchSize))
        messageQueue.removeFirst(min(batchSize, messageQueue.count))
        
        messages.forEach { sendData($0) }
    }
    
    private func startPingTimer() {
        Timer.publish(every: 30, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.sendPing()
            }
            .store(in: &cancellables)
    }
    
    private func sendPing() {
        webSocket?.sendPing { [weak self] error in
            if let error = error {
                self?.handleError(.connectionFailed, underlyingError: error)
            }
        }
    }
    
    private func handleError(_ error: WebSocketError, underlyingError: Error? = nil) {
        state = .error
        
        Logger.shared.error(
            "WebSocket error: \(error)",
            category: .network,
            error: underlyingError
        )
        
        if shouldAttemptReconnection() {
            attemptReconnection()
        }
    }
    
    private func shouldAttemptReconnection() -> Bool {
        return reconnectAttempts < maxReconnectAttempts && state != .disconnected
    }
    
    private func attemptReconnection() {
        state = .reconnecting
        reconnectAttempts += 1
        
        let delay = pow(2.0, Double(reconnectAttempts)) // Exponential backoff
        
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            self?.connect()
        }
    }
    
    private func setupBackgroundHandling() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAppBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAppForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
    }
    
    @objc private func handleAppBackground() {
        backgroundTask = UIApplication.shared.beginBackgroundTask { [weak self] in
            self?.endBackgroundTask()
        }
    }
    
    @objc private func handleAppForeground() {
        endBackgroundTask()
    }
    
    private func endBackgroundTask() {
        if backgroundTask != .invalid {
            UIApplication.shared.endBackgroundTask(backgroundTask)
            backgroundTask = .invalid
        }
    }
    
    private func compressData(_ data: Data) throws -> Data {
        // Implement compression logic here
        // For now, return original data
        return data
    }
    
    private func decompressData(_ data: Data) throws -> Data {
        // Implement decompression logic here
        // For now, return original data
        return data
    }
    
    deinit {
        networkPathMonitor?.cancel()
        disconnect()
    }
}

// MARK: - Notification Names

public extension Notification.Name {
    static let webSocketStateChanged = Notification.Name("WebSocketStateChanged")
}