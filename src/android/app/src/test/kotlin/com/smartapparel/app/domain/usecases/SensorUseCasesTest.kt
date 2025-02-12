package com.smartapparel.app.domain.usecases

import io.mockk.* // version: 1.13.5
import io.mockk.impl.annotations.MockK
import kotlinx.coroutines.test.* // version: 1.7.3
import kotlinx.coroutines.flow.*
import org.junit.jupiter.api.* // version: 5.9.0
import org.junit.jupiter.api.Assertions.*
import com.smartapparel.app.data.repository.SensorRepository
import com.smartapparel.app.services.SensorService
import com.smartapparel.app.domain.models.SensorData
import com.smartapparel.app.domain.models.IMUData
import com.smartapparel.app.domain.models.ToFData
import com.smartapparel.app.utils.SENSOR_STATUS
import com.smartapparel.app.utils.DATA_CONFIG
import com.smartapparel.app.utils.SAMPLING_RATES
import kotlin.time.Duration.Companion.milliseconds

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class GetSensorDataUseCaseTest {
    @MockK
    private lateinit var sensorRepository: SensorRepository
    
    @MockK
    private lateinit var sensorService: SensorService
    
    private lateinit var getSensorDataUseCase: GetSensorDataUseCase
    private lateinit var testDispatcher: TestDispatcher
    
    @BeforeEach
    fun setup() {
        MockKAnnotations.init(this)
        testDispatcher = StandardTestDispatcher()
        getSensorDataUseCase = GetSensorDataUseCase(sensorRepository, sensorService)
    }

    @Test
    fun `test processing latency meets performance requirement`() = runTest {
        // Arrange
        val sensorId = "test_sensor_1"
        val testData = generateTestSensorData(sensorId)
        coEvery { sensorService.startSensorMonitoring(sensorId) } returns flowOf(testData)
        coEvery { sensorRepository.insertSensorDataBatch(any()) } returns listOf(1L)

        // Act
        val startTime = testDispatcher.scheduler.currentTime
        val result = getSensorDataUseCase(sensorId).first()
        val processingTime = (testDispatcher.scheduler.currentTime - startTime).milliseconds

        // Assert
        assertTrue(processingTime.inWholeMilliseconds < 100, 
            "Processing latency ${processingTime.inWholeMilliseconds}ms exceeds 100ms requirement")
        assertEquals(testData.sensorId, result.sensorId)
        coVerify { sensorRepository.insertSensorDataBatch(match { it.size == 1 }) }
    }

    @Test
    fun `test data compression ratio meets requirement`() = runTest {
        // Arrange
        val sensorId = "test_sensor_2"
        val rawData = generateLargeSensorData(sensorId)
        coEvery { sensorService.startSensorMonitoring(sensorId) } returns flowOf(rawData)
        coEvery { sensorRepository.insertSensorDataBatch(any()) } returns listOf(1L)

        // Act
        val result = getSensorDataUseCase(sensorId).first()

        // Assert
        val compressionRatio = calculateCompressionRatio(rawData, result)
        assertTrue(compressionRatio >= DATA_CONFIG.COMPRESSION_RATIO,
            "Compression ratio $compressionRatio below target ${DATA_CONFIG.COMPRESSION_RATIO}")
    }

    @Test
    fun `test error handling for invalid sensor data`() = runTest {
        // Arrange
        val sensorId = "test_sensor_3"
        val invalidData = SensorData(sensorId = sensorId, status = SENSOR_STATUS.ERROR)
        coEvery { sensorService.startSensorMonitoring(sensorId) } returns flowOf(invalidData)

        // Act & Assert
        assertThrows<IllegalStateException> {
            getSensorDataUseCase(sensorId).first()
        }
    }

    private fun generateTestSensorData(sensorId: String): SensorData {
        return SensorData(
            sensorId = sensorId,
            timestamp = System.currentTimeMillis(),
            imuData = IMUData(
                accelerometer = FloatArray(3) { 1f },
                gyroscope = FloatArray(3) { 0.5f },
                magnetometer = FloatArray(3) { 0.1f },
                temperature = 25f
            ),
            tofData = ToFData(
                distances = FloatArray(32) { 100f },
                gain = 8,
                ambientLight = 100
            ),
            status = SENSOR_STATUS.ACTIVE
        )
    }

    private fun generateLargeSensorData(sensorId: String): SensorData {
        return SensorData(
            sensorId = sensorId,
            timestamp = System.currentTimeMillis(),
            imuData = IMUData(
                accelerometer = FloatArray(3) { it.toFloat() },
                gyroscope = FloatArray(3) { it.toFloat() * 2 },
                magnetometer = FloatArray(3) { it.toFloat() * 3 },
                temperature = 25f
            ),
            tofData = ToFData(
                distances = FloatArray(64) { it.toFloat() * 10 },
                gain = 8,
                ambientLight = 100
            ),
            status = SENSOR_STATUS.ACTIVE
        )
    }

    private fun calculateCompressionRatio(raw: SensorData, compressed: SensorData): Float {
        val rawSize = (raw.imuData?.let { 10 * Float.SIZE_BYTES } ?: 0) +
                     (raw.tofData?.let { it.distances.size * Float.SIZE_BYTES + 8 } ?: 0)
        val compressedSize = (compressed.imuData?.let { 10 * Float.SIZE_BYTES } ?: 0) +
                           (compressed.tofData?.let { it.distances.size * Float.SIZE_BYTES + 8 } ?: 0)
        return rawSize.toFloat() / compressedSize
    }
}

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class StartSensorMonitoringUseCaseTest {
    @MockK
    private lateinit var sensorService: SensorService
    
    private lateinit var startSensorMonitoringUseCase: StartSensorMonitoringUseCase
    private lateinit var testDispatcher: TestDispatcher

    @BeforeEach
    fun setup() {
        MockKAnnotations.init(this)
        testDispatcher = StandardTestDispatcher()
        startSensorMonitoringUseCase = StartSensorMonitoringUseCase(sensorService)
    }

    @Test
    fun `test successful sensor monitoring initialization`() = runTest {
        // Arrange
        val sensorId = "test_sensor_4"
        coEvery { sensorService.calibrateSensor(sensorId) } returns true
        coEvery { sensorService.startSensorMonitoring(sensorId) } returns flowOf()

        // Act
        val result = startSensorMonitoringUseCase(sensorId)

        // Assert
        assertTrue(result)
        coVerify(exactly = 1) { sensorService.calibrateSensor(sensorId) }
        coVerify(exactly = 1) { sensorService.startSensorMonitoring(sensorId) }
    }

    @Test
    fun `test sampling rate optimization`() = runTest {
        // Arrange
        val sensorId = "test_sensor_5"
        val samplingRates = mutableListOf<Int>()
        
        coEvery { sensorService.calibrateSensor(sensorId) } returns true
        coEvery { sensorService.startSensorMonitoring(sensorId) } answers {
            flow {
                for (i in 1..10) {
                    val rate = when {
                        i < 4 -> SAMPLING_RATES.IMU_HZ
                        i < 7 -> SAMPLING_RATES.IMU_HZ / 2
                        else -> SAMPLING_RATES.IMU_HZ * 2
                    }
                    samplingRates.add(rate)
                    emit(generateTestData(sensorId, rate))
                }
            }
        }

        // Act
        startSensorMonitoringUseCase(sensorId)
        testDispatcher.scheduler.advanceTimeBy(1000)

        // Assert
        assertTrue(samplingRates.any { it == SAMPLING_RATES.IMU_HZ / 2 },
            "Sampling rate not properly adjusted for low activity")
        assertTrue(samplingRates.any { it == SAMPLING_RATES.IMU_HZ * 2 },
            "Sampling rate not properly adjusted for high activity")
    }

    private fun generateTestData(sensorId: String, samplingRate: Int): SensorData {
        return SensorData(
            sensorId = sensorId,
            timestamp = System.currentTimeMillis(),
            imuData = IMUData(
                accelerometer = FloatArray(3) { 1f },
                gyroscope = FloatArray(3) { 0.5f },
                magnetometer = FloatArray(3) { 0.1f },
                temperature = 25f
            ),
            status = SENSOR_STATUS.ACTIVE
        )
    }
}

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class StopSensorMonitoringUseCaseTest {
    @MockK
    private lateinit var sensorService: SensorService
    
    private lateinit var stopSensorMonitoringUseCase: StopSensorMonitoringUseCase
    private lateinit var testDispatcher: TestDispatcher

    @BeforeEach
    fun setup() {
        MockKAnnotations.init(this)
        testDispatcher = StandardTestDispatcher()
        stopSensorMonitoringUseCase = StopSensorMonitoringUseCase(sensorService)
    }

    @Test
    fun `test successful monitoring termination`() = runTest {
        // Arrange
        val sensorId = "test_sensor_6"
        coEvery { sensorService.stopSensorMonitoring(sensorId) } just runs

        // Act
        stopSensorMonitoringUseCase(sensorId)

        // Assert
        coVerify(exactly = 1) { sensorService.stopSensorMonitoring(sensorId) }
    }

    @Test
    fun `test error handling during monitoring termination`() = runTest {
        // Arrange
        val sensorId = "test_sensor_7"
        coEvery { sensorService.stopSensorMonitoring(sensorId) } throws IllegalStateException("Failed to stop")

        // Act & Assert
        assertThrows<IllegalStateException> {
            stopSensorMonitoringUseCase(sensorId)
        }
    }
}