package com.smartapparel.app.presentation.session

import androidx.arch.core.executor.testing.InstantTaskExecutorRule
import com.smartapparel.app.domain.models.Session
import com.smartapparel.app.domain.models.SensorData
import com.smartapparel.app.domain.models.SessionConfig
import com.smartapparel.app.domain.usecases.SessionUseCases
import com.smartapparel.app.utils.SAMPLING_RATES
import com.smartapparel.test.utils.TimingExtensions
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.TestCoroutineDispatcher
import kotlinx.coroutines.test.TestCoroutineScope
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runBlockingTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestRule
import java.util.UUID

@ExperimentalCoroutinesApi
class SessionViewModelTest {

    @get:Rule
    val testInstantTaskExecutorRule: TestRule = InstantTaskExecutorRule()

    private val testDispatcher = TestCoroutineDispatcher()
    private val testScope = TestCoroutineScope(testDispatcher)
    private val sessionUseCases = mockk<SessionUseCases>(relaxed = true)
    private val performanceTimer = TimingExtensions()
    private lateinit var viewModel: SessionViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        viewModel = SessionViewModel(sessionUseCases)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
        testDispatcher.cleanupTestCoroutines()
    }

    @Test
    fun `test session lifecycle - validates complete session flow`() = testScope.runBlockingTest {
        // Given
        val athleteId = UUID.randomUUID().toString()
        val sessionId = UUID.randomUUID().toString()
        val session = createMockSession(sessionId, athleteId)
        
        coEvery { sessionUseCases.startNewSession(any(), any()) } returns flowOf(session)
        
        // When - Start Session
        viewModel.startSession(athleteId)
        
        // Then - Verify Initial State
        assertEquals(SessionViewModel.SessionState.Active, viewModel.sessionState.first())
        assertNotNull(viewModel.sensorMetrics.first())
        
        // When - Pause Session
        viewModel.pauseSession()
        
        // Then - Verify Paused State
        assertEquals(SessionViewModel.SessionState.Paused, viewModel.sessionState.first())
        
        // When - Resume Session
        viewModel.resumeSession()
        
        // Then - Verify Resumed State
        assertEquals(SessionViewModel.SessionState.Active, viewModel.sessionState.first())
        
        // When - End Session
        viewModel.endSession()
        
        // Then - Verify Final State
        assertEquals(SessionViewModel.SessionState.Completed, viewModel.sessionState.first())
        
        // Verify Correct Method Calls
        coVerify(exactly = 1) {
            sessionUseCases.startNewSession(athleteId, any())
            sessionUseCases.endSession(session.id)
        }
    }

    @Test
    fun `test real-time processing - validates latency requirements`() = testScope.runBlockingTest {
        // Given
        val athleteId = UUID.randomUUID().toString()
        val sensorData = createMockSensorData()
        val sensorMetricsFlow = MutableStateFlow(sensorData)
        
        coEvery { 
            sessionUseCases.startNewSession(any(), any()) 
        } returns flowOf(createMockSession(UUID.randomUUID().toString(), athleteId))
        
        coEvery { 
            sessionUseCases.getSensorMetrics(any()) 
        } returns sensorMetricsFlow
        
        // When
        performanceTimer.start()
        viewModel.startSession(athleteId)
        
        // Then
        val processingTime = performanceTimer.stop()
        assertTrue("Processing time exceeded 100ms requirement", processingTime <= 100)
        
        // Verify sensor data processing
        val metrics = viewModel.sensorMetrics.first()
        assertNotNull(metrics)
        
        // Verify sampling rates
        coVerify { 
            sessionUseCases.startNewSession(athleteId, match { config ->
                config.samplingRates["imu"] == SAMPLING_RATES.IMU_HZ &&
                config.samplingRates["tof"] == SAMPLING_RATES.TOF_HZ
            })
        }
    }

    @Test
    fun `test error handling - validates error state transitions`() = testScope.runBlockingTest {
        // Given
        val athleteId = UUID.randomUUID().toString()
        val errorMessage = "Connection lost"
        
        coEvery { 
            sessionUseCases.startNewSession(any(), any()) 
        } throws IllegalStateException(errorMessage)
        
        // When
        viewModel.startSession(athleteId)
        
        // Then
        val state = viewModel.sessionState.first()
        assertTrue(state is SessionViewModel.SessionState.Error)
        assertEquals(errorMessage, (state as SessionViewModel.SessionState.Error).message)
        
        // Verify error handling cleanup
        assertFalse(viewModel.isLoading.first())
        coVerify(exactly = 0) { sessionUseCases.endSession(any()) }
    }

    @Test
    fun `test concurrent operations - validates thread safety`() = testScope.runBlockingTest {
        // Given
        val athleteId = UUID.randomUUID().toString()
        val session = createMockSession(UUID.randomUUID().toString(), athleteId)
        val sensorData = createMockSensorData()
        
        coEvery { 
            sessionUseCases.startNewSession(any(), any()) 
        } returns flowOf(session)
        
        coEvery { 
            sessionUseCases.getSensorMetrics(any()) 
        } returns flowOf(sensorData)
        
        // When - Simulate concurrent operations
        viewModel.startSession(athleteId)
        viewModel.startSession(athleteId) // Should be rejected
        
        // Then
        coVerify(exactly = 1) { sessionUseCases.startNewSession(any(), any()) }
        assertEquals(SessionViewModel.SessionState.Active, viewModel.sessionState.first())
    }

    private fun createMockSession(sessionId: String, athleteId: String) = Session(
        id = sessionId,
        athleteId = athleteId,
        startTime = System.currentTimeMillis(),
        config = SessionConfig(
            type = "training",
            samplingRates = mapOf(
                "imu" to SAMPLING_RATES.IMU_HZ,
                "tof" to SAMPLING_RATES.TOF_HZ
            ),
            compressionLevel = 6
        )
    )

    private fun createMockSensorData() = SensorData(
        sensorId = UUID.randomUUID().toString(),
        timestamp = System.currentTimeMillis()
    )
}