package com.smartapparel.app.services

import android.bluetooth.*
import android.content.Context
import android.content.pm.PackageManager
import android.os.PowerManager
import androidx.core.app.ActivityCompat
import com.smartapparel.app.domain.models.IMUData
import com.smartapparel.app.domain.models.SensorData
import com.smartapparel.app.domain.models.ToFData
import com.smartapparel.app.utils.BLUETOOTH_CONFIG
import com.smartapparel.app.utils.DATA_CONFIG
import com.smartapparel.app.utils.SAMPLING_RATES
import com.smartapparel.app.utils.SENSOR_STATUS
import io.mockk.* // version: 1.13.5
import io.mockk.impl.annotations.MockK
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.take
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.* // version: 1.7.3
import org.junit.jupiter.api.* // version: 5.9.0
import java.nio.ByteBuffer
import java.util.*
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

@ExperimentalCoroutinesApi
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class BluetoothServiceTest {

    private lateinit var bluetoothService: BluetoothService
    
    @MockK
    private lateinit var mockContext: Context
    
    @MockK
    private lateinit var mockBluetoothManager: BluetoothManager
    
    @MockK
    private lateinit var mockBluetoothAdapter: BluetoothAdapter
    
    @MockK
    private lateinit var mockBluetoothLeScanner: BluetoothLeScanner
    
    @MockK
    private lateinit var mockPowerManager: PowerManager
    
    @MockK
    private lateinit var mockWakeLock: PowerManager.WakeLock
    
    @MockK
    private lateinit var mockBluetoothGatt: BluetoothGatt
    
    @MockK
    private lateinit var mockBluetoothDevice: BluetoothDevice

    private val testDispatcher = TestCoroutineDispatcher()
    private val testScope = TestCoroutineScope(testDispatcher)

    @BeforeAll
    fun setup() {
        MockKAnnotations.init(this)
        
        // Setup context mocks
        every { mockContext.getSystemService(Context.BLUETOOTH_SERVICE) } returns mockBluetoothManager
        every { mockContext.getSystemService(Context.POWER_SERVICE) } returns mockPowerManager
        every { mockBluetoothManager.adapter } returns mockBluetoothAdapter
        every { mockPowerManager.newWakeLock(any(), any()) } returns mockWakeLock
        
        // Setup Bluetooth permissions
        mockkStatic(ActivityCompat::class)
        every { 
            ActivityCompat.checkSelfPermission(any(), any()) 
        } returns PackageManager.PERMISSION_GRANTED
        
        // Setup Bluetooth scanning
        every { mockBluetoothAdapter.bluetoothLeScanner } returns mockBluetoothLeScanner
        every { 
            mockBluetoothLeScanner.startScan(any(), any(), any())
        } just Runs
        every { 
            mockBluetoothLeScanner.stopScan(any())
        } just Runs
    }

    @BeforeEach
    fun beforeEach() {
        clearAllMocks()
        bluetoothService = BluetoothService()
        
        // Inject mocked dependencies
        bluetoothService.onCreate()
    }

    @AfterAll
    fun cleanup() {
        testScope.cleanupTestCoroutines()
    }

    @Test
    fun `test scanForDevices returns discovered devices`() = testScope.runTest {
        // Prepare test data
        val deviceAddress = "00:11:22:33:44:55"
        val scanResult = mockk<ScanResult>()
        every { scanResult.device } returns mockBluetoothDevice
        every { mockBluetoothDevice.address } returns deviceAddress
        
        // Capture scan callback
        val callbackSlot = slot<ScanCallback>()
        every { 
            mockBluetoothLeScanner.startScan(any(), any(), capture(callbackSlot))
        } just Runs

        // Start scan
        val devices = bluetoothService.scanForDevices()
            .take(1)
            .toList()

        // Simulate device discovery
        callbackSlot.captured.onScanResult(
            ScanSettings.CALLBACK_TYPE_ALL_MATCHES,
            scanResult
        )

        // Verify results
        assertEquals(1, devices.size)
        assertEquals(deviceAddress, devices[0][0].address)
        
        // Verify scan parameters
        verify {
            mockBluetoothLeScanner.startScan(
                match { filters ->
                    filters.any { it.serviceUuid?.uuid.toString() == BLUETOOTH_CONFIG.SERVICE_UUID }
                },
                match { settings ->
                    settings.scanMode == ScanSettings.SCAN_MODE_LOW_LATENCY
                },
                any()
            )
        }
    }

    @Test
    fun `test connectToDevice establishes connection with correct parameters`() = testScope.runTest {
        // Prepare test data
        val deviceId = "00:11:22:33:44:55"
        every { mockBluetoothAdapter.getRemoteDevice(deviceId) } returns mockBluetoothDevice
        
        // Capture GATT callback
        val callbackSlot = slot<BluetoothGattCallback>()
        every { 
            mockBluetoothDevice.connectGatt(
                any(),
                any(),
                capture(callbackSlot),
                BluetoothDevice.TRANSPORT_LE
            )
        } returns mockBluetoothGatt

        // Start connection
        val connectionJob = testScope.launch {
            bluetoothService.connectToDevice(deviceId)
        }

        // Simulate successful connection sequence
        callbackSlot.captured.onConnectionStateChange(
            mockBluetoothGatt,
            BluetoothGatt.GATT_SUCCESS,
            BluetoothProfile.STATE_CONNECTED
        )
        callbackSlot.captured.onMtuChanged(
            mockBluetoothGatt,
            BLUETOOTH_CONFIG.MTU_SIZE,
            BluetoothGatt.GATT_SUCCESS
        )
        callbackSlot.captured.onServicesDiscovered(
            mockBluetoothGatt,
            BluetoothGatt.GATT_SUCCESS
        )

        // Wait for connection completion
        connectionJob.join()

        // Verify connection state transitions
        val states = bluetoothService.connectionState.first()
        assertEquals(SENSOR_STATUS.ACTIVE, states[deviceId])
    }

    @Test
    fun `test getSensorData processes IMU and ToF data at correct sampling rates`() = testScope.runTest {
        // Prepare test data
        val deviceId = "00:11:22:33:44:55"
        val imuData = createTestIMUData()
        val tofData = createTestToFData()
        
        // Setup mock connection
        setupMockConnection(deviceId)

        // Start data collection
        val dataJob = testScope.launch {
            bluetoothService.getSensorData(deviceId)
                .take(2) // Collect both IMU and ToF updates
                .toList()
        }

        // Simulate sensor data reception
        simulateSensorData(deviceId, imuData, tofData)

        // Wait for data collection
        val collectedData = dataJob.await()

        // Verify data sampling rates and processing
        verifyDataSamplingRates(collectedData)
        verifyDataProcessingLatency(collectedData)
    }

    @Test
    fun `test error handling for missing permissions`() = testScope.runTest {
        // Mock missing permissions
        every { 
            ActivityCompat.checkSelfPermission(any(), any()) 
        } returns PackageManager.PERMISSION_DENIED

        // Verify scan throws SecurityException
        assertFailsWith<SecurityException> {
            bluetoothService.scanForDevices().first()
        }

        // Verify connect throws SecurityException
        assertFailsWith<SecurityException> {
            bluetoothService.connectToDevice("00:11:22:33:44:55")
        }
    }

    private fun createTestIMUData(): IMUData {
        return IMUData(
            accelerometer = floatArrayOf(1.0f, 2.0f, 3.0f),
            gyroscope = floatArrayOf(0.1f, 0.2f, 0.3f),
            magnetometer = floatArrayOf(10.0f, 20.0f, 30.0f),
            temperature = 25.0f
        )
    }

    private fun createTestToFData(): ToFData {
        return ToFData(
            distances = floatArrayOf(100.0f, 200.0f, 300.0f),
            gain = 8,
            ambientLight = 1000
        )
    }

    private fun setupMockConnection(deviceId: String) {
        val mockGattService = mockk<BluetoothGattService>()
        val mockImuCharacteristic = mockk<BluetoothGattCharacteristic>()
        val mockTofCharacteristic = mockk<BluetoothGattCharacteristic>()

        every { mockBluetoothGatt.getService(any()) } returns mockGattService
        every { mockGattService.getCharacteristic(any()) } returns mockImuCharacteristic andThen mockTofCharacteristic
        every { mockBluetoothGatt.setCharacteristicNotification(any(), any()) } returns true
    }

    private fun simulateSensorData(deviceId: String, imuData: IMUData, tofData: ToFData) {
        val mockGattCallback = slot<BluetoothGattCallback>()
        val mockImuCharacteristic = mockk<BluetoothGattCharacteristic>()
        val mockTofCharacteristic = mockk<BluetoothGattCharacteristic>()

        // Setup characteristic UUIDs
        every { mockImuCharacteristic.uuid } returns UUID.fromString(BLUETOOTH_CONFIG.IMU_CHARACTERISTIC)
        every { mockTofCharacteristic.uuid } returns UUID.fromString(BLUETOOTH_CONFIG.TOF_CHARACTERISTIC)

        // Prepare sensor data
        every { mockImuCharacteristic.value } returns serializeIMUData(imuData)
        every { mockTofCharacteristic.value } returns serializeToFData(tofData)

        // Simulate data reception
        mockGattCallback.captured.onCharacteristicChanged(mockBluetoothGatt, mockImuCharacteristic)
        mockGattCallback.captured.onCharacteristicChanged(mockBluetoothGatt, mockTofCharacteristic)
    }

    private fun serializeIMUData(data: IMUData): ByteArray {
        return ByteBuffer.allocate(40).apply {
            data.accelerometer.forEach { putFloat(it) }
            data.gyroscope.forEach { putFloat(it) }
            data.magnetometer.forEach { putFloat(it) }
            putFloat(data.temperature)
        }.array()
    }

    private fun serializeToFData(data: ToFData): ByteArray {
        return ByteBuffer.allocate(20).apply {
            putInt(data.distances.size)
            data.distances.forEach { putFloat(it) }
            putInt(data.gain)
            putInt(data.ambientLight)
        }.array()
    }

    private fun verifyDataSamplingRates(collectedData: List<SensorData>) {
        collectedData.forEach { sensorData ->
            // Verify IMU sampling rate (200Hz)
            sensorData.imuData?.let {
                assertTrue(
                    sensorData.timestamp - (collectedData.first().timestamp) <= 1000 / SAMPLING_RATES.IMU_HZ,
                    "IMU sampling rate exceeds 200Hz requirement"
                )
            }

            // Verify ToF sampling rate (100Hz)
            sensorData.tofData?.let {
                assertTrue(
                    sensorData.timestamp - (collectedData.first().timestamp) <= 1000 / SAMPLING_RATES.TOF_HZ,
                    "ToF sampling rate exceeds 100Hz requirement"
                )
            }
        }
    }

    private fun verifyDataProcessingLatency(collectedData: List<SensorData>) {
        collectedData.forEach { sensorData ->
            val processingLatency = System.currentTimeMillis() - sensorData.timestamp
            assertTrue(
                processingLatency < 100,
                "Data processing latency exceeds 100ms requirement"
            )
        }
    }
}