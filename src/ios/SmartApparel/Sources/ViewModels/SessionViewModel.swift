//
// SessionViewModel.swift
// SmartApparel
//
// Thread-safe ViewModel managing training session lifecycle and real-time data processing
// Foundation version: Latest
// Combine version: Latest
//

import Foundation
import Combine

// MARK: - Error Types

/// Comprehensive error types for session management
public enum SessionViewModelError: Error {
    case invalidSession
    case bluetoothUnavailable
    case processingError
    case calibrationError
    case securityError
    case dataIntegrityError
    
    var localizedDescription: String {
        switch self {
        case .invalidSession: return "Invalid or expired session"
        case .bluetoothUnavailable: return "Bluetooth connection unavailable"
        case .processingError: return "Error processing sensor data"
        case .calibrationError: return "Sensor calibration failed"
        case .securityError: return "Security validation failed"
        case .dataIntegrityError: return "Data integrity check failed"
        }
    }
}

// MARK: - SessionViewModel

@MainActor
public final class SessionViewModel: ObservableObject {
    // MARK: - Published Properties
    
    @Published private(set) var currentSession: Session?
    @Published private(set) var sessionStatus: SessionStatus = .pending
    @Published private(set) var isProcessing: Bool = false
    @Published private(set) var error: SessionViewModelError?
    @Published private(set) var processingLatency: TimeInterval = 0
    
    // MARK: - Private Properties
    
    private let bluetoothManager: BluetoothManager
    private let dataProcessor: SensorDataProcessor
    private let processingQueue: DispatchQueue
    private var cancellables = Set<AnyCancellable>()
    private var retryCount: Int = 0
    private var performanceMetrics: [String: Any] = [:]
    
    private let maxRetryAttempts = AppConstants.APP_CONFIG.MAX_RETRY_ATTEMPTS
    private let processingTimeout = AppConstants.UI_CONFIG.LOADING_TIMEOUT
    
    // MARK: - Initialization
    
    public init() {
        self.bluetoothManager = BluetoothManager.shared
        self.dataProcessor = SensorDataProcessor(
            bufferSize: AppConstants.STORAGE_CONFIG.SENSOR_BUFFER_SIZE,
            anomalyThreshold: 2.0
        )
        self.processingQueue = DispatchQueue(
            label: "com.smartapparel.sessionprocessing",
            qos: .userInitiated
        )
        
        setupDataProcessing()
        configureBluetoothManager()
    }
    
    // MARK: - Public Methods
    
    /// Starts a new training session with enhanced validation and monitoring
    public func startSession(athleteId: UUID, type: SessionType) async -> Result<Session, SessionViewModelError> {
        guard !isProcessing else {
            return .failure(.invalidSession)
        }
        
        isProcessing = true
        defer { isProcessing = false }
        
        do {
            // Create new session
            let session = try Session(athleteId: athleteId, type: type)
            
            // Calibrate sensors
            let calibrationResult = await calibrateSensors()
            guard calibrationResult.success else {
                throw SessionViewModelError.calibrationError
            }
            
            // Start data collection
            try await startDataCollection(session: session)
            
            currentSession = session
            sessionStatus = .active
            
            return .success(session)
            
        } catch {
            self.error = error as? SessionViewModelError ?? .processingError
            return .failure(self.error!)
        }
    }
    
    /// Ends the current session with cleanup and data integrity checks
    public func endSession() async -> Result<Void, SessionViewModelError> {
        guard let session = currentSession, sessionStatus == .active else {
            return .failure(.invalidSession)
        }
        
        do {
            // Stop data collection
            bluetoothManager.stopScanning()
            
            // Process final data
            try await processFinalData()
            
            // Update session status
            session.endTime = Date()
            sessionStatus = .completed
            currentSession = nil
            
            // Clear resources
            cancellables.removeAll()
            performanceMetrics.removeAll()
            
            return .success(())
            
        } catch {
            self.error = error as? SessionViewModelError ?? .processingError
            return .failure(self.error!)
        }
    }
    
    // MARK: - Private Methods
    
    private func setupDataProcessing() {
        dataProcessor.delegate = self
        
        // Monitor processing latency
        Timer.publish(every: 1.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.updatePerformanceMetrics()
            }
            .store(in: &cancellables)
    }
    
    private func configureBluetoothManager() {
        bluetoothManager.delegate = self
    }
    
    private func startDataCollection(session: Session) async throws {
        let result = await withCheckedContinuation { continuation in
            bluetoothManager.startScanning()
            
            // Set timeout
            DispatchQueue.main.asyncAfter(deadline: .now() + processingTimeout) {
                continuation.resume(returning: false)
            }
            
            // Monitor connection status
            Timer.publish(every: 0.5, on: .main, in: .common)
                .autoconnect()
                .sink { [weak self] _ in
                    if self?.sessionStatus == .active {
                        continuation.resume(returning: true)
                    }
                }
                .store(in: &cancellables)
        }
        
        guard result else {
            throw SessionViewModelError.bluetoothUnavailable
        }
    }
    
    private func calibrateSensors() async -> CalibrationResult {
        return await withCheckedContinuation { continuation in
            processingQueue.async {
                let result = self.dataProcessor.calibrateSensors()
                continuation.resume(returning: result)
            }
        }
    }
    
    private func processFinalData() async throws {
        guard let session = currentSession else {
            throw SessionViewModelError.invalidSession
        }
        
        return try await withCheckedThrowingContinuation { continuation in
            processingQueue.async {
                // Validate data integrity
                guard session.metrics.update(with: [:]).isSuccess else {
                    continuation.resume(throwing: SessionViewModelError.dataIntegrityError)
                    return
                }
                
                continuation.resume()
            }
        }
    }
    
    private func updatePerformanceMetrics() {
        performanceMetrics["processingLatency"] = processingLatency
        performanceMetrics["dataBufferSize"] = AppConstants.STORAGE_CONFIG.SENSOR_BUFFER_SIZE
        performanceMetrics["retryCount"] = retryCount
    }
}

// MARK: - BluetoothManagerDelegate

extension SessionViewModel: BluetoothManagerDelegate {
    public func didUpdateConnectionState(_ status: SensorStatus, peripheral: CBPeripheral) {
        Task { @MainActor in
            switch status {
            case .active:
                sessionStatus = .active
            case .error:
                error = .bluetoothUnavailable
                if retryCount < maxRetryAttempts {
                    retryCount += 1
                    bluetoothManager.startScanning()
                }
            default:
                break
            }
        }
    }
    
    public func didReceiveSensorData(_ data: SensorData, type: SensorType) {
        Task { @MainActor in
            let startTime = CACurrentMediaTime()
            dataProcessor.processSensorData(data)
            processingLatency = CACurrentMediaTime() - startTime
        }
    }
    
    public func didEncounterError(_ error: Error, peripheral: CBPeripheral?) {
        Task { @MainActor in
            self.error = .processingError
        }
    }
}

// MARK: - SensorDataDelegate

extension SessionViewModel: SensorDataDelegate {
    public func processor(_ processor: SensorDataProcessor, didProcessData data: SensorData) {
        Task { @MainActor in
            guard let session = currentSession else { return }
            
            // Update session metrics
            if case .failure = session.addSensorData(data) {
                error = .processingError
            }
        }
    }
    
    public func processor(_ processor: SensorDataProcessor, didDetectAnomaly anomaly: AnomalyResult) {
        Task { @MainActor in
            // Handle anomaly detection
            if anomaly.confidence > AppConstants.ANALYTICS_CONFIG.SAMPLING_RATE {
                // Trigger alert or notification
            }
        }
    }
    
    public func processor(_ processor: SensorDataProcessor, didCompleteCalibration result: CalibrationResult) {
        Task { @MainActor in
            if !result.success {
                error = .calibrationError
            }
        }
    }
}