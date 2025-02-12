package com.smartapparel.app.presentation.session

import javax.inject.Inject
import dagger.hilt.android.lifecycle.HiltViewModel // version: 2.44
import kotlinx.coroutines.flow.MutableStateFlow // version: 1.7.1
import kotlinx.coroutines.flow.StateFlow // version: 1.7.1
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.catch
import com.smartapparel.app.presentation.common.BaseViewModel
import com.smartapparel.app.domain.usecases.SessionUseCases
import com.smartapparel.app.domain.models.Session
import com.smartapparel.app.domain.models.SensorData
import com.smartapparel.app.domain.models.SessionConfig
import com.smartapparel.app.utils.SAMPLING_RATES
import com.smartapparel.app.utils.DATA_CONFIG

/**
 * ViewModel responsible for managing training session state and user interactions
 * with guaranteed <100ms latency for real-time sensor data processing.
 */
@HiltViewModel
class SessionViewModel @Inject constructor(
    private val sessionUseCases: SessionUseCases
) : BaseViewModel() {

    sealed class SessionState {
        object Idle : SessionState()
        object Active : SessionState()
        object Paused : SessionState()
        object Completed : SessionState()
        data class Error(val message: String) : SessionState()
    }

    private val _sessionState = MutableStateFlow<SessionState>(SessionState.Idle)
    val sessionState: StateFlow<SessionState> = _sessionState.asStateFlow()

    private val _sensorMetrics = MutableStateFlow<SensorData?>(null)
    val sensorMetrics: StateFlow<SensorData?> = _sensorMetrics.asStateFlow()

    private var sensorCollectionJob: Job? = null
    private var currentSession: Session? = null

    /**
     * Initiates a new training session with real-time monitoring.
     * Implements <100ms latency requirement for sensor data processing.
     */
    fun startSession(athleteId: String) {
        require(athleteId.isNotBlank()) { "Athlete ID cannot be blank" }
        require(_sessionState.value == SessionState.Idle) { "Session already in progress" }

        launchWithLoading {
            try {
                val sessionConfig = SessionConfig(
                    type = "training",
                    samplingRates = mapOf(
                        "imu" to SAMPLING_RATES.IMU_HZ,
                        "tof" to SAMPLING_RATES.TOF_HZ
                    ),
                    compressionLevel = DATA_CONFIG.COMPRESSION_RATIO.toInt(),
                    dataRetention = 30 // 30 days retention
                )

                sessionUseCases.startNewSession(athleteId, sessionConfig)
                    .catch { e -> 
                        handleError(e, "Failed to start session")
                        _sessionState.value = SessionState.Error(e.message ?: "Unknown error")
                    }
                    .collect { session ->
                        currentSession = session
                        _sessionState.value = SessionState.Active
                        startSensorCollection()
                    }
            } catch (e: Exception) {
                handleError(e, "Failed to start session")
                _sessionState.value = SessionState.Error(e.message ?: "Unknown error")
            }
        }
    }

    /**
     * Ends the current training session and cleans up resources.
     */
    fun endSession() {
        require(_sessionState.value is SessionState.Active || _sessionState.value is SessionState.Paused) {
            "No active session to end"
        }

        launchWithLoading {
            try {
                currentSession?.id?.let { sessionId ->
                    stopSensorCollection()
                    sessionUseCases.endSession(sessionId)
                    _sessionState.value = SessionState.Completed
                    currentSession = null
                }
            } catch (e: Exception) {
                handleError(e, "Failed to end session")
                _sessionState.value = SessionState.Error(e.message ?: "Unknown error")
            }
        }
    }

    /**
     * Temporarily pauses the current training session.
     */
    fun pauseSession() {
        require(_sessionState.value is SessionState.Active) { "Session not active" }

        launchWithLoading {
            try {
                stopSensorCollection()
                _sessionState.value = SessionState.Paused
            } catch (e: Exception) {
                handleError(e, "Failed to pause session")
                _sessionState.value = SessionState.Error(e.message ?: "Unknown error")
            }
        }
    }

    /**
     * Resumes a paused training session.
     */
    fun resumeSession() {
        require(_sessionState.value is SessionState.Paused) { "Session not paused" }

        launchWithLoading {
            try {
                startSensorCollection()
                _sessionState.value = SessionState.Active
            } catch (e: Exception) {
                handleError(e, "Failed to resume session")
                _sessionState.value = SessionState.Error(e.message ?: "Unknown error")
            }
        }
    }

    /**
     * Starts collecting sensor metrics with guaranteed <100ms latency.
     */
    private fun startSensorCollection() {
        sensorCollectionJob?.cancel()
        sensorCollectionJob = viewModelScope.launch {
            try {
                currentSession?.id?.let { sessionId ->
                    sessionUseCases.getSensorMetrics(sessionId)
                        .catch { e -> handleError(e, "Sensor data collection error") }
                        .collect { metrics ->
                            // Verify processing latency
                            val processingTime = System.currentTimeMillis() - metrics.timestamp
                            require(processingTime <= 100) { 
                                "Processing latency exceeded 100ms: $processingTime ms" 
                            }
                            _sensorMetrics.value = metrics
                        }
                }
            } catch (e: Exception) {
                handleError(e, "Failed to collect sensor data")
            }
        }
    }

    private fun stopSensorCollection() {
        sensorCollectionJob?.cancel()
        sensorCollectionJob = null
        _sensorMetrics.value = null
    }

    override fun onCleared() {
        currentSession?.id?.let { sessionId ->
            viewModelScope.launch {
                try {
                    if (_sessionState.value is SessionState.Active) {
                        sessionUseCases.endSession(sessionId)
                    }
                } catch (e: Exception) {
                    handleError(e, "Failed to cleanup session")
                }
            }
        }
        stopSensorCollection()
        super.onCleared()
    }
}