//
// BiometricsService.swift
// SmartApparel
//
// Thread-safe service for processing and analyzing biomechanical data
// Foundation version: Latest
// Accelerate version: Latest
//

import Foundation
import Accelerate

@objc public final class BiometricsService: NSObject {
    
    // MARK: - Private Properties
    
    private let sensorProcessor: SensorDataProcessor
    private let analyticsService: AnalyticsService
    private let processingQueue: DispatchQueue
    private let dataLock: NSLock
    private var muscleActivityMap: [String: Double]
    private var movementPatterns: [String: [Double]]
    private var performanceMetrics: [String: Double]
    private let securityValidator: SecurityValidator
    
    // MARK: - Constants
    
    private let PROCESSING_LATENCY_THRESHOLD = 0.100 // 100ms as per specs
    private let MUSCLE_ACTIVITY_THRESHOLD = 0.85 // 85% sensitivity
    private let MOVEMENT_PATTERN_WINDOW = 200 // Based on IMU sampling rate
    private let HEATMAP_RESOLUTION = 32
    
    // MARK: - Initialization
    
    public init(sensorProcessor: SensorDataProcessor, 
               analyticsService: AnalyticsService,
               securityValidator: SecurityValidator) {
        self.sensorProcessor = sensorProcessor
        self.analyticsService = analyticsService
        self.securityValidator = securityValidator
        
        self.processingQueue = DispatchQueue(
            label: "com.smartapparel.biometrics",
            qos: .userInitiated,
            attributes: .concurrent
        )
        
        self.dataLock = NSLock()
        self.muscleActivityMap = [:]
        self.movementPatterns = [:]
        self.performanceMetrics = [:]
        
        super.init()
    }
    
    // MARK: - Public Methods
    
    /// Processes biometric data with thread safety and performance optimization
    public func processBiometricData(_ data: SensorData) -> Result<[String: Double], Error> {
        // Validate data security compliance
        guard securityValidator.validateDataSecurity(data) else {
            return .failure(NSError(domain: "BiometricsError", code: 1001))
        }
        
        let startTime = CACurrentMediaTime()
        
        return processingQueue.sync { [weak self] in
            guard let self = self else {
                return .failure(NSError(domain: "BiometricsError", code: 1002))
            }
            
            self.dataLock.lock()
            defer { self.dataLock.unlock() }
            
            do {
                // Process raw sensor data using Accelerate framework
                let processedData = try self.sensorProcessor.processSensorData(data)
                
                // Calculate muscle activity in parallel
                var muscleMetrics = try self.analyzeMuscleActivity(data)
                
                // Analyze movement patterns
                let patterns = try self.detectMovementPatterns([data])
                
                // Generate comprehensive biomechanical metrics
                let biomechanicalMetrics = try self.calculateBiomechanicalMetrics(data)
                
                // Combine all metrics
                muscleMetrics.merge(patterns) { current, _ in current }
                muscleMetrics.merge(biomechanicalMetrics) { current, _ in current }
                
                // Verify processing latency
                let processingTime = CACurrentMediaTime() - startTime
                if processingTime > PROCESSING_LATENCY_THRESHOLD {
                    Logger.shared.warning(
                        "Processing latency threshold exceeded",
                        category: .performance,
                        metadata: ["processingTime": processingTime]
                    )
                }
                
                return .success(muscleMetrics)
                
            } catch {
                return .failure(error)
            }
        }
    }
    
    /// Analyzes muscle activity with optimized signal processing
    public func analyzeMuscleActivity(_ data: SensorData) throws -> [String: Double] {
        guard securityValidator.validateDataSecurity(data) else {
            throw NSError(domain: "BiometricsError", code: 1003)
        }
        
        var muscleMetrics: [String: Double] = [:]
        let readings = data.currentReadings
        
        // Use Accelerate framework for optimized processing
        var mean: Double = 0
        var variance: Double = 0
        
        vDSP_meanvD(readings, 1, &mean, vDSP_Length(readings.count))
        vDSP_normalizeD(readings, 1, &mean, 1, &variance, vDSP_Length(readings.count))
        
        // Calculate muscle activation levels
        muscleMetrics["activation_level"] = mean
        muscleMetrics["activation_variance"] = variance
        muscleMetrics["peak_force"] = readings.max() ?? 0
        
        // Detect fatigue patterns
        let fatigueIndex = calculateFatigueIndex(readings)
        muscleMetrics["fatigue_index"] = fatigueIndex
        
        return muscleMetrics
    }
    
    /// Detects movement patterns using ML-based analysis
    public func detectMovementPatterns(_ dataSequence: [SensorData]) throws -> [String: [Double]] {
        guard !dataSequence.isEmpty else {
            throw NSError(domain: "BiometricsError", code: 1004)
        }
        
        var patterns: [String: [Double]] = [:]
        
        // Analyze temporal sequence
        let sequenceData = dataSequence.flatMap { $0.currentReadings }
        
        // Process movement phases
        let phases = identifyMovementPhases(sequenceData)
        patterns["movement_phases"] = phases
        
        // Calculate kinematic parameters
        let kinematics = calculateKinematicParameters(sequenceData)
        patterns["kinematics"] = kinematics
        
        // Compare with baseline
        if let baselineDeviation = calculateBaselineDeviation(kinematics) {
            patterns["baseline_deviation"] = [baselineDeviation]
        }
        
        return patterns
    }
    
    /// Calculates comprehensive biomechanical metrics
    public func calculateBiomechanicalMetrics(_ data: SensorData) throws -> [String: Double] {
        var metrics: [String: Double] = [:]
        let readings = data.currentReadings
        
        // Process kinematic data using Accelerate
        var acceleration: [Double] = Array(repeating: 0, count: readings.count)
        vDSP_vdiffD(readings, 1, &acceleration, 1, vDSP_Length(readings.count - 1))
        
        // Calculate joint angles
        let angles = calculateJointAngles(readings)
        metrics["joint_angles"] = angles.reduce(0, +) / Double(angles.count)
        
        // Analyze movement symmetry
        metrics["symmetry_index"] = calculateSymmetryIndex(readings)
        
        // Assess load distribution
        metrics["load_distribution"] = calculateLoadDistribution(readings)
        
        return metrics
    }
    
    // MARK: - Private Methods
    
    private func calculateFatigueIndex(_ data: [Double]) -> Double {
        var powerSpectrum = [Double](repeating: 0, count: data.count)
        vDSP_DCT_CreateD(nil, vDSP_Length(data.count), .II)?.transform(data, &powerSpectrum)
        
        let medianFrequency = calculateMedianFrequency(powerSpectrum)
        return 1.0 - (medianFrequency / Double(data.count))
    }
    
    private func identifyMovementPhases(_ data: [Double]) -> [Double] {
        var phases = [Double](repeating: 0, count: data.count)
        var threshold = 0.0
        
        vDSP_meanvD(data, 1, &threshold, vDSP_Length(data.count))
        threshold *= 0.5
        
        for i in 0..<data.count {
            phases[i] = data[i] > threshold ? 1.0 : 0.0
        }
        
        return phases
    }
    
    private func calculateKinematicParameters(_ data: [Double]) -> [Double] {
        var velocity = [Double](repeating: 0, count: data.count - 1)
        var acceleration = [Double](repeating: 0, count: data.count - 2)
        
        vDSP_vdiffD(data, 1, &velocity, 1, vDSP_Length(data.count - 1))
        vDSP_vdiffD(velocity, 1, &acceleration, 1, vDSP_Length(velocity.count - 1))
        
        return acceleration
    }
    
    private func calculateBaselineDeviation(_ data: [Double]) -> Double? {
        guard !data.isEmpty else { return nil }
        
        var mean: Double = 0
        var stdDev: Double = 0
        
        vDSP_normalizeD(data, 1, &mean, 1, &stdDev, vDSP_Length(data.count))
        return stdDev / mean
    }
    
    private func calculateJointAngles(_ data: [Double]) -> [Double] {
        var angles = [Double](repeating: 0, count: data.count / 3)
        
        for i in stride(from: 0, to: data.count - 2, by: 3) {
            let v1 = SIMD3<Double>(data[i], data[i + 1], data[i + 2])
            let v2 = SIMD3<Double>(1, 0, 0) // Reference vector
            
            angles[i / 3] = acos(dot(normalize(v1), normalize(v2)))
        }
        
        return angles
    }
    
    private func calculateSymmetryIndex(_ data: [Double]) -> Double {
        let midpoint = data.count / 2
        var leftSum: Double = 0
        var rightSum: Double = 0
        
        vDSP_sveD(data, 1, &leftSum, vDSP_Length(midpoint))
        vDSP_sveD(Array(data[midpoint...]), 1, &rightSum, vDSP_Length(data.count - midpoint))
        
        return abs(leftSum - rightSum) / (leftSum + rightSum)
    }
    
    private func calculateLoadDistribution(_ data: [Double]) -> Double {
        var maxLoad: Double = 0
        var totalLoad: Double = 0
        
        vDSP_maxvD(data, 1, &maxLoad, vDSP_Length(data.count))
        vDSP_sveD(data, 1, &totalLoad, vDSP_Length(data.count))
        
        return maxLoad / totalLoad
    }
    
    private func calculateMedianFrequency(_ spectrum: [Double]) -> Double {
        var totalPower: Double = 0
        vDSP_sveD(spectrum, 1, &totalPower, vDSP_Length(spectrum.count))
        
        var cumulativePower: Double = 0
        let medianPower = totalPower / 2
        
        for (index, power) in spectrum.enumerated() {
            cumulativePower += power
            if cumulativePower >= medianPower {
                return Double(index)
            }
        }
        
        return 0
    }
}