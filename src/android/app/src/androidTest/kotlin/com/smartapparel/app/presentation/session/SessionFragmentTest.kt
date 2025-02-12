package com.smartapparel.app.presentation.session

import androidx.fragment.app.testing.launchFragmentInContainer
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.matcher.ViewMatchers.*
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.espresso.IdlingRegistry
import androidx.test.espresso.IdlingResource
import com.google.common.truth.Truth.assertThat
import com.smartapparel.app.R
import com.smartapparel.app.domain.models.IMUData
import com.smartapparel.app.domain.models.SensorData
import com.smartapparel.app.domain.models.ToFData
import com.smartapparel.app.utils.SENSOR_STATUS
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import io.mockk.coEvery
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.TestCoroutineDispatcher
import kotlinx.coroutines.test.runBlockingTest
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.TimeUnit

@ExperimentalCoroutinesApi
@HiltAndroidTest
@RunWith(AndroidJUnit4::class)
class SessionFragmentTest {

    @get:Rule
    val hiltRule = HiltAndroidRule(this)

    private val testDispatcher = TestCoroutineDispatcher()
    private lateinit var mockViewModel: SessionViewModel
    private lateinit var scenario: FragmentScenario<SessionFragment>
    private lateinit var dataLoadingIdlingResource: IdlingResource

    @Before
    fun setup() {
        hiltRule.inject()
        
        // Initialize mock ViewModel
        mockViewModel = mockk(relaxed = true)
        
        // Setup StateFlows
        val sessionStateFlow = MutableStateFlow<SessionViewModel.SessionState>(SessionViewModel.SessionState.Idle)
        val sensorMetricsFlow = MutableStateFlow<SensorData?>(null)
        
        coEvery { mockViewModel.sessionState } returns sessionStateFlow
        coEvery { mockViewModel.sensorMetrics } returns sensorMetricsFlow

        // Create and register idling resource
        dataLoadingIdlingResource = DataLoadingIdlingResource()
        IdlingRegistry.getInstance().register(dataLoadingIdlingResource)

        // Launch fragment with test dispatcher
        scenario = launchFragmentInContainer(themeResId = R.style.Theme_SmartApparel) {
            SessionFragment().apply {
                viewLifecycleOwnerLiveData.observeForever { viewLifecycleOwner ->
                    viewLifecycleOwner?.lifecycle?.addObserver(mockViewModel)
                }
            }
        }
    }

    @After
    fun tearDown() {
        IdlingRegistry.getInstance().unregister(dataLoadingIdlingResource)
        testDispatcher.cleanupTestCoroutines()
        scenario.close()
    }

    @Test
    fun testRealTimeDataProcessing() = testDispatcher.runBlockingTest {
        // Arrange
        val sensorData = createMockSensorData()
        val processingStartTime = System.nanoTime()

        // Act
        coEvery { mockViewModel.sensorMetrics } returns flowOf(sensorData)
        onView(withId(R.id.startButton)).perform(click())

        // Assert
        // Verify processing latency is under 100ms
        val processingTime = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - processingStartTime)
        assertThat(processingTime).isLessThan(100)

        // Verify UI updates
        onView(withId(R.id.heatMapView)).check(matches(isDisplayed()))
        onView(withId(R.id.metricsContainer)).check(matches(isDisplayed()))
        
        // Verify sensor status updates
        onView(withId(R.id.sensorStatusView)).check(matches(hasDescendant(
            withText(containsString("Active"))
        )))
    }

    @Test
    fun testSessionLifecycle() = testDispatcher.runBlockingTest {
        // Test session start
        onView(withId(R.id.startButton)).perform(click())
        verify { mockViewModel.startSession(any()) }
        
        // Verify initial state
        onView(withId(R.id.pauseButton)).check(matches(isEnabled()))
        onView(withId(R.id.endButton)).check(matches(isEnabled()))
        
        // Test session pause
        onView(withId(R.id.pauseButton)).perform(click())
        verify { mockViewModel.pauseSession() }
        
        // Verify paused state
        coEvery { mockViewModel.sessionState } returns MutableStateFlow(SessionViewModel.SessionState.Paused)
        onView(withId(R.id.startButton)).check(matches(isEnabled()))
        
        // Test session end
        onView(withId(R.id.endButton)).perform(click())
        verify { mockViewModel.endSession() }
        
        // Verify completed state
        coEvery { mockViewModel.sessionState } returns MutableStateFlow(SessionViewModel.SessionState.Completed)
        onView(withId(R.id.startButton)).check(matches(isEnabled()))
        onView(withId(R.id.pauseButton)).check(matches(not(isEnabled())))
    }

    @Test
    fun testErrorHandling() = testDispatcher.runBlockingTest {
        // Simulate sensor error
        val errorState = SessionViewModel.SessionState.Error("Sensor disconnected")
        coEvery { mockViewModel.sessionState } returns MutableStateFlow(errorState)
        
        // Verify error UI updates
        onView(withId(com.google.android.material.R.id.snackbar_text))
            .check(matches(withText(containsString("Sensor disconnected"))))
        
        // Verify error recovery UI
        onView(withId(R.id.sensorStatusView))
            .check(matches(hasDescendant(withText(containsString("Error")))))
        
        // Test retry functionality
        onView(withText("Retry")).perform(click())
        verify { mockViewModel.startSession(any()) }
    }

    private fun createMockSensorData(): SensorData {
        return SensorData(
            sensorId = "test_sensor",
            timestamp = System.currentTimeMillis(),
            imuData = IMUData(
                accelerometer = FloatArray(3) { 0f },
                gyroscope = FloatArray(3) { 0f },
                magnetometer = FloatArray(3) { 0f },
                temperature = 25f
            ),
            tofData = ToFData(
                distances = FloatArray(10) { 0f },
                gain = 8,
                ambientLight = 100
            ),
            status = SENSOR_STATUS.ACTIVE
        )
    }

    private class DataLoadingIdlingResource : IdlingResource {
        private var callback: IdlingResource.ResourceCallback? = null
        private var isIdle = true

        override fun getName(): String = "Data Loading Idling Resource"

        override fun isIdleNow(): Boolean = isIdle

        override fun registerIdleTransitionCallback(callback: IdlingResource.ResourceCallback) {
            this.callback = callback
        }

        fun setIdleState(isIdle: Boolean) {
            this.isIdle = isIdle
            if (isIdle) {
                callback?.onTransitionToIdle()
            }
        }
    }
}