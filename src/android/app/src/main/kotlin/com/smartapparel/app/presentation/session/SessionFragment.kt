package com.smartapparel.app.presentation.session

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import com.google.android.material.snackbar.Snackbar
import com.smartapparel.app.R
import com.smartapparel.app.databinding.FragmentSessionBinding
import com.smartapparel.app.presentation.common.BaseFragment
import com.smartapparel.app.domain.models.SensorData
import com.smartapparel.app.utils.SENSOR_STATUS
import com.smartapparel.app.utils.BatteryOptimizer
import com.smartapparel.app.utils.MemoryManager
import timber.log.Timber

/**
 * Fragment responsible for managing and displaying the active training session interface.
 * Implements Material Design 3.0 with optimized performance and enhanced accessibility.
 */
@AndroidEntryPoint
class SessionFragment : BaseFragment<FragmentSessionBinding, SessionViewModel>() {

    override val viewModel: SessionViewModel by viewModels()
    
    @Inject
    lateinit var batteryOptimizer: BatteryOptimizer
    
    @Inject
    lateinit var memoryManager: MemoryManager

    private var _binding: FragmentSessionBinding? = null
    private val binding get() = _binding!!

    private lateinit var sensorStatusView: SensorStatusView
    private var isSessionActive = false
    private var lastMetricsUpdate = 0L

    override fun createViewBinding(
        inflater: LayoutInflater,
        container: ViewGroup?
    ): FragmentSessionBinding {
        return FragmentSessionBinding.inflate(inflater, container, false)
    }

    override fun setupUI() {
        setupSensorStatus()
        setupSessionControls()
        setupHeatMapView()
        setupMetricsDisplay()
        setupAccessibility()
    }

    private fun setupSensorStatus() {
        sensorStatusView = binding.sensorStatusView.apply {
            setOnCalibrationRequestListener {
                viewModel.calibrateSensors()
            }
        }
    }

    private fun setupSessionControls() {
        with(binding) {
            startButton.apply {
                setOnClickListener {
                    if (!isSessionActive) {
                        startSession()
                    }
                }
                contentDescription = getString(R.string.start_session_description)
            }

            pauseButton.apply {
                setOnClickListener {
                    if (isSessionActive) {
                        viewModel.pauseSession()
                    }
                }
                contentDescription = getString(R.string.pause_session_description)
            }

            endButton.apply {
                setOnClickListener {
                    if (isSessionActive) {
                        endSession()
                    }
                }
                contentDescription = getString(R.string.end_session_description)
            }
        }
    }

    private fun setupHeatMapView() {
        with(binding.heatMapView) {
            // Configure heat map with memory optimization
            memoryManager.optimizeViewMemory(this)
            setMaxFrameRate(60) // Limit frame rate for battery optimization
            enableHardwareAcceleration()
            
            // Set up heat map gesture listeners
            setOnHeatMapInteractionListener { x, y, value ->
                announceForAccessibility(
                    getString(R.string.heat_map_value_announcement, value)
                )
            }
        }
    }

    private fun setupMetricsDisplay() {
        with(binding.metricsContainer) {
            // Initialize performance metrics views with efficient updates
            setupPerformanceMetrics()
            setupBiomechanicalMetrics()
            setupAnomalyDetection()
        }
    }

    private fun setupAccessibility() {
        with(binding) {
            root.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
            
            // Set up live regions for real-time updates
            metricsContainer.accessibilityLiveRegion = 
                View.ACCESSIBILITY_LIVE_REGION_POLITE
            
            // Configure content descriptions
            heatMapView.contentDescription = 
                getString(R.string.heat_map_description)
        }
    }

    override fun setupObservers() {
        viewLifecycleOwner.lifecycleScope.launch {
            // Observe session state with error handling
            viewModel.sessionState.collectLatest { state ->
                handleSessionState(state)
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            // Observe sensor metrics with performance optimization
            viewModel.sensorMetrics.collectLatest { metrics ->
                if (shouldUpdateMetrics()) {
                    updateMetricsDisplay(metrics)
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            // Monitor battery status
            viewModel.batteryStatus.collectLatest { status ->
                handleBatteryStatus(status)
            }
        }
    }

    private fun handleSessionState(state: SessionViewModel.SessionState) {
        when (state) {
            is SessionViewModel.SessionState.Active -> {
                isSessionActive = true
                updateUIForActiveSession()
            }
            is SessionViewModel.SessionState.Paused -> {
                isSessionActive = true
                updateUIForPausedSession()
            }
            is SessionViewModel.SessionState.Completed -> {
                isSessionActive = false
                updateUIForCompletedSession()
            }
            is SessionViewModel.SessionState.Error -> {
                handleSessionError(state.message)
            }
            else -> {
                isSessionActive = false
                resetUIState()
            }
        }
    }

    private fun updateMetricsDisplay(metrics: SensorData?) {
        metrics?.let {
            // Verify processing latency
            val processingTime = System.currentTimeMillis() - it.timestamp
            require(processingTime <= 100) { 
                "Metrics processing exceeded 100ms latency: $processingTime ms" 
            }

            with(binding) {
                // Update heat map with memory-efficient rendering
                heatMapView.updateData(it.getHeatMapData())

                // Update performance metrics with batched updates
                metricsContainer.updateMetrics(it)

                // Update sensor status
                sensorStatusView.updateStatus(it)
            }

            lastMetricsUpdate = System.currentTimeMillis()
        }
    }

    private fun shouldUpdateMetrics(): Boolean {
        val currentTime = System.currentTimeMillis()
        return currentTime - lastMetricsUpdate >= 100 // Ensure max 10 updates per second
    }

    private fun startSession() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                // Optimize battery usage for session
                batteryOptimizer.optimizeForActiveSession()
                
                // Start session with current athlete ID
                viewModel.startSession(getCurrentAthleteId())
                
                // Update UI state
                updateUIForActiveSession()
            } catch (e: Exception) {
                Timber.e(e, "Failed to start session")
                handleSessionError(e.message ?: "Unknown error")
            }
        }
    }

    private fun endSession() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                viewModel.endSession()
                resetUIState()
                batteryOptimizer.restoreDefaultSettings()
            } catch (e: Exception) {
                Timber.e(e, "Failed to end session")
                handleSessionError(e.message ?: "Unknown error")
            }
        }
    }

    private fun handleSessionError(message: String) {
        Snackbar.make(
            binding.root,
            message,
            Snackbar.LENGTH_LONG
        ).apply {
            setAction("Retry") {
                if (isSessionActive) {
                    startSession()
                }
            }
            show()
        }
    }

    private fun handleBatteryStatus(batteryStatus: Int) {
        if (batteryStatus < 15 && isSessionActive) {
            Snackbar.make(
                binding.root,
                getString(R.string.low_battery_warning),
                Snackbar.LENGTH_LONG
            ).show()
        }
    }

    private fun getCurrentAthleteId(): String {
        // Implementation would come from authentication/session management
        return "current_athlete_id"
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
        batteryOptimizer.restoreDefaultSettings()
        memoryManager.clearViewMemory(binding.heatMapView)
    }

    companion object {
        private const val TAG = "SessionFragment"
    }
}