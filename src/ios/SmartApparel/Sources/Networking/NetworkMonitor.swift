import Network // latest
import Foundation // latest
import Combine // latest

/// Represents the current network connection status with quality metrics
public enum NetworkStatus {
    case connected(quality: ConnectionQuality)
    case disconnected(reason: DisconnectionReason)
    case cellular(strength: SignalStrength)
    case wifi(ssid: String?)
}

/// Defines connection quality levels based on latency and bandwidth metrics
public enum ConnectionQuality {
    case excellent // <50ms latency, >10Mbps
    case good     // <100ms latency, >5Mbps
    case fair     // <200ms latency, >2Mbps
    case poor     // >200ms latency or <2Mbps
}

/// Defines possible reasons for network disconnection
public enum DisconnectionReason {
    case userInitiated
    case systemError
    case timeout
    case unknown
}

/// Represents cellular signal strength levels
public enum SignalStrength {
    case excellent // >-50 dBm
    case good     // -50 to -70 dBm
    case fair     // -70 to -90 dBm
    case poor     // <-90 dBm
}

/// A comprehensive network monitoring utility that tracks network connectivity status,
/// reachability, performance metrics, and connection quality for the iOS Smart Apparel application
@available(iOS 13.0, *)
public class NetworkMonitor {
    
    // MARK: - Properties
    
    /// Shared singleton instance
    public static let shared = NetworkMonitor()
    
    /// Core network path monitor
    private let monitor: NWPathMonitor
    
    /// Dedicated dispatch queue for network operations
    private let queue: DispatchQueue
    
    /// Publisher for network status updates
    private let statusSubject = CurrentValueSubject<NetworkStatus, Never>(.disconnected(reason: .unknown))
    
    /// Current network reachability state
    private var isReachable: Bool = false
    
    /// Current network connection type
    private var connectionType: NetworkStatus = .disconnected(reason: .unknown)
    
    /// Moving average of network latency measurements
    private var latencyMetrics = MovingAverageMetric(windowSize: 10)
    
    /// Network bandwidth measurement
    private var bandwidthMetrics = NetworkBandwidthMetric()
    
    /// Connection quality monitoring
    private var connectionQuality = ConnectionQualityMonitor()
    
    /// Performance tracking for network metrics
    private var performanceTracker = NetworkPerformanceTracker()
    
    // MARK: - Initialization
    
    private init() {
        monitor = NWPathMonitor()
        queue = DispatchQueue(label: "com.smartapparel.networkmonitor", qos: .utility)
        
        // Configure initial monitoring setup
        setupNetworkMonitoring()
    }
    
    // MARK: - Public Methods
    
    /// Starts comprehensive network monitoring
    public func startMonitoring() {
        Logger.shared.log(
            "Starting network monitoring",
            level: .info,
            category: .network
        )
        
        monitor.start(queue: queue)
        performanceTracker.start()
        connectionQuality.startMonitoring()
        bandwidthMetrics.startMeasuring()
        
        setupPathUpdateHandler()
    }
    
    /// Stops all network monitoring activities
    public func stopMonitoring() {
        Logger.shared.log(
            "Stopping network monitoring",
            level: .info,
            category: .network
        )
        
        monitor.cancel()
        performanceTracker.stop()
        connectionQuality.stopMonitoring()
        bandwidthMetrics.stopMeasuring()
        
        statusSubject.send(.disconnected(reason: .userInitiated))
    }
    
    /// Performs comprehensive connectivity check
    public func checkConnectivity() -> NetworkStatus {
        let path = monitor.currentPath
        let metrics = performanceTracker.getCurrentMetrics()
        let quality = connectionQuality.assessQuality(
            latency: metrics.latency,
            bandwidth: metrics.bandwidth
        )
        
        return determineNetworkStatus(path: path, quality: quality)
    }
    
    /// Provides publisher for observing network status changes
    public func observeNetworkStatus() -> AnyPublisher<NetworkStatus, Never> {
        return statusSubject.eraseToAnyPublisher()
    }
    
    /// Retrieves current network performance metrics
    public func getPerformanceMetrics() -> NetworkPerformanceMetrics {
        return performanceTracker.getCurrentMetrics()
    }
    
    // MARK: - Private Methods
    
    private func setupNetworkMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            guard let self = self else { return }
            
            self.handlePathUpdate(path)
        }
    }
    
    private func handlePathUpdate(_ path: NWPath) {
        let isReachable = path.status == .satisfied
        let metrics = performanceTracker.getCurrentMetrics()
        let quality = connectionQuality.assessQuality(
            latency: metrics.latency,
            bandwidth: metrics.bandwidth
        )
        
        let status = determineNetworkStatus(path: path, quality: quality)
        
        Logger.shared.log(
            "Network status updated: \(status)",
            level: .info,
            category: .network,
            metadata: [
                "isReachable": isReachable,
                "latency": metrics.latency,
                "bandwidth": metrics.bandwidth
            ]
        )
        
        statusSubject.send(status)
    }
    
    private func determineNetworkStatus(path: NWPath, quality: ConnectionQuality) -> NetworkStatus {
        if !path.status.satisfied {
            return .disconnected(reason: .systemError)
        }
        
        if path.usesInterfaceType(.cellular) {
            let strength = determineSignalStrength()
            return .cellular(strength: strength)
        }
        
        if path.usesInterfaceType(.wifi) {
            let ssid = getCurrentWiFiSSID()
            return .connected(quality: quality)
        }
        
        return .disconnected(reason: .unknown)
    }
    
    private func determineSignalStrength() -> SignalStrength {
        // Implementation would use CoreTelephony framework to get actual signal strength
        // This is a simplified version
        let metrics = performanceTracker.getCurrentMetrics()
        
        switch metrics.latency {
        case ..<50:
            return .excellent
        case 50..<100:
            return .good
        case 100..<200:
            return .fair
        default:
            return .poor
        }
    }
    
    private func getCurrentWiFiSSID() -> String? {
        // Implementation would use NetworkExtension framework to get actual SSID
        // Requires appropriate entitlements
        return nil
    }
}

// MARK: - Supporting Types

private struct MovingAverageMetric {
    let windowSize: Int
    private var values: [Double] = []
    
    mutating func add(_ value: Double) {
        values.append(value)
        if values.count > windowSize {
            values.removeFirst()
        }
    }
    
    var average: Double {
        guard !values.isEmpty else { return 0 }
        return values.reduce(0, +) / Double(values.count)
    }
}

private struct NetworkBandwidthMetric {
    private var startTime: Date?
    private var bytesTransferred: Int64 = 0
    
    mutating func startMeasuring() {
        startTime = Date()
        bytesTransferred = 0
    }
    
    mutating func stopMeasuring() {
        startTime = nil
    }
    
    var currentBandwidth: Double {
        guard let start = startTime else { return 0 }
        let duration = Date().timeIntervalSince(start)
        guard duration > 0 else { return 0 }
        return Double(bytesTransferred) / duration
    }
}

private struct NetworkPerformanceMetrics {
    let latency: TimeInterval
    let bandwidth: Double
    let packetLoss: Double
    let jitter: TimeInterval
}

private class NetworkPerformanceTracker {
    private var isTracking = false
    
    func start() {
        isTracking = true
    }
    
    func stop() {
        isTracking = false
    }
    
    func getCurrentMetrics() -> NetworkPerformanceMetrics {
        // Implementation would measure actual network metrics
        // This is a simplified version
        return NetworkPerformanceMetrics(
            latency: 50,
            bandwidth: 5_000_000,
            packetLoss: 0.01,
            jitter: 5
        )
    }
}

private class ConnectionQualityMonitor {
    private var isMonitoring = false
    
    func startMonitoring() {
        isMonitoring = true
    }
    
    func stopMonitoring() {
        isMonitoring = false
    }
    
    func assessQuality(latency: TimeInterval, bandwidth: Double) -> ConnectionQuality {
        switch (latency, bandwidth) {
        case (..<50, 10_000_000...):
            return .excellent
        case (..<100, 5_000_000...):
            return .good
        case (..<200, 2_000_000...):
            return .fair
        default:
            return .poor
        }
    }
}