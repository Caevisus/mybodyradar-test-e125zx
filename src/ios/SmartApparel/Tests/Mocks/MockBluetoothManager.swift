//
// MockBluetoothManager.swift
// SmartApparel
//
// Mock implementation for testing Bluetooth functionality with enhanced calibration support
// Foundation version: Latest
// XCTest version: Latest
//

import Foundation
import XCTest

/// Enhanced mock implementation of BluetoothManager for testing with precise sampling rates and calibration support
final class MockBluetoothManager {
    
    // MARK: - Properties
    
    /// Singleton instance
    static let shared = MockBluetoothManager()
    
    /// Delegate for handling Bluetooth events
    weak var delegate: BluetoothManagerDelegate?
    
    private var isScanning: Bool = false
    private var connectedDevices: Set<String> = []
    private var simulatedSensorData: [SensorData] = []
    private let dataLock = NSLock()
    private var imuSampleTimer: Timer?
    private var tofSampleTimer: Timer?
    private var calibrationProgress: Double = 0.0
    private var compressionRatio: Double = 10.0
    private var shouldSimulateError: Bool = false
    private var errorType: SensorError?
    
    // MARK: - Initialization
    
    private init() {}
    
    // MARK: - Public Methods
    
    /// Simulates starting Bluetooth device scanning
    func startScanning() {
        isScanning = true
        
        // Simulate device discovery after delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            guard let self = self else { return }
            
            let deviceId = "MockDevice-\(UUID().uuidString.prefix(8))"
            self.connectedDevices.insert(deviceId)
            
            // Notify delegate of connection
            DispatchQueue.main.async {
                self.delegate?.didUpdateConnectionState(.active, peripheral: nil)
            }
            
            // Start data simulation
            self.setupSensorSimulation()
        }
    }
    
    /// Simulates sensor calibration process
    func simulateCalibration() {
        calibrationProgress = 0.0
        
        // Create calibration parameters
        let params = SensorCalibrationParams()
        
        // Simulate calibration progress
        Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] timer in
            guard let self = self else {
                timer.invalidate()
                return
            }
            
            self.calibrationProgress += 0.1
            
            if self.calibrationProgress >= 1.0 {
                timer.invalidate()
                self.delegate?.didUpdateCalibrationProgress(1.0, params: params)
                self.startDataTransmission()
            } else {
                self.delegate?.didUpdateCalibrationProgress(self.calibrationProgress, params: params)
            }
        }
    }
    
    /// Configures error simulation for testing
    func setSimulatedError(_ shouldError: Bool, _ error: SensorError) {
        shouldSimulateError = shouldError
        errorType = error
        
        if shouldSimulateError {
            delegate?.didEncounterError(error, peripheral: nil)
        }
    }
    
    // MARK: - Private Methods
    
    private func setupSensorSimulation() {
        // Setup IMU data simulation at 200Hz
        imuSampleTimer = Timer.scheduledTimer(withTimeInterval: 1.0/IMU_SAMPLING_RATE, 
                                            repeats: true) { [weak self] _ in
            self?.generateSensorData(type: .imu)
        }
        
        // Setup ToF data simulation at 100Hz
        tofSampleTimer = Timer.scheduledTimer(withTimeInterval: 1.0/TOF_SAMPLING_RATE, 
                                            repeats: true) { [weak self] _ in
            self?.generateSensorData(type: .tof)
        }
    }
    
    private func generateSensorData(type: SensorType) {
        dataLock.lock()
        defer { dataLock.unlock() }
        
        do {
            // Generate simulated readings
            let readings = (0..<DATA_BUFFER_SIZE).map { _ in 
                Double.random(in: -1.0...1.0)
            }
            
            // Create sensor data with compression
            let data = try SensorData(
                sensorId: "MOCK-\(UUID().uuidString.prefix(8))",
                type: type,
                readings: readings,
                bufferSize: DATA_BUFFER_SIZE,
                compressionRatio: compressionRatio
            )
            
            // Validate data before transmission
            guard case .success = data.isValid() else {
                throw SensorError.invalidReadings
            }
            
            // Check for simulated errors
            if shouldSimulateError, let error = errorType {
                throw error
            }
            
            // Store and notify
            simulatedSensorData.append(data)
            delegate?.didReceiveSensorData(data, type: type)
            
            // Verify sampling rate
            let expectedRate = type == .imu ? IMU_SAMPLING_RATE : TOF_SAMPLING_RATE
            delegate?.didVerifySamplingRate(expectedRate, for: type)
            
            // Validate compression
            let compressed = try data.compressData()
            let achievedRatio = Double(readings.count * MemoryLayout<Double>.size) / Double(compressed.count)
            delegate?.didValidateCompression(achievedRatio, for: data)
            
        } catch {
            delegate?.didEncounterError(error, peripheral: nil)
        }
    }
    
    private func startDataTransmission() {
        setupSensorSimulation()
    }
    
    deinit {
        imuSampleTimer?.invalidate()
        tofSampleTimer?.invalidate()
    }
}