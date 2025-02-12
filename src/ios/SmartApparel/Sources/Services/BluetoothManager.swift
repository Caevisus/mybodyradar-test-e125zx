//
// BluetoothManager.swift
// SmartApparel
//
// CoreBluetooth version: Latest
// Foundation version: Latest
//

import Foundation
import CoreBluetooth

/// Core service managing Bluetooth Low Energy (BLE) communication with smart apparel sensors
@objc public class BluetoothManager: NSObject {
    
    // MARK: - Properties
    
    /// Shared singleton instance
    public static let shared = BluetoothManager()
    
    /// Delegate for handling Bluetooth events
    public weak var delegate: BluetoothManagerDelegate?
    
    /// Central manager for BLE operations
    private let centralManager: CBCentralManager
    
    /// Queue for BLE operations
    private let queue: DispatchQueue
    
    /// Connected peripheral devices
    private var connectedPeripherals: [CBPeripheral] = []
    
    /// Current sensor configuration
    private var sensorConfiguration: SensorConfiguration
    
    /// Active calibration parameters
    private var calibrationParameters: SensorCalibrationParams
    
    /// Logger instance for structured logging
    private let logger = Logger.shared
    
    /// Connection timeout timer
    private var connectionTimer: Timer?
    
    /// Service UUIDs for device filtering
    private let serviceUUIDs = [
        CBUUID(string: "180D"), // Heart Rate Service
        CBUUID(string: "181C")  // User Data Service
    ]
    
    // MARK: - Initialization
    
    private override init() {
        self.queue = DispatchQueue(label: "com.smartapparel.bluetooth", qos: .userInitiated)
        self.sensorConfiguration = SensorConfiguration()
        self.calibrationParameters = SensorCalibrationParams()
        
        super.init()
        
        self.centralManager = CBCentralManager(
            delegate: nil,
            queue: queue,
            options: [
                CBCentralManagerOptionShowPowerAlertKey: true,
                CBCentralManagerOptionRestoreIdentifierKey: "SmartApparelBLEManager"
            ]
        )
        
        self.centralManager.delegate = self
        
        logger.log(
            "BluetoothManager initialized",
            level: .info,
            category: .bluetooth,
            metadata: ["serviceUUIDs": serviceUUIDs.map { $0.uuidString }]
        )
    }
    
    // MARK: - Public Methods
    
    /// Starts scanning for compatible BLE devices
    public func startScanning() {
        guard centralManager.state == .poweredOn else {
            delegate?.didEncounterError(BluetoothManagerError.powerOff, peripheral: nil)
            return
        }
        
        let scanOptions: [String: Any] = [
            CBCentralManagerScanOptionAllowDuplicatesKey: false,
            CBCentralManagerScanOptionScanIntervalKey: NSNumber(value: 100), // 100ms scan interval
            CBCentralManagerScanOptionScanWindowKey: NSNumber(value: 50)     // 50ms scan window
        ]
        
        centralManager.scanForPeripherals(
            withServices: serviceUUIDs,
            options: scanOptions
        )
        
        logger.log(
            "Started BLE scanning",
            level: .info,
            category: .bluetooth,
            metadata: ["scanOptions": scanOptions]
        )
    }
    
    /// Stops scanning for BLE devices
    public func stopScanning() {
        centralManager.stopScan()
        logger.log("Stopped BLE scanning", level: .info, category: .bluetooth)
    }
    
    /// Configures sensor parameters
    public func configureSensor(configuration: SensorConfiguration, calibration: SensorCalibrationParams) -> Result<Bool, SensorConfigError> {
        // Validate configuration
        let configResult = validateSensorConfig(configuration)
        switch configResult {
        case .failure(let error):
            logger.error(
                "Sensor configuration validation failed",
                category: .sensor,
                error: error
            )
            return .failure(error)
        case .success:
            break
        }
        
        // Update configuration
        self.sensorConfiguration = configuration
        self.calibrationParameters = calibration
        
        // Apply configuration to connected peripherals
        for peripheral in connectedPeripherals {
            applySensorConfiguration(to: peripheral)
        }
        
        logger.log(
            "Sensor configuration updated",
            level: .info,
            category: .sensor,
            metadata: [
                "tofGain": calibration.tofGain,
                "imuDriftCorrection": calibration.imuDriftCorrection,
                "pressureThreshold": calibration.pressureThreshold
            ]
        )
        
        return .success(true)
    }
    
    // MARK: - Private Methods
    
    private func applySensorConfiguration(to peripheral: CBPeripheral) {
        guard let configService = peripheral.services?.first(where: { $0.uuid == serviceUUIDs[1] }) else {
            logger.error(
                "Configuration service not found",
                category: .bluetooth,
                metadata: ["peripheralId": peripheral.identifier.uuidString]
            )
            return
        }
        
        // Write configuration characteristics
        for characteristic in configService.characteristics ?? [] {
            switch characteristic.uuid.uuidString {
            case "2A1C": // ToF Gain
                let data = withUnsafeBytes(of: calibrationParameters.tofGain) { Data($0) }
                peripheral.writeValue(data, for: characteristic, type: .withResponse)
                
            case "2A1D": // IMU Drift Correction
                let data = withUnsafeBytes(of: calibrationParameters.imuDriftCorrection) { Data($0) }
                peripheral.writeValue(data, for: characteristic, type: .withResponse)
                
            case "2A1E": // Pressure Threshold
                let data = withUnsafeBytes(of: calibrationParameters.pressureThreshold) { Data($0) }
                peripheral.writeValue(data, for: characteristic, type: .withResponse)
                
            default:
                break
            }
        }
    }
    
    private func handleSensorData(_ data: Data, from peripheral: CBPeripheral) {
        do {
            let sensorData = try SensorData(
                sensorId: peripheral.identifier.uuidString,
                type: .imu,
                readings: [Double](repeating: 0, count: Int(IMU_SAMPLING_RATE)),
                bufferSize: DATA_BUFFER_SIZE,
                compressionRatio: 10.0
            )
            
            // Validate sensor data
            switch sensorData.isValid() {
            case .success:
                delegate?.didReceiveSensorData(sensorData, type: .imu)
            case .failure(let error):
                delegate?.didEncounterError(error, peripheral: peripheral)
            }
            
        } catch {
            logger.error(
                "Failed to process sensor data",
                category: .sensor,
                error: error,
                metadata: ["peripheralId": peripheral.identifier.uuidString]
            )
            delegate?.didEncounterError(error, peripheral: peripheral)
        }
    }
}

// MARK: - CBCentralManagerDelegate

extension BluetoothManager: CBCentralManagerDelegate {
    
    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        switch central.state {
        case .poweredOn:
            startScanning()
        case .poweredOff:
            delegate?.didEncounterError(BluetoothManagerError.powerOff, peripheral: nil)
        case .unauthorized:
            delegate?.didEncounterError(BluetoothManagerError.unauthorizedAccess, peripheral: nil)
        default:
            delegate?.didEncounterError(BluetoothManagerError.invalidState, peripheral: nil)
        }
        
        logger.log(
            "Bluetooth state updated",
            level: .info,
            category: .bluetooth,
            metadata: ["state": central.state.rawValue]
        )
    }
    
    public func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi RSSI: NSNumber) {
        guard RSSI.intValue >= BluetoothThresholds.rssiMinimum else { return }
        
        peripheral.delegate = self
        central.connect(peripheral, options: nil)
        
        connectionTimer = Timer.scheduledTimer(withTimeInterval: BluetoothTimeouts.connection, repeats: false) { [weak self] _ in
            self?.centralManager.cancelPeripheralConnection(peripheral)
            self?.delegate?.didEncounterError(BluetoothManagerError.connectionTimeout, peripheral: peripheral)
        }
        
        logger.log(
            "Discovered peripheral",
            level: .info,
            category: .bluetooth,
            metadata: [
                "peripheralId": peripheral.identifier.uuidString,
                "rssi": RSSI,
                "advertisementData": advertisementData
            ]
        )
    }
    
    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        connectionTimer?.invalidate()
        connectionTimer = nil
        
        connectedPeripherals.append(peripheral)
        peripheral.discoverServices(serviceUUIDs)
        
        delegate?.didUpdateConnectionState(.active, peripheral: peripheral)
        
        logger.log(
            "Connected to peripheral",
            level: .info,
            category: .bluetooth,
            metadata: ["peripheralId": peripheral.identifier.uuidString]
        )
    }
    
    public func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        connectedPeripherals.removeAll { $0.identifier == peripheral.identifier }
        
        delegate?.didUpdateConnectionState(.inactive, peripheral: peripheral)
        
        if let error = error {
            logger.error(
                "Peripheral disconnected with error",
                category: .bluetooth,
                error: error,
                metadata: ["peripheralId": peripheral.identifier.uuidString]
            )
        } else {
            logger.log(
                "Peripheral disconnected",
                level: .info,
                category: .bluetooth,
                metadata: ["peripheralId": peripheral.identifier.uuidString]
            )
        }
    }
}

// MARK: - CBPeripheralDelegate

extension BluetoothManager: CBPeripheralDelegate {
    
    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        if let error = error {
            delegate?.didEncounterError(BluetoothManagerError.serviceDiscoveryFailed, peripheral: peripheral)
            logger.error(
                "Service discovery failed",
                category: .bluetooth,
                error: error,
                metadata: ["peripheralId": peripheral.identifier.uuidString]
            )
            return
        }
        
        for service in peripheral.services ?? [] {
            peripheral.discoverCharacteristics(nil, for: service)
        }
    }
    
    public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        if let error = error {
            delegate?.didEncounterError(BluetoothManagerError.characteristicReadFailed, peripheral: peripheral)
            logger.error(
                "Characteristic discovery failed",
                category: .bluetooth,
                error: error,
                metadata: [
                    "peripheralId": peripheral.identifier.uuidString,
                    "serviceUUID": service.uuid.uuidString
                ]
            )
            return
        }
        
        for characteristic in service.characteristics ?? [] {
            if characteristic.properties.contains(.notify) {
                peripheral.setNotifyValue(true, for: characteristic)
            }
        }
        
        // Apply sensor configuration after discovering characteristics
        applySensorConfiguration(to: peripheral)
    }
    
    public func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        if let error = error {
            delegate?.didEncounterError(BluetoothManagerError.characteristicReadFailed, peripheral: peripheral)
            logger.error(
                "Characteristic update failed",
                category: .bluetooth,
                error: error,
                metadata: [
                    "peripheralId": peripheral.identifier.uuidString,
                    "characteristicUUID": characteristic.uuid.uuidString
                ]
            )
            return
        }
        
        if let value = characteristic.value {
            handleSensorData(value, from: peripheral)
        }
    }
}