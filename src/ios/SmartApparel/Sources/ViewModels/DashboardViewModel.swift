//
// DashboardViewModel.swift
// SmartApparel
//
// Thread-safe ViewModel for dashboard management with HIPAA compliance
// Foundation version: Latest
// Combine version: Latest
//

import Foundation
import Combine

/// Comprehensive error types for dashboard operations
public enum DashboardError: Error {
    case sessionError(String)
    case dataProcessingError(String)
    case securityViolation(String)
    case performanceError(String)
    case networkError(String)
    case invalidState(String)
}

/// Thread-safe ViewModel managing dashboard screen state with comprehensive error handling
@MainActor
final class DashboardViewModel: ObservableObject {
    // MARK: - Published Properties
    
    @Published private(set) var currentSession: Session?
    @Published private(set) var metrics: SessionMetrics?
    @Published private(set) var heatMapData: [String: Double] = [:]
    @Published private(set) var isLoading: Bool = false
    @Published private(set) var error: DashboardError?
    
    // MARK: - Private Properties
    
    private let analyticsService: AnalyticsService
    private let secureSessionManager: SecureSessionManager
    private let performanceMonitor: PerformanceMonitor
    private let auditLogger: AuditLogger
    private var cancellables = Set<AnyCancellable>()
    private let queue: DispatchQueue
    
    // Constants
    private let processingLatencyThreshold: TimeInterval = 0.100 // 100ms as per specs
    private let anomalySensitivity: Double = 0.85 // 85% as per specs
    private let maxRetryAttempts = AppConstants.APP_CONFIG.MAX_RETRY_ATTEMPTS
    
    // MARK: - Initialization
    
    init(analyticsService: AnalyticsService,
         sessionManager: SecureSessionManager,
         performanceMonitor: PerformanceMonitor,
         auditLogger: AuditLogger) {
        self.analyticsService = analyticsService
        self.secureSessionManager = sessionManager
        self.performanceMonitor = performanceMonitor
        self.auditLogger = auditLogger
        self.queue = DispatchQueue(label: "com.smartapparel.dashboard",
                                 qos: .userInteractive,
                                 attributes: .concurrent)
        
        setupObservers()
        configurePerformanceMonitoring()
    }
    
    // MARK: - Public Methods
    
    /// Securely starts a new training session with error handling and audit logging
    func startSession(athleteId: UUID) async -> Result<Void, DashboardError> {
        isLoading = true
        
        do {
            // Start performance monitoring
            let perfToken = performanceMonitor.beginOperation("session_start")
            defer { performanceMonitor.endOperation(perfToken) }
            
            // Create and validate session
            let session = try Session(athleteId: athleteId, type: .training)
            
            // Initialize analytics
            analyticsService.startAnalysis(session: session)
            
            // Update state with thread safety
            await MainActor.run {
                self.currentSession = session
                self.metrics = SessionMetrics()
                self.isLoading = false
            }
            
            // Log audit event
            try await auditLogger.log(
                event: "Session started",
                category: .session,
                metadata: ["athleteId": athleteId.uuidString]
            )
            
            return .success(())
            
        } catch {
            let dashboardError = DashboardError.sessionError("Failed to start session: \(error.localizedDescription)")
            await handleError(dashboardError)
            return .failure(dashboardError)
        }
    }
    
    /// Securely ends current session with data persistence and cleanup
    func endSession() async -> Result<Void, DashboardError> {
        guard let session = currentSession else {
            return .failure(.invalidState("No active session"))
        }
        
        do {
            // Start performance monitoring
            let perfToken = performanceMonitor.beginOperation("session_end")
            defer { performanceMonitor.endOperation(perfToken) }
            
            // Persist final metrics
            if let metrics = metrics {
                try await secureSessionManager.persistMetrics(metrics, for: session)
            }
            
            // Clean up resources
            analyticsService.stopAnalysis()
            cancellables.removeAll()
            
            // Update state
            await MainActor.run {
                self.currentSession = nil
                self.metrics = nil
                self.heatMapData = [:]
            }
            
            // Log audit event
            try await auditLogger.log(
                event: "Session ended",
                category: .session,
                metadata: ["sessionId": session.id.uuidString]
            )
            
            return .success(())
            
        } catch {
            let dashboardError = DashboardError.sessionError("Failed to end session: \(error.localizedDescription)")
            await handleError(dashboardError)
            return .failure(dashboardError)
        }
    }
    
    /// Processes sensor updates with performance optimization and error handling
    func processSensorUpdate(_ data: SensorData) async -> Result<Void, DashboardError> {
        guard let session = currentSession else {
            return .failure(.invalidState("No active session"))
        }
        
        do {
            // Validate data integrity
            guard case .success = data.isValid() else {
                throw DashboardError.dataProcessingError("Invalid sensor data")
            }
            
            // Process with performance monitoring
            let perfToken = performanceMonitor.beginOperation("sensor_processing")
            defer { performanceMonitor.endOperation(perfToken) }
            
            // Process sensor data
            let result = await analyticsService.processSensorData(data)
            
            switch result {
            case .success(let updatedMetrics):
                // Update metrics atomically
                await MainActor.run {
                    self.metrics = updatedMetrics
                }
                
                // Generate heat map
                await updateHeatMap([data])
                
            case .failure(let error):
                throw DashboardError.dataProcessingError("Processing failed: \(error.localizedDescription)")
            }
            
            return .success(())
            
        } catch {
            let dashboardError = DashboardError.dataProcessingError("Sensor update failed: \(error.localizedDescription)")
            await handleError(dashboardError)
            return .failure(dashboardError)
        }
    }
    
    /// Updates heat map visualization with memory optimization
    private func updateHeatMap(_ data: [SensorData]) async {
        do {
            // Generate heat map with performance monitoring
            let perfToken = performanceMonitor.beginOperation("heatmap_generation")
            defer { performanceMonitor.endOperation(perfToken) }
            
            let result = await analyticsService.generateHeatMap(data: data)
            
            switch result {
            case .success(let heatMap):
                await MainActor.run {
                    self.heatMapData = heatMap
                }
                
            case .failure(let error):
                throw DashboardError.dataProcessingError("Heat map generation failed: \(error.localizedDescription)")
            }
            
        } catch {
            await handleError(.dataProcessingError("Heat map update failed: \(error.localizedDescription)"))
        }
    }
    
    // MARK: - Private Methods
    
    private func setupObservers() {
        // Observe session state changes
        secureSessionManager.sessionPublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] session in
                self?.currentSession = session
            }
            .store(in: &cancellables)
        
        // Observe performance metrics
        performanceMonitor.metricsPublisher
            .filter { $0.duration > self.processingLatencyThreshold }
            .sink { [weak self] metric in
                self?.handlePerformanceWarning(metric)
            }
            .store(in: &cancellables)
    }
    
    private func configurePerformanceMonitoring() {
        performanceMonitor.configure(
            latencyThreshold: processingLatencyThreshold,
            samplingRate: AppConstants.ANALYTICS_CONFIG.SAMPLING_RATE
        )
    }
    
    private func handleError(_ error: DashboardError) async {
        await MainActor.run {
            self.error = error
            self.isLoading = false
        }
        
        // Log error
        try? await auditLogger.log(
            event: "Dashboard error",
            category: .error,
            metadata: ["error": error.localizedDescription]
        )
    }
    
    private func handlePerformanceWarning(_ metric: PerformanceMetric) {
        Task {
            try? await auditLogger.log(
                event: "Performance warning",
                category: .performance,
                metadata: [
                    "operation": metric.operation,
                    "duration": metric.duration,
                    "threshold": processingLatencyThreshold
                ]
            )
        }
    }
}