package com.smartapparel.app.data.repository

import com.google.common.truth.Truth.assertThat // version: 1.1.3
import io.mockk.* // version: 1.13.0
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.confirmVerified
import kotlinx.coroutines.ExperimentalCoroutinesApi // version: 1.7.0
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.* // version: 1.7.0
import org.junit.jupiter.api.* // version: 5.9.0
import org.junit.jupiter.api.assertThrows
import com.smartapparel.app.data.db.dao.SensorDataDao
import com.smartapparel.app.data.db.entities.SensorDataEntity
import com.smartapparel.app.domain.models.SensorData
import com.smartapparel.app.domain.models.IMUData
import com.smartapparel.app.domain.models.ToFData
import com.smartapparel.app.utils.DATA_CONFIG
import kotlin.time.Duration.Companion.milliseconds

@ExperimentalCoroutinesApi
class SensorRepositoryTest {
    private lateinit var sensorDataDao: SensorDataDao
    private lateinit var storageManager: StorageManager
    private lateinit var metricsCollector: MetricsCollector
    private lateinit var sensorRepository: SensorRepository
    private val testDispatcher = StandardTestDispatcher()

    @BeforeEach
    fun setup() {
        sensorDataDao = mockk(relaxed = true)
        storageManager = mockk(relaxed = true)
        metricsCollector = mockk(relaxed = true)
        sensorRepository = SensorRepository(sensorDataDao, storageManager, metricsCollector)
        Dispatchers.setMain(testDispatcher)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
        clearAllMocks()
    }

    @Test
    fun `getAllSensorData should retrieve data within performance constraints`() = runTest {
        // Given
        val testData = createTestSensorDataEntities(5)
        coEvery { sensorDataDao.getAllSensorData() } returns flowOf(testData)

        // When
        val startTime = System.nanoTime()
        val result = sensorRepository.getAllSensorData().first()
        val processingTime = (System.nanoTime() - startTime) / 1_000_000 // Convert to ms

        // Then
        assertThat(processingTime).isLessThan(100) // Verify <100ms latency requirement
        assertThat(result).hasSize(5)
        coVerify { metricsCollector.recordProcessingStart() }
        coVerify { metricsCollector.recordProcessingEnd() }
    }

    @Test
    fun `insertSensorDataBatch should enforce storage limit`() = runTest {
        // Given
        val maxStorageBytes = DATA_CONFIG.MAX_LOCAL_STORAGE_MB * 1024 * 1024
        coEvery { sensorDataDao.getTotalDataSize() } returns maxStorageBytes.toLong()
        val testData = createTestSensorData(10)

        // When/Then
        val exception = assertThrows<IllegalStateException> {
            sensorRepository.insertSensorDataBatch(testData)
        }
        assertThat(exception).hasMessageThat().contains("Insufficient storage space")
    }

    @Test
    fun `insertSensorDataBatch should maintain compression ratio`() = runTest {
        // Given
        val testData = createTestSensorData(5)
        coEvery { sensorDataDao.getTotalDataSize() } returns 0L
        
        // When
        val result = sensorRepository.insertSensorDataBatch(testData)

        // Then
        val metrics = sensorRepository.getStorageMetrics()
        assertThat(metrics.compressionRatio).isAtLeast(DATA_CONFIG.COMPRESSION_RATIO)
        assertThat(result).hasSize(5)
    }

    @Test
    fun `getStorageMetrics should report accurate storage status`() = runTest {
        // Given
        val currentSize = 100_000L
        val totalCount = 1000
        coEvery { sensorDataDao.getTotalDataSize() } returns currentSize
        coEvery { sensorDataDao.getSensorDataCount() } returns totalCount

        // When
        val metrics = sensorRepository.getStorageMetrics()

        // Then
        assertThat(metrics.usedBytes).isEqualTo(currentSize)
        assertThat(metrics.recordCount).isEqualTo(totalCount)
        assertThat(metrics.totalBytes).isEqualTo(DATA_CONFIG.MAX_LOCAL_STORAGE_MB * 1024 * 1024L)
    }

    @Test
    fun `data processing should handle concurrent operations`() = runTest {
        // Given
        val testData = createTestSensorData(20)
        coEvery { sensorDataDao.getTotalDataSize() } returns 0L

        // When
        val processingTimes = mutableListOf<Long>()
        repeat(5) {
            val startTime = System.nanoTime()
            sensorRepository.insertSensorDataBatch(testData)
            processingTimes.add((System.nanoTime() - startTime) / 1_000_000)
        }

        // Then
        processingTimes.forEach { time ->
            assertThat(time).isLessThan(100) // Verify consistent <100ms latency
        }
    }

    private fun createTestSensorDataEntities(count: Int): List<SensorDataEntity> {
        return List(count) { index ->
            SensorDataEntity(
                sensorId = "sensor_$index",
                timestamp = System.currentTimeMillis(),
                sensorType = if (index % 2 == 0) SENSOR_TYPES.IMU else SENSOR_TYPES.TOF,
                imuData = if (index % 2 == 0) ByteArray(100) else null,
                tofData = if (index % 2 == 1) ByteArray(100) else null,
                batteryLevel = 100,
                calibrationVersion = "1.0.0",
                sessionId = 1L,
                checksum = "test_checksum"
            )
        }
    }

    private fun createTestSensorData(count: Int): List<SensorData> {
        return List(count) { index ->
            SensorData(
                sensorId = "sensor_$index",
                timestamp = System.currentTimeMillis(),
                imuData = IMUData(
                    accelerometer = FloatArray(3) { 1f },
                    gyroscope = FloatArray(3) { 1f },
                    magnetometer = FloatArray(3) { 1f },
                    temperature = 25f
                ),
                tofData = ToFData(
                    distances = FloatArray(32) { 100f },
                    gain = 8,
                    ambientLight = 100
                )
            )
        }
    }
}