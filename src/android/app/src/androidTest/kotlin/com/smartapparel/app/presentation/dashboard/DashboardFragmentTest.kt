package com.smartapparel.app.presentation.dashboard

import androidx.fragment.app.testing.FragmentScenario // version: 1.6.1
import androidx.fragment.app.testing.launchFragmentInContainer
import androidx.test.espresso.Espresso.onView // version: 3.5.1
import androidx.test.espresso.IdlingRegistry
import androidx.test.espresso.IdlingResource
import androidx.test.espresso.action.ViewActions.*
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.matcher.ViewMatchers.*
import androidx.test.ext.junit.runners.AndroidJUnit4 // version: 1.1.5
import androidx.test.filters.LargeTest
import com.smartapparel.app.R
import com.smartapparel.app.domain.models.IMUData
import com.smartapparel.app.domain.models.SensorData
import com.smartapparel.app.domain.models.ToFData
import com.smartapparel.app.utils.Constants.ALERT_SEVERITY
import com.smartapparel.app.utils.Constants.ALERT_TYPES
import com.smartapparel.app.utils.Constants.SAMPLING_RATES
import kotlinx.coroutines.flow.MutableStateFlow // version: 1.7.1
import kotlinx.coroutines.test.TestCoroutineDispatcher // version: 1.7.1
import kotlinx.coroutines.test.runBlockingTest
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.kotlin.mock // version: 5.1.0
import org.mockito.kotlin.whenever
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.math.abs

@RunWith(AndroidJUnit4::class)
@LargeTest
class DashboardFragmentTest {

    private lateinit var scenario: FragmentScenario<DashboardFragment>
    private lateinit var mockViewModel: DashboardViewModel
    private val testDispatcher = TestCoroutineDispatcher()
    private lateinit var dataLoadingIdlingResource: IdlingResource

    // Test data flows
    private val sensorDataFlow = MutableStateFlow<List<SensorData>>(emptyList())
    private val metricsFlow = MutableStateFlow<Map<String, Float>>(emptyMap())
    private val alertsFlow = MutableStateFlow<List<DashboardViewModel.Alert>>(emptyList())

    @Before
    fun setup() {
        // Initialize mock ViewModel
        mockViewModel = mock()
        whenever(mockViewModel.sensorData).thenReturn(sensorDataFlow)
        whenever(mockViewModel.performanceMetrics).thenReturn(metricsFlow)
        whenever(mockViewModel.alerts).thenReturn(alertsFlow)

        // Create and register idling resource
        dataLoadingIdlingResource = object : IdlingResource {
            private var callback: IdlingResource.ResourceCallback? = null
            private var isIdle = true

            override fun getName(): String = "DataLoadingIdlingResource"
            override fun isIdleNow(): Boolean = isIdle
            override fun registerIdleTransitionCallback(callback: IdlingResource.ResourceCallback) {
                this.callback = callback
            }

            fun setIdleState(isIdle: Boolean) {
                this.isIdle = isIdle
                if (isIdle) callback?.onTransitionToIdle()
            }
        }
        IdlingRegistry.getInstance().register(dataLoadingIdlingResource)

        // Launch fragment with mock ViewModel
        scenario = launchFragmentInContainer(themeResId = R.style.Theme_SmartApparel) {
            DashboardFragment.newInstance().apply {
                viewModel = mockViewModel
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
    fun testHeatMapDisplay() = testDispatcher.runBlockingTest {
        // Create test sensor data
        val testIMUData = IMUData(
            accelerometer = floatArrayOf(1.0f, 2.0f, 3.0f),
            gyroscope = floatArrayOf(0.1f, 0.2f, 0.3f),
            magnetometer = floatArrayOf(10f, 20f, 30f),
            temperature = 25.0f
        )

        val testToFData = ToFData(
            distances = FloatArray(32 * 32) { 500f },
            gain = 8,
            ambientLight = 100
        )

        val testSensorData = SensorData(
            sensorId = "test_sensor",
            imuData = testIMUData,
            tofData = testToFData
        )

        // Verify heat map update latency
        val updateLatch = CountDownLatch(1)
        val startTime = System.nanoTime()

        scenario.onFragment { fragment ->
            fragment.view?.post {
                sensorDataFlow.value = listOf(testSensorData)
                updateLatch.countDown()
            }
        }

        // Wait for update with timeout
        updateLatch.await(1, TimeUnit.SECONDS)
        val updateLatency = (System.nanoTime() - startTime) / 1_000_000 // Convert to ms

        // Verify update latency is within requirements (<100ms)
        assert(updateLatency < 100) { "Heat map update latency exceeded 100ms: $updateLatency ms" }

        // Test heat map visualization modes
        onView(withId(R.id.visualizationModeSwitch))
            .check(matches(isDisplayed()))
            .perform(click())

        // Verify 3D mode transition
        onView(withId(R.id.heatMapView))
            .check(matches(isDisplayed()))
            .perform(swipeRight()) // Test gesture handling
            .perform(pinchIn()) // Test zoom functionality
    }

    @Test
    fun testPerformanceMetricsDisplay() = testDispatcher.runBlockingTest {
        // Prepare test metrics
        val testMetrics = mapOf(
            "peak_force" to 850.0f,
            "balance_ratio" to 0.48f,
            "movement_symmetry" to 0.95f,
            "movement_range" to 0.75f
        )

        // Update metrics
        metricsFlow.value = testMetrics

        // Verify metrics display
        testMetrics.forEach { (metric, value) ->
            val metricCardId = when (metric) {
                "peak_force" -> R.id.forceMetricCard
                "balance_ratio" -> R.id.balanceMetricCard
                "movement_symmetry" -> R.id.symmetryMetricCard
                "movement_range" -> R.id.rangeMetricCard
                else -> null
            }

            metricCardId?.let { id ->
                onView(withId(id))
                    .check(matches(isDisplayed()))
                    .check(matches(hasDescendant(withText(containsString(value.toString())))))
            }
        }

        // Test metric card interactions
        onView(withId(R.id.forceMetricCard))
            .perform(click())
            .check(matches(isDisplayed()))
    }

    @Test
    fun testAlertNotifications() = testDispatcher.runBlockingTest {
        // Create test alerts
        val testAlerts = listOf(
            DashboardViewModel.Alert(
                type = ALERT_TYPES.BIOMECHANICAL,
                severity = ALERT_SEVERITY.CRITICAL,
                message = "Critical force threshold exceeded",
                timestamp = System.currentTimeMillis()
            ),
            DashboardViewModel.Alert(
                type = ALERT_TYPES.PHYSIOLOGICAL,
                severity = ALERT_SEVERITY.HIGH,
                message = "High asymmetry detected",
                timestamp = System.currentTimeMillis()
            )
        )

        // Update alerts
        alertsFlow.value = testAlerts

        // Verify alert display
        onView(withId(R.id.alertsRecyclerView))
            .check(matches(isDisplayed()))

        // Verify critical alert is displayed first
        onView(withText(containsString("Critical force threshold")))
            .check(matches(isDisplayed()))

        // Test alert interaction
        onView(withText(containsString("Critical force threshold")))
            .perform(click())

        // Verify alert dialog
        onView(withText(containsString("Alert Details")))
            .check(matches(isDisplayed()))
    }
}