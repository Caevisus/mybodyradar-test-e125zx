package com.smartapparel.app.services

import android.Manifest
import android.annotation.SuppressLint
import android.app.Service
import android.bluetooth.* // version: API 29+
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.ActivityCompat
import com.smartapparel.app.domain.models.IMUData
import com.smartapparel.app.domain.models.SensorData
import com.smartapparel.app.domain.models.ToFData
import com.smartapparel.app.utils.BLUETOOTH_CONFIG
import com.smartapparel.app.utils.DATA_CONFIG
import com.smartapparel.app.utils.SENSOR_STATUS
import kotlinx.collections.immutable.persistentListOf // version: 0.3.5
import kotlinx.coroutines.* // version: 1.7.3
import kotlinx.coroutines.flow.*
import java.nio.ByteBuffer
import java.util.*
import java.util.concurrent.ConcurrentHashMap
import java.util.zip.Deflater

@AndroidService
class BluetoothService : Service() {

    private lateinit var bluetoothAdapter: BluetoothAdapter
    private lateinit var powerManager: PowerManager
    private lateinit var wakeLock: PowerManager.WakeLock
    
    private val serviceScope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private val activeConnections = ConcurrentHashMap<String, BluetoothGatt>()
    private val dataBuffers = ConcurrentHashMap<String, CircularByteBuffer>()
    
    private val _sensorDataFlow = MutableStateFlow<Map<String, SensorData>>(emptyMap())
    val sensorDataFlow: StateFlow<Map<String, SensorData>> = _sensorDataFlow.asStateFlow()
    
    private val _connectionState = MutableStateFlow<Map<String, SENSOR_STATUS>>(emptyMap())
    val connectionState: StateFlow<Map<String, SENSOR_STATUS>> = _connectionState.asStateFlow()

    private val deflater = Deflater(Deflater.BEST_COMPRESSION)
    
    override fun onCreate() {
        super.onCreate()
        bluetoothAdapter = (getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter
        powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "SmartApparel::BluetoothServiceWakeLock"
        )
    }

    override fun onBind(intent: Intent?): IBinder? = null

    @SuppressLint("MissingPermission")
    fun scanForDevices(scanDuration: Long = BLUETOOTH_CONFIG.SCAN_PERIOD_MS): Flow<List<BluetoothDevice>> = flow {
        if (!hasRequiredPermissions()) throw SecurityException("Missing Bluetooth permissions")
        
        val scanner = bluetoothAdapter.bluetoothLeScanner
        val scanSettings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
            .build()
            
        val scanFilter = ScanFilter.Builder()
            .setServiceUuid(ParcelUuid(UUID.fromString(BLUETOOTH_CONFIG.SERVICE_UUID)))
            .build()

        val devices = mutableListOf<BluetoothDevice>()
        val scanCallback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                result.device?.let { device ->
                    if (!devices.contains(device)) {
                        devices.add(device)
                        serviceScope.launch {
                            emit(devices.toList())
                        }
                    }
                }
            }
        }

        try {
            scanner.startScan(listOf(scanFilter), scanSettings, scanCallback)
            delay(scanDuration)
        } finally {
            scanner.stopScan(scanCallback)
        }
    }.flowOn(Dispatchers.IO)

    @SuppressLint("MissingPermission")
    suspend fun connectToDevice(deviceId: String): Boolean {
        if (!hasRequiredPermissions()) throw SecurityException("Missing Bluetooth permissions")
        
        val device = bluetoothAdapter.getRemoteDevice(deviceId)
        updateConnectionState(deviceId, SENSOR_STATUS.CONNECTING)
        
        return suspendCancellableCoroutine { continuation ->
            val gattCallback = object : BluetoothGattCallback() {
                override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
                    when (newState) {
                        BluetoothProfile.STATE_CONNECTED -> {
                            gatt.requestMtu(BLUETOOTH_CONFIG.MTU_SIZE)
                            activeConnections[deviceId] = gatt
                            updateConnectionState(deviceId, SENSOR_STATUS.CALIBRATING)
                        }
                        BluetoothProfile.STATE_DISCONNECTED -> {
                            cleanupConnection(deviceId)
                            continuation.resume(false) { }
                        }
                    }
                }

                override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
                    if (status == BluetoothGatt.GATT_SUCCESS) {
                        gatt.discoverServices()
                    }
                }

                override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
                    if (status == BluetoothGatt.GATT_SUCCESS) {
                        setupCharacteristicNotifications(gatt, deviceId)
                        updateConnectionState(deviceId, SENSOR_STATUS.ACTIVE)
                        continuation.resume(true) { }
                    } else {
                        cleanupConnection(deviceId)
                        continuation.resume(false) { }
                    }
                }

                override fun onCharacteristicChanged(
                    gatt: BluetoothGatt,
                    characteristic: BluetoothGattCharacteristic
                ) {
                    processCharacteristicData(deviceId, characteristic)
                }
            }

            device.connectGatt(this, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
        }
    }

    fun getSensorData(deviceId: String): Flow<SensorData> = flow {
        if (!activeConnections.containsKey(deviceId)) {
            throw IllegalStateException("Device not connected: $deviceId")
        }

        sensorDataFlow.collect { sensorDataMap ->
            sensorDataMap[deviceId]?.let { emit(it) }
        }
    }.buffer(Channel.BUFFERED)

    private fun setupCharacteristicNotifications(gatt: BluetoothGatt, deviceId: String) {
        gatt.getService(UUID.fromString(BLUETOOTH_CONFIG.SERVICE_UUID))?.let { service ->
            service.getCharacteristic(UUID.fromString(BLUETOOTH_CONFIG.IMU_CHARACTERISTIC))?.let { imuChar ->
                gatt.setCharacteristicNotification(imuChar, true)
            }
            service.getCharacteristic(UUID.fromString(BLUETOOTH_CONFIG.TOF_CHARACTERISTIC))?.let { tofChar ->
                gatt.setCharacteristicNotification(tofChar, true)
            }
        }
        dataBuffers[deviceId] = CircularByteBuffer(DATA_CONFIG.BUFFER_SIZE)
    }

    private fun processCharacteristicData(deviceId: String, characteristic: BluetoothGattCharacteristic) {
        val data = characteristic.value
        dataBuffers[deviceId]?.let { buffer ->
            buffer.write(compressData(data))
            
            when (characteristic.uuid.toString()) {
                BLUETOOTH_CONFIG.IMU_CHARACTERISTIC -> processIMUData(deviceId, buffer)
                BLUETOOTH_CONFIG.TOF_CHARACTERISTIC -> processToFData(deviceId, buffer)
            }
        }
    }

    private fun processIMUData(deviceId: String, buffer: CircularByteBuffer) {
        val rawData = buffer.read(IMUData.DATA_SIZE)
        if (rawData.size == IMUData.DATA_SIZE) {
            val imuData = parseIMUData(rawData)
            updateSensorData(deviceId, imuData = imuData)
        }
    }

    private fun processToFData(deviceId: String, buffer: CircularByteBuffer) {
        val rawData = buffer.read(ToFData.DATA_SIZE)
        if (rawData.size == ToFData.DATA_SIZE) {
            val tofData = parseToFData(rawData)
            updateSensorData(deviceId, tofData = tofData)
        }
    }

    private fun parseIMUData(data: ByteArray): IMUData {
        val buffer = ByteBuffer.wrap(data)
        return IMUData(
            accelerometer = FloatArray(3) { buffer.float },
            gyroscope = FloatArray(3) { buffer.float },
            magnetometer = FloatArray(3) { buffer.float },
            temperature = buffer.float
        )
    }

    private fun parseToFData(data: ByteArray): ToFData {
        val buffer = ByteBuffer.wrap(data)
        return ToFData(
            distances = FloatArray(buffer.int) { buffer.float },
            gain = buffer.int,
            ambientLight = buffer.int
        )
    }

    private fun compressData(data: ByteArray): ByteArray {
        deflater.setInput(data)
        val compressedData = ByteArray((data.size / DATA_CONFIG.COMPRESSION_RATIO).toInt())
        deflater.finish()
        val compressedLength = deflater.deflate(compressedData)
        return compressedData.copyOf(compressedLength)
    }

    private fun updateSensorData(deviceId: String, imuData: IMUData? = null, tofData: ToFData? = null) {
        val currentData = _sensorDataFlow.value[deviceId] ?: SensorData(deviceId)
        _sensorDataFlow.update { currentMap ->
            currentMap + (deviceId to currentData.copy(
                imuData = imuData ?: currentData.imuData,
                tofData = tofData ?: currentData.tofData,
                timestamp = System.currentTimeMillis()
            ))
        }
    }

    private fun updateConnectionState(deviceId: String, status: SENSOR_STATUS) {
        _connectionState.update { it + (deviceId to status) }
    }

    private fun cleanupConnection(deviceId: String) {
        activeConnections.remove(deviceId)?.close()
        dataBuffers.remove(deviceId)
        updateConnectionState(deviceId, SENSOR_STATUS.DISCONNECTED)
    }

    private fun hasRequiredPermissions(): Boolean {
        return ActivityCompat.checkSelfPermission(
            this,
            Manifest.permission.BLUETOOTH_SCAN
        ) == PackageManager.PERMISSION_GRANTED &&
        ActivityCompat.checkSelfPermission(
            this,
            Manifest.permission.BLUETOOTH_CONNECT
        ) == PackageManager.PERMISSION_GRANTED
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
        activeConnections.forEach { (deviceId, gatt) ->
            cleanupConnection(deviceId)
        }
        if (wakeLock.isHeld) wakeLock.release()
        deflater.end()
    }

    private class CircularByteBuffer(capacity: Int) {
        private val buffer = ByteArray(capacity)
        private var writePosition = 0
        private var readPosition = 0
        private var size = 0

        @Synchronized
        fun write(data: ByteArray) {
            data.forEach { byte ->
                buffer[writePosition] = byte
                writePosition = (writePosition + 1) % buffer.size
                size = minOf(size + 1, buffer.size)
            }
        }

        @Synchronized
        fun read(count: Int): ByteArray {
            val actualCount = minOf(count, size)
            val result = ByteArray(actualCount)
            for (i in 0 until actualCount) {
                result[i] = buffer[readPosition]
                readPosition = (readPosition + 1) % buffer.size
                size--
            }
            return result
        }
    }

    companion object {
        private const val TAG = "BluetoothService"
    }
}