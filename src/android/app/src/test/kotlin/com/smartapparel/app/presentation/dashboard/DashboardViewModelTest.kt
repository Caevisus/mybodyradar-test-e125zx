package com.smartapparel.app.presentation.dashboard

import com.google.common.truth.Truth.assertThat // version: 1.1.3
import com.smartapparel.app.domain.models.IMUData
import com.smartapparel.app.domain.models.SensorData
import com.smartapparel.app.domain.models.ToFData
import com.smartapparel.app.domain.usecases.GetSensorDataUseCase
import com.smartapparel.app.utils.ALERT_SEVERITY
import com.smartapparel.app.utils.ALERT_TYPES
import com.smartapparel.app.utils.SAMPLING_RATES
import com.smartapparel.app.utils.DATA_CONFIG
import com.smartapparel.ml.MLPredictor
import io.mockk.* // version: 1.13.5
import io.mockk.impl.annotations.MockK
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.* // version: 1.7.1
import org.junit.jupiter.api.* // version: 5.9.0
import java.util.concurrent.TimeUnit
import kotlin.math.abs

@ExperimentalCoroutinesApi
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DashboardViewModelTest {

    @MockK
    private lateinit var getSensorDataUseCase: GetSensorDataUseCase

    @MockK
    private lateinit var mlPredictor: MLPredictor

    private lateinit var viewModel: DashboardViewModel
    private lateinit var testDispatcher: TestDispatcher
    private lateinit var testScope: TestScope

    companion object {
        private const val TEST_SENSOR_ID = "test_sensor_001"
        private const val LATENCY_THRESHOLD_MS = 100L
        private const val TARGET_COMPRESSION_RATIO = DATA_CONFIG.COMPRESSION_RATIO
        private const val ALERT_SENSITIVITY = 0.85f
    }

    @BeforeEach
    fun setup() {
        MockKAnnotations.init(this)
        testDispatcher = StandardTestDispatcher()
        testScope = TestScope(testDispatcher)
        Dispatchers.setMain(testDispatcher)

        // Configure mock behavior
        coEvery { getSensorDataUseCase.invoke(any()) } returns flowOf(createTestSensorData())
        every { mlPredictor.detectAnomalies(any()) } returns floatArrayOf(0.9f, 0.3f, 0.8f)

        viewModel = DashboardViewModel(getSensorDataUseCase, mlPredictor)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
        clearAllMocks()
    }

    @Test
    fun `test real-time data processing meets latency requirements`() = testScope.runTest {
        // Arrange
        val processingTimes = mutableListOf<Long>()
        val job = launch {
            viewModel.sensorData.collect { sensorData ->
                val processingTime = System.currentTimeMillis() - (sensorData.firstOrNull()?.timestamp ?: 0)
                processingTimes.add(processingTime)
            }
        }

        // Act
        advanceTimeBy(5000) // Simulate 5 seconds of data collection

        // Assert
        val maxLatency = processingTimes.maxOrNull() ?: 0
        assertThat(maxLatency).isLessThan(LATENCY_THRESHOLD_MS)
        
        val compressionStats = viewModel.compressionStats.value
        assertThat(compressionStats.ratio).isAtLeast(TARGET_COMPRESSION_RATIO)

        job.cancel()
    }

    @Test
    fun `test performance metrics calculation accuracy`() = testScope.runTest {
        // Arrange
        val expectedMetrics = mapOf(
            "peak_force" to 850f,
            "balance_ratio" to 0.48f,
            "movement_symmetry" to 0.95f
        )

        // Act
        val metricsCollected = mutableListOf<Map<String, Float>>()
        val job = launch {
            viewModel.performanceMetrics.collect { metrics ->
                metricsCollected.add(metrics)
            }
        }

        advanceTimeBy(1000) // Allow time for processing

        // Assert
        val latestMetrics = metricsCollected.lastOrNull()
        assertThat(latestMetrics).isNotNull()
        expectedMetrics.forEach { (key, expectedValue) ->
            val actualValue = latestMetrics!![key]
            assertThat(actualValue).isNotNull()
            assertThat(abs(actualValue!! - expectedValue)).isLessThan(0.01f)
        }

        job.cancel()
    }

    @Test
    fun `test ML-based anomaly detection sensitivity`() = testScope.runTest {
        // Arrange
        val anomalyData = createAnomalyTestData()
        coEvery { getSensorDataUseCase.invoke(any()) } returns flowOf(anomalyData)

        // Act
        val alerts = mutableListOf<List<DashboardViewModel.Alert>>()
        val job = launch {
            viewModel.alerts.collect { alertList ->
                alerts.add(alertList)
            }
        }

        advanceTimeBy(1000) // Allow time for processing

        // Assert
        val latestAlerts = alerts.lastOrNull()
        assertThat(latestAlerts).isNotNull()
        assertThat(latestAlerts).isNotEmpty()

        // Verify alert sensitivity
        val criticalAlerts = latestAlerts!!.filter { it.severity == ALERT_SEVERITY.CRITICAL }
        val totalAlerts = latestAlerts.size
        val sensitivity = criticalAlerts.size.toFloat() / totalAlerts
        assertThat(sensitivity).isAtLeast(ALERT_SENSITIVITY)

        job.cancel()
    }

    @Test
    fun `test error handling and recovery`() = testScope.runTest {
        // Arrange
        val error = RuntimeException("Sensor data error")
        coEvery { getSensorDataUseCase.invoke(any()) } throws error

        // Act
        val job = launch {
            viewModel.sensorData.collect()
        }

        advanceTimeBy(1000)

        // Assert
        verify { mlPredictor.detectAnomalies(any()) wasNot Called }
        assertThat(viewModel.sensorData.value).isEmpty()

        // Test recovery
        coEvery { getSensorDataUseCase.invoke(any()) } returns flowOf(createTestSensorData())
        advanceTimeBy(1000)
        assertThat(viewModel.sensorData.value).isNotEmpty()

        job.cancel()
    }

    @Test
    fun `test data compression optimization`() = testScope.runTest {
        // Arrange
        val initialData = createTestSensorData()
        coEvery { getSensorDataUseCase.invoke(any()) } returns flowOf(initialData)

        // Act
        val compressionStats = mutableListOf<DashboardViewModel.CompressionStats>()
        val job = launch {
            viewModel.compressionStats.collect { stats ->
                compressionStats.add(stats)
            }
        }

        advanceTimeBy(5000) // Allow multiple compression cycles

        // Assert
        val latestStats = compressionStats.lastOrNull()
        assertThat(latestStats).isNotNull()
        assertThat(latestStats!!.ratio).isAtLeast(TARGET_COMPRESSION_RATIO)
        assertThat(latestStats.avgLatencyMs).isAtMost(LATENCY_THRESHOLD_MS)

        job.cancel()
    }

    private fun createTestSensorData(): SensorData {
        return SensorData(
            sensorId = TEST_SENSOR_ID,
            timestamp = System.currentTimeMillis(),
            imuData = IMUData(
                accelerometer = floatArrayOf(9.8f, -0.2f, 0.1f),
                gyroscope = floatArrayOf(0.1f, 0.2f, -0.1f),
                magnetometer = floatArrayOf(25f, 30f, 35f),
                temperature = 25.0f
            ),
            tofData = ToFData(
                distances = floatArrayOf(100f, 105f, 98f, 102f),
                gain = 8,
                ambientLight = 500
            )
        )
    }

    private fun createAnomalyTestData(): SensorData {
        return SensorData(
            sensorId = TEST_SENSOR_ID,
            timestamp = System.currentTimeMillis(),
            imuData = IMUData(
                accelerometer = floatArrayOf(19.6f, -5.2f, 3.1f), // High impact
                gyroscope = floatArrayOf(2.1f, 0.2f, -1.9f), // Abnormal rotation
                magnetometer = floatArrayOf(25f, 30f, 35f),
                temperature = 42.0f // High temperature
            ),
            tofData = ToFData(
                distances = floatArrayOf(150f, 85f, 160f, 80f), // High variability
                gain = 16, // Maximum gain
                ambientLight = 1000 // High ambient light
            )
        )
    }
}