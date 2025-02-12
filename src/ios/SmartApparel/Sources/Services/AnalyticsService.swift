//
// AnalyticsService.swift
// SmartApparel
//
// Thread-safe service for real-time biomechanical analytics with HIPAA compliance
// Foundation version: Latest
// Accelerate version: Latest
//

import Foundation
import Accelerate

@objc public final class AnalyticsService: NSObject {
    
    // MARK: - Constants
    
    private let PROCESSING_QUEUE_LABEL = "com.smartapparel.analytics"
    private let BUFFER_SIZE = 1024
    private let PROCESSING_LATENCY_THRESHOLD = 0.100 // 100ms as per specs
    private let ANOMALY_SENSITIVITY = 0.85 // 85% as per specs
    private let HEATMAP_RESOLUTION = 32 // Grid size for heat map
    
    // MARK: - Properties
    
    private let processingQueue: DispatchQueue
    private let metricsLock = NSLock()
    private let baselineLock = NSLock()
    private let bufferLock = NSLock()
    
    private var baselineData: [String: [Double]]
    private var currentSession: Session?
    private var processingBuffer: [SensorData]
    private var lastProcessingTime: TimeInterval
    
    private let logger = Logger.shared
    
    // MARK: - Initialization
    
    public override init() {
        self.processingQueue = DispatchQueue(
            label: PROCESSING_QUEUE_LABEL,
            qos: .userInitiated,
            attributes: .concurrent
        )
        self.baselineData = [:]
        self.processingBuffer = []
        self.lastProcessingTime = 0
        
        super.init()
        
        logger.log(
            "Analytics Service initialized",
            level: .info,
            category: .analytics
        )
    }
    
    // MARK: - Public Methods
    
    /// Starts real-time analysis for a new session
    public func startAnalysis(session: Session) {
        metricsLock.lock()
        defer { metricsLock.unlock() }
        
        currentSession = session
        processingBuffer.removeAll()
        lastProcessingTime = CACurrentMediaTime()
        
        logger.log(
            "Started analysis for session: \(session.id)",
            level: .info,
            category: .analytics,
            metadata: ["sessionType": session.config.type.description]
        )
    }
    
    /// Processes new sensor data with thread safety
    public func processSensorData(_ data: SensorData) -> Result<SessionMetrics, Error> {
        bufferLock.lock()
        defer { bufferLock.unlock() }
        
        // Validate data integrity
        guard case .success = data.isValid() else {
            logger.error(
                "Invalid sensor data received",
                category: .analytics,
                metadata: ["sensorId": data.sensorId]
            )
            return .failure(NSError(domain: "AnalyticsError", code: 1001))
        }
        
        // Add to processing buffer
        processingBuffer.append(data)
        
        // Process in batches for efficiency
        if processingBuffer.count >= BUFFER_SIZE {
            return processBatch()
        }
        
        return .success(SessionMetrics())
    }
    
    /// Generates heat map visualization from sensor data
    public func generateHeatMap(data: [SensorData]) -> Result<[String: Double], Error> {
        metricsLock.lock()
        defer { metricsLock.unlock() }
        
        var heatMap: [String: Double] = [:]
        let startTime = CACurrentMediaTime()
        
        do {
            // Process sensor data for heat map
            for (index, sensorData) in data.enumerated() {
                let gridPosition = calculateGridPosition(sensorData)
                let intensity = try calculateIntensity(sensorData)
                
                heatMap["\(gridPosition.x):\(gridPosition.y)"] = intensity
                
                // Apply spatial smoothing
                if index > 0 {
                    applyGaussianSmoothing(&heatMap)
                }
            }
            
            // Verify processing latency
            let processingTime = CACurrentMediaTime() - startTime
            if processingTime > PROCESSING_LATENCY_THRESHOLD {
                logger.warning(
                    "Heat map generation exceeded latency threshold",
                    category: .performance,
                    metadata: ["processingTime": processingTime]
                )
            }
            
            return .success(heatMap)
            
        } catch {
            logger.error(
                "Heat map generation failed",
                category: .analytics,
                error: error
            )
            return .failure(error)
        }
    }
    
    // MARK: - Private Methods
    
    private func processBatch() -> Result<SessionMetrics, Error> {
        let startTime = CACurrentMediaTime()
        
        do {
            var metrics = SessionMetrics()
            
            // Process IMU data
            let imuData = processingBuffer.filter { $0.type == .imu }
            if !imuData.isEmpty {
                try processIMUData(imuData, metrics: &metrics)
            }
            
            // Process ToF data
            let tofData = processingBuffer.filter { $0.type == .tof }
            if !tofData.isEmpty {
                try processTofData(tofData, metrics: &metrics)
            }
            
            // Check processing latency
            let processingTime = CACurrentMediaTime() - startTime
            if processingTime > PROCESSING_LATENCY_THRESHOLD {
                logger.warning(
                    "Batch processing exceeded latency threshold",
                    category: .performance,
                    metadata: ["processingTime": processingTime]
                )
            }
            
            // Clear buffer after successful processing
            processingBuffer.removeAll()
            
            return .success(metrics)
            
        } catch {
            logger.error(
                "Batch processing failed",
                category: .analytics,
                error: error
            )
            return .failure(error)
        }
    }
    
    private func processIMUData(_ data: [SensorData], metrics: inout SessionMetrics) throws {
        var accelerationData: [Double] = []
        
        // Extract acceleration data
        for sensorData in data {
            accelerationData.append(contentsOf: sensorData.currentReadings)
        }
        
        // Calculate movement metrics using Accelerate framework
        var mean: Double = 0
        var stddev: Double = 0
        
        vDSP_meanvD(accelerationData, 1, &mean, vDSP_Length(accelerationData.count))
        vDSP_normalizeD(accelerationData, 1, nil, 1, &mean, &stddev, vDSP_Length(accelerationData.count))
        
        // Update metrics with thread safety
        metricsLock.lock()
        defer { metricsLock.unlock() }
        
        try metrics.update([
            "acceleration_mean": mean,
            "acceleration_stddev": stddev,
            "movement_intensity": calculateMovementIntensity(accelerationData)
        ])
    }
    
    private func processTofData(_ data: [SensorData], metrics: inout SessionMetrics) throws {
        var muscleActivityData: [Double] = []
        
        // Extract muscle activity data
        for sensorData in data {
            muscleActivityData.append(contentsOf: sensorData.currentReadings)
        }
        
        // Calculate muscle metrics
        let muscleLoad = calculateMuscleLoad(muscleActivityData)
        let asymmetryScore = calculateAsymmetry(muscleActivityData)
        
        // Update metrics with thread safety
        metricsLock.lock()
        defer { metricsLock.unlock() }
        
        try metrics.update([
            "muscle_load": muscleLoad,
            "asymmetry_score": asymmetryScore,
            "tissue_deformation": calculateTissueDeformation(muscleActivityData)
        ])
    }
    
    private func calculateMovementIntensity(_ data: [Double]) -> Double {
        var sum: Double = 0
        vDSP_sumD(data, 1, &sum, vDSP_Length(data.count))
        return sum / Double(data.count)
    }
    
    private func calculateMuscleLoad(_ data: [Double]) -> Double {
        var maxLoad: Double = 0
        vDSP_maxvD(data, 1, &maxLoad, vDSP_Length(data.count))
        return maxLoad
    }
    
    private func calculateAsymmetry(_ data: [Double]) -> Double {
        let midpoint = data.count / 2
        var leftSum: Double = 0
        var rightSum: Double = 0
        
        vDSP_sumD(data, 1, &leftSum, vDSP_Length(midpoint))
        vDSP_sumD(Array(data[midpoint...]), 1, &rightSum, vDSP_Length(data.count - midpoint))
        
        let total = leftSum + rightSum
        return abs((leftSum - rightSum) / total)
    }
    
    private func calculateTissueDeformation(_ data: [Double]) -> Double {
        guard let baseline = baselineData["tissue_baseline"] else { return 0 }
        var deformation: Double = 0
        
        for (index, value) in data.enumerated() where index < baseline.count {
            deformation += abs(value - baseline[index])
        }
        
        return deformation / Double(data.count)
    }
    
    private func calculateGridPosition(_ data: SensorData) -> (x: Int, y: Int) {
        // Calculate grid position based on sensor placement
        let readings = data.currentReadings
        guard !readings.isEmpty else { return (0, 0) }
        
        let xPos = Int((readings[0] / Double(HEATMAP_RESOLUTION)).rounded())
        let yPos = Int((readings[1] / Double(HEATMAP_RESOLUTION)).rounded())
        
        return (
            x: max(0, min(xPos, HEATMAP_RESOLUTION - 1)),
            y: max(0, min(yPos, HEATMAP_RESOLUTION - 1))
        )
    }
    
    private func calculateIntensity(_ data: SensorData) throws -> Double {
        let readings = data.currentReadings
        guard !readings.isEmpty else { throw NSError(domain: "AnalyticsError", code: 1002) }
        
        var intensity: Double = 0
        vDSP_meanvD(readings, 1, &intensity, vDSP_Length(readings.count))
        
        return max(0, min(intensity, 1.0))
    }
    
    private func applyGaussianSmoothing(_ heatMap: inout [String: Double]) {
        let kernel: [Double] = [0.1, 0.2, 0.4, 0.2, 0.1]
        
        for y in 0..<HEATMAP_RESOLUTION {
            for x in 0..<HEATMAP_RESOLUTION {
                var smoothedValue: Double = 0
                
                for k in 0..<kernel.count {
                    let offset = k - kernel.count / 2
                    let neighborX = max(0, min(x + offset, HEATMAP_RESOLUTION - 1))
                    let key = "\(neighborX):\(y)"
                    
                    if let value = heatMap[key] {
                        smoothedValue += value * kernel[k]
                    }
                }
                
                heatMap["\(x):\(y)"] = smoothedValue
            }
        }
    }
}