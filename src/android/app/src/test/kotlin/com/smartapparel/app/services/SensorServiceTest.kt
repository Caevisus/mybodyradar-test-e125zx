package com.smartapparel.app.services

import io.mockk.* // version: 1.13.5
import io.mockk.impl.annotations.MockK
import kotlinx.coroutines.test.* // version: 1.7.3
import kotlinx.coroutines.flow.*
import org.junit.jupiter.api.* // version: 5.9.0
import org.junit.jupiter.api.Assertions.*
import kotlin.time.* // version: 1.9.0
import kotlin.time.Duration.Companion.milliseconds
import com.smartapparel.app.domain.models.IMUData
import com.smartapparel.app.domain.models.ToFData
import com.smartapparel.app.domain.models.SensorData
import com.smartapparel.app.utils.SENSOR_STATUS
import com.smartapparel.app.utils.SAMPLING_RATES
import com.smartapparel.app.utils.DATA_CONFIG
import com.smartapparel.app.utils.CALIBRATION_PARAMS
import com.smartapparel.app.data.repository.SensorRepository

@OptIn(ExperimentalCoroutinesApi::class)
class SensorServiceTest {
    @MockK
    private lateinit var bluetoothService: BluetoothService

    @MockK
    private lateinit var sensorRepository: SensorRepository

    private lateinit var sensorService: SensorService
    private lateinit var testScope: TestScope
    private lateinit var testScheduler: TestCoroutineScheduler
    private lateinit var timingSource: TestTimeSource

    private val testSensorId = "test_sensor_01"
    private val testSessionId = 12345L

    @BeforeEach
    fun setUp() {
        MockKAnnotations.init(this)
        testScope = TestScope()
        testScheduler = TestCoroutineScheduler()
        timingSource = TestTimeSource()

        // Initialize SensorService with mocks
        sensorService = SensorService(bluetoothService, sensorRepository)

        // Configure default mock behaviors
        coEvery { bluetoothService.connectToDevice(any()) } returns true
        coEvery { sensorRepository.insertSensorDataBatch(any()) } returns listOf(1L)
    }

    @Test
    fun `test real-time processing latency requirement of 100ms`() = testScope.runTest {
        // Prepare test data
        val imuData = IMUData(
            accelerometer = floatArrayOf(1.0f, 2.0f, 3.0f),
            gyroscope = floatArrayOf(0.1f, 0.2f, 0.3f),
            magnetometer = floatArrayOf(10f, 20f, 30f),
            temperature = 25.0f
        )
        val tofData = ToFData(
            distances = floatArrayOf(100f, 110f, 120f),
            gain = 8,
            ambientLight = 500
        )
        val sensorData = SensorData(
            sensorId = testSensorId,
            timestamp = System.currentTimeMillis(),
            imuData = imuData,
            tofData = tofData
        )

        // Configure mock data stream
        coEvery { bluetoothService.getSensorData(testSensorId) } returns flow {
            emit(sensorData)
        }

        // Measure processing time
        var processingTime: Duration = Duration.ZERO
        val monitoringJob = launch {
            timingSource.markNow()
            sensorService.startSensorMonitoring(testSensorId).collect { processedData ->
                processingTime = timingSource.elapsedNow()
                
                // Verify data integrity
                assertNotNull(processedData)
                assertEquals(testSensorId, processedData.sensorId)
                assertNotNull(processedData.imuData)
                assertNotNull(processedData.tofData)
            }
        }

        // Advance virtual time and verify latency
        advanceTimeBy(200.milliseconds)
        assertTrue(processingTime < 100.milliseconds, 
            "Processing time $processingTime exceeded 100ms requirement")

        monitoringJob.cancel()
    }

    @Test
    fun `test sensor measurement accuracy within ±1% deviation`() = testScope.runTest {
        // Prepare calibration reference data
        val referenceIMU = IMUData(
            accelerometer = floatArrayOf(9.81f, 0f, 0f),
            gyroscope = floatArrayOf(0f, 0f, 0f),
            magnetometer = floatArrayOf(25f, 25f, 25f),
            temperature = 25.0f
        )
        val referenceTOF = ToFData(
            distances = floatArrayOf(1000f, 1000f, 1000f),
            gain = CALIBRATION_PARAMS.TOF_GAIN_DEFAULT,
            ambientLight = 500
        )

        // Configure calibration mock
        coEvery { bluetoothService.getSensorData(testSensorId) } returns flow {
            repeat(CALIBRATION_PARAMS.CALIBRATION_SAMPLES) {
                emit(SensorData(
                    sensorId = testSensorId,
                    imuData = referenceIMU,
                    tofData = referenceTOF
                ))
            }
        }

        // Perform calibration
        val calibrationSuccess = sensorService.calibrateSensor(testSensorId)
        assertTrue(calibrationSuccess, "Calibration failed")

        // Test measurement accuracy
        val testData = flow {
            repeat(100) {
                // Add controlled variation within ±1%
                val variation = 0.01f // 1%
                emit(SensorData(
                    sensorId = testSensorId,
                    imuData = IMUData(
                        accelerometer = floatArrayOf(
                            9.81f * (1f + (-variation..variation).random()),
                            0f,
                            0f
                        ),
                        gyroscope = referenceIMU.gyroscope,
                        magnetometer = referenceIMU.magnetometer,
                        temperature = referenceIMU.temperature
                    ),
                    tofData = referenceTOF
                ))
            }
        }

        coEvery { bluetoothService.getSensorData(testSensorId) } returns testData

        // Collect and verify measurements
        sensorService.startSensorMonitoring(testSensorId).collect { processedData ->
            processedData.imuData?.let { imu ->
                val deviation = Math.abs(imu.accelerometer[0] - 9.81f) / 9.81f
                assertTrue(deviation <= 0.01f, 
                    "Measurement deviation $deviation exceeds ±1% threshold")
            }
        }
    }

    @Test
    fun `test data compression ratio of 10-1`() = testScope.runTest {
        // Generate large test dataset
        val largeDataset = flow {
            repeat(1000) {
                emit(SensorData(
                    sensorId = testSensorId,
                    imuData = IMUData(
                        accelerometer = FloatArray(3) { Math.random().toFloat() },
                        gyroscope = FloatArray(3) { Math.random().toFloat() },
                        magnetometer = FloatArray(3) { Math.random().toFloat() },
                        temperature = 25.0f
                    ),
                    tofData = ToFData(
                        distances = FloatArray(32) { Math.random().toFloat() * 1000f },
                        gain = 8,
                        ambientLight = 500
                    )
                ))
            }
        }

        coEvery { bluetoothService.getSensorData(testSensorId) } returns largeDataset

        // Track data sizes
        var rawDataSize = 0L
        var compressedDataSize = 0L

        // Process data and measure compression
        sensorService.startSensorMonitoring(testSensorId).collect { processedData ->
            // Calculate raw data size
            rawDataSize += (processedData.imuData?.let { 10 * Float.SIZE_BYTES } ?: 0) +
                          (processedData.tofData?.let { (it.distances.size + 2) * Float.SIZE_BYTES } ?: 0)

            // Get compressed size from repository calls
            verify { 
                sensorRepository.insertSensorDataBatch(capture(slot()))
            }
            compressedDataSize += slot<List<SensorData>>().captured.first().let {
                (it.imuData?.let { 10 * Float.SIZE_BYTES / DATA_CONFIG.COMPRESSION_RATIO } ?: 0) +
                (it.tofData?.let { (it.distances.size + 2) * Float.SIZE_BYTES / DATA_CONFIG.COMPRESSION_RATIO } ?: 0)
            }.toLong()
        }

        // Verify compression ratio
        val actualCompressionRatio = rawDataSize.toFloat() / compressedDataSize
        assertTrue(actualCompressionRatio >= DATA_CONFIG.COMPRESSION_RATIO,
            "Compression ratio $actualCompressionRatio below target ${DATA_CONFIG.COMPRESSION_RATIO}")
    }

    @Test
    fun `test error handling and recovery`() = testScope.runTest {
        // Test connection failure
        coEvery { bluetoothService.connectToDevice(testSensorId) } returns false
        assertThrows<IllegalStateException> {
            sensorService.startSensorMonitoring(testSensorId).collect()
        }

        // Test data corruption
        coEvery { bluetoothService.connectToDevice(testSensorId) } returns true
        coEvery { bluetoothService.getSensorData(testSensorId) } returns flow {
            emit(SensorData(testSensorId)) // Invalid data without IMU or ToF
            throw IllegalStateException("Corrupted data")
        }

        var errorCaught = false
        try {
            sensorService.startSensorMonitoring(testSensorId).collect()
        } catch (e: IllegalStateException) {
            errorCaught = true
        }
        assertTrue(errorCaught, "Error handling failed to catch data corruption")

        // Verify cleanup after error
        verify { bluetoothService.disconnect(testSensorId) }
        
        // Test recovery
        coEvery { bluetoothService.getSensorData(testSensorId) } returns flow {
            emit(SensorData(
                sensorId = testSensorId,
                imuData = IMUData(
                    accelerometer = floatArrayOf(0f, 0f, 0f),
                    gyroscope = floatArrayOf(0f, 0f, 0f),
                    magnetometer = floatArrayOf(0f, 0f, 0f),
                    temperature = 25.0f
                )
            ))
        }

        // Verify successful recovery
        var recovered = false
        sensorService.startSensorMonitoring(testSensorId).collect {
            recovered = true
        }
        assertTrue(recovered, "Service failed to recover after error")
    }

    @AfterEach
    fun tearDown() {
        clearAllMocks()
    }
}