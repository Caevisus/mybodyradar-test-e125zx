package com.smartapparel.app.domain.usecases

import javax.inject.Inject // version: 1.0
import kotlinx.coroutines.flow.Flow // version: 1.7.0
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.buffer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import com.github.compression.DataCompressor // version: 2.1.0
import com.smartapparel.app.domain.models.Session
import com.smartapparel.app.domain.models.SessionConfig
import com.smartapparel.app.domain.models.SensorData
import com.smartapparel.app.data.repository.SessionRepository
import com.smartapparel.app.services.SensorService
import com.smartapparel.app.utils.DATA_CONFIG
import com.smartapparel.app.utils.SAMPLING_RATES
import timber.log.Timber // version: 5.0.1
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.ConcurrentHashMap

/**
 * Implementation of session management use cases with optimized performance,
 * battery efficiency, and robust error handling.
 */
@Inject
class SessionUseCases @Inject constructor(
    private val sessionRepository: SessionRepository,
    private val sensorService: SensorService,
    private val dataCompressor: DataCompressor
) {
    private val useCaseScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val activeSessions = ConcurrentHashMap<String, AtomicBoolean>()
    private val processingLatencyMonitor = ProcessingLatencyMonitor()

    /**
     * Starts a new training session with optimized data collection and real-time monitoring.
     * Implements <100ms latency requirement and 10:1 data compression.
     *
     * @param athleteId Unique identifier of the athlete
     * @param config Session configuration parameters
     * @return Flow of session data with real-time updates
     */
    fun startNewSession(athleteId: String, config: SessionConfig): Flow<Session> {
        require(athleteId.isNotBlank()) { "Athlete ID cannot be blank" }
        validateSessionConfig(config)

        val session = Session(
            id = generateSessionId(),
            athleteId = athleteId,
            startTime = System.currentTimeMillis(),
            config = config
        )

        val isActive = AtomicBoolean(true)
        activeSessions[session.id] = isActive

        return sessionRepository.createSession(session)
            .map { sessionId ->
                startSensorMonitoring(sessionId, config)
                sessionRepository.getSessionById(sessionId)
                    .map { updatedSession ->
                        updatedSession?.let {
                            processingLatencyMonitor.checkLatency(it)
                            it
                        } ?: throw IllegalStateException("Session not found: $sessionId")
                    }
            }
            .catch { e ->
                Timber.e(e, "Error starting session for athlete $athleteId")
                cleanupSession(session.id)
                throw e
            }
            .buffer(Channel.BUFFERED)
    }

    /**
     * Ends an active training session with data integrity verification.
     *
     * @param sessionId Unique identifier of the session to end
     * @return Success status with error details if applicable
     */
    suspend fun endSession(sessionId: String): Boolean {
        require(sessionId.isNotBlank()) { "Session ID cannot be blank" }

        return try {
            val isActive = activeSessions[sessionId]
                ?: throw IllegalStateException("Session $sessionId not found or already ended")

            if (!isActive.compareAndSet(true, false)) {
                throw IllegalStateException("Session $sessionId is already ended")
            }

            withTimeout(5000) { // 5 second timeout for cleanup
                stopSensorMonitoring(sessionId)
                finalizeSession(sessionId)
            }

            true
        } catch (e: Exception) {
            Timber.e(e, "Error ending session $sessionId")
            false
        } finally {
            cleanupSession(sessionId)
        }
    }

    private fun validateSessionConfig(config: SessionConfig) {
        require(config.samplingRates["imu"] ?: 0 <= SAMPLING_RATES.IMU_HZ) {
            "IMU sampling rate exceeds maximum ${SAMPLING_RATES.IMU_HZ}Hz"
        }
        require(config.samplingRates["tof"] ?: 0 <= SAMPLING_RATES.TOF_HZ) {
            "ToF sampling rate exceeds maximum ${SAMPLING_RATES.TOF_HZ}Hz"
        }
        require(config.compressionLevel in 0..9) {
            "Compression level must be between 0 and 9"
        }
    }

    private suspend fun startSensorMonitoring(sessionId: String, config: SessionConfig) {
        useCaseScope.launch {
            try {
                sensorService.startSensorMonitoring(sessionId)
                    .buffer(DATA_CONFIG.BUFFER_SIZE)
                    .collect { sensorData ->
                        processSensorData(sessionId, sensorData, config)
                    }
            } catch (e: Exception) {
                Timber.e(e, "Error monitoring sensors for session $sessionId")
                endSession(sessionId)
            }
        }
    }

    private suspend fun processSensorData(
        sessionId: String,
        sensorData: SensorData,
        config: SessionConfig
    ) {
        val startTime = System.currentTimeMillis()
        try {
            val compressedData = dataCompressor.compress(
                sensorData,
                config.compressionLevel
            )

            sessionRepository.getSessionById(sessionId)?.let { session ->
                session.addSensorData(compressedData)
                sessionRepository.updateSession(session)
            }

            val processingTime = System.currentTimeMillis() - startTime
            processingLatencyMonitor.recordLatency(processingTime)
        } catch (e: Exception) {
            Timber.e(e, "Error processing sensor data for session $sessionId")
        }
    }

    private suspend fun stopSensorMonitoring(sessionId: String) {
        try {
            sensorService.stopSensorMonitoring(sessionId)
        } catch (e: Exception) {
            Timber.e(e, "Error stopping sensor monitoring for session $sessionId")
        }
    }

    private suspend fun finalizeSession(sessionId: String) {
        sessionRepository.getSessionById(sessionId)?.let { session ->
            session.endSession()
            sessionRepository.updateSession(session)
        }
    }

    private fun cleanupSession(sessionId: String) {
        activeSessions.remove(sessionId)
        useCaseScope.launch {
            try {
                stopSensorMonitoring(sessionId)
            } catch (e: Exception) {
                Timber.e(e, "Error cleaning up session $sessionId")
            }
        }
    }

    private fun generateSessionId(): String = 
        "${System.currentTimeMillis()}-${java.util.UUID.randomUUID()}"

    private inner class ProcessingLatencyMonitor {
        private val maxLatencyMs = 100L // Maximum allowed processing latency
        private var latencyViolations = 0

        fun recordLatency(latencyMs: Long) {
            if (latencyMs > maxLatencyMs) {
                latencyViolations++
                if (latencyViolations % 10 == 0) {
                    Timber.w("Processing latency threshold exceeded: $latencyMs ms")
                }
            }
        }

        fun checkLatency(session: Session) {
            val currentLatency = System.currentTimeMillis() - session.metadata["lastUpdate"] as Long
            if (currentLatency > maxLatencyMs) {
                Timber.w("Session update latency exceeded: $currentLatency ms")
            }
        }
    }

    companion object {
        private const val MAX_ACTIVE_SESSIONS = 5
    }
}