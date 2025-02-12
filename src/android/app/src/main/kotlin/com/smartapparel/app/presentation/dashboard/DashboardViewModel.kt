package com.smartapparel.app.presentation.dashboard

import androidx.lifecycle.viewModelScope // version: 2.6.1
import com.smartapparel.app.presentation.common.BaseViewModel
import com.smartapparel.app.domain.models.SensorData
import com.smartapparel.app.utils.Constants.ALERT_SEVERITY
import com.smartapparel.app.utils.Constants.ALERT_THRESHOLDS
import com.smartapparel.app.utils.Constants.DATA_CONFIG
import com.smartapparel.app.utils.Constants.SAMPLING_RATES
import com.smartapparel.app.utils.Logger
import com.smartapparel.ml.MLPredictor // version: 1.0.0
import javax.inject.Inject // version: 1
import kotlinx.coroutines.flow.* // version: 1.7.1
import kotlinx.coroutines.launch
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.abs

private const val TAG = "DashboardViewModel"
private const val PROCESSING_INTERVAL_MS = SAMPLING_RATES.PROCESSING_WINDOW_MS.toLong()
private const val COMPRESSION_UPDATE_INTERVAL_MS = 1000L // 1 second

/**
 * ViewModel responsible for managing dashboard UI state and business logic with enhanced
 * features for real-time data processing, compression optimization, and ML-based alerts.
 */
class DashboardViewModel @Inject constructor(
    private val getSensorDataUseCase: GetSensorDataUseCase,
    private val mlPredictor: MLPredictor
) : BaseViewModel() {

    // Sensor data state management
    private val _sensorData = MutableStateFlow<List<SensorData>>(emptyList())
    val sensorData: StateFlow<List<SensorData>> = _sensorData.asStateFlow()

    // Performance metrics state
    private val _performanceMetrics = MutableStateFlow<Map<String, Float>>(emptyMap())
    val performanceMetrics: StateFlow<Map<String, Float>> = _performanceMetrics.asStateFlow()

    // Alert system state
    private val _alerts = MutableStateFlow<List<Alert>>(emptyList())
    val alerts: StateFlow<List<Alert>> = _alerts.asStateFlow()

    // Compression statistics state
    private val _compressionStats = MutableStateFlow(CompressionStats())
    val compressionStats: StateFlow<CompressionStats> = _compressionStats.asStateFlow()

    // Data collection job reference
    private var dataCollectionJob: Job? = null
    private val lastProcessedTimestamp = AtomicReference<Long>(0)

    init {
        startDataCollection()
    }

    /**
     * Initiates real-time sensor data collection with optimized processing and compression.
     */
    private fun startDataCollection() {
        dataCollectionJob?.cancel()
        dataCollectionJob = launchWithLoading {
            try {
                // Initialize compression monitoring
                var compressionConfig = initializeCompressionConfig()
                var processedDataCount = 0L
                var totalLatency = 0L

                getSensorDataUseCase.execute()
                    .buffer(DATA_CONFIG.BUFFER_SIZE)
                    .collect { sensorData ->
                        val startTime = System.nanoTime()

                        // Process sensor data with compression
                        val compressedData = processSensorData(sensorData, compressionConfig)
                        _sensorData.value = compressedData

                        // Calculate and update performance metrics
                        val metrics = processPerformanceMetrics(compressedData)
                        _performanceMetrics.value = metrics

                        // Check for alerts using ML
                        val alerts = checkAlerts(metrics)
                        _alerts.value = alerts

                        // Update compression statistics
                        val processingTime = (System.nanoTime() - startTime) / 1_000_000 // ms
                        totalLatency += processingTime
                        processedDataCount++

                        if (processedDataCount % 100 == 0L) {
                            val avgLatency = totalLatency / processedDataCount
                            compressionConfig = optimizeCompression(
                                CompressionStats(
                                    ratio = DATA_CONFIG.COMPRESSION_RATIO,
                                    avgLatencyMs = avgLatency,
                                    processedCount = processedDataCount
                                )
                            )
                            _compressionStats.value = compressionConfig.stats
                        }

                        // Ensure processing interval is maintained
                        val remainingTime = PROCESSING_INTERVAL_MS - processingTime
                        if (remainingTime > 0) {
                            delay(remainingTime)
                        }
                    }
            } catch (e: Exception) {
                Logger.logError(TAG, "Error collecting sensor data", e)
                handleError(e, "sensor data collection")
            }
        }
    }

    /**
     * Processes raw sensor data with compression optimization.
     */
    private fun processSensorData(
        data: List<SensorData>,
        config: CompressionConfig
    ): List<SensorData> {
        val currentTime = System.currentTimeMillis()
        return data.filter { sensorData ->
            // Apply time-based filtering based on compression ratio
            val timeDiff = currentTime - lastProcessedTimestamp.get()
            if (timeDiff >= (PROCESSING_INTERVAL_MS / config.stats.ratio)) {
                lastProcessedTimestamp.set(currentTime)
                true
            } else {
                false
            }
        }
    }

    /**
     * Processes sensor data into performance metrics with compression monitoring.
     */
    private fun processPerformanceMetrics(data: List<SensorData>): Map<String, Float> {
        return buildMap {
            data.forEach { sensorData ->
                sensorData.imuData?.let { imu ->
                    // Calculate biomechanical metrics
                    put("peak_force", calculatePeakForce(imu.accelerometer))
                    put("balance_ratio", calculateBalanceRatio(imu.accelerometer))
                    put("movement_symmetry", calculateMovementSymmetry(imu.gyroscope))
                }

                sensorData.tofData?.let { tof ->
                    // Calculate spatial metrics
                    put("stance_width", calculateStanceWidth(tof.distances))
                    put("movement_range", calculateMovementRange(tof.distances))
                }
            }
        }
    }

    /**
     * Analyzes metrics using ML for advanced anomaly detection.
     */
    private fun checkAlerts(metrics: Map<String, Float>): List<Alert> {
        val alerts = mutableListOf<Alert>()

        // Prepare data for ML model
        val mlInput = metrics.values.toFloatArray()
        
        // Get ML predictions
        val anomalyPredictions = mlPredictor.detectAnomalies(mlInput)
        
        // Process predictions and generate alerts
        anomalyPredictions.forEachIndexed { index, probability ->
            if (probability > ALERT_THRESHOLDS.STRAIN_PERCENT / 100f) {
                val metricName = metrics.keys.elementAt(index)
                val severity = calculateAlertSeverity(probability)
                
                alerts.add(
                    Alert(
                        type = determineAlertType(metricName),
                        severity = severity,
                        message = generateAlertMessage(metricName, metrics[metricName], severity),
                        timestamp = System.currentTimeMillis()
                    )
                )
            }
        }

        return alerts.sortedByDescending { it.severity }
    }

    /**
     * Optimizes compression based on performance monitoring.
     */
    private fun optimizeCompression(stats: CompressionStats): CompressionConfig {
        return CompressionConfig(
            ratio = when {
                stats.avgLatencyMs > 100 -> stats.ratio * 1.2f // Increase compression
                stats.avgLatencyMs < 50 -> stats.ratio * 0.9f // Decrease compression
                else -> stats.ratio // Maintain current ratio
            }.coerceIn(1f, DATA_CONFIG.COMPRESSION_RATIO),
            stats = stats
        )
    }

    // Helper functions for metric calculations
    private fun calculatePeakForce(accelerometer: FloatArray): Float =
        accelerometer.maxOf { abs(it) }

    private fun calculateBalanceRatio(accelerometer: FloatArray): Float =
        (accelerometer[0] + accelerometer[1]) / 2f

    private fun calculateMovementSymmetry(gyroscope: FloatArray): Float =
        abs(gyroscope[0] - gyroscope[1]) / (abs(gyroscope[0]) + abs(gyroscope[1]))

    private fun calculateStanceWidth(distances: FloatArray): Float =
        distances.average().toFloat()

    private fun calculateMovementRange(distances: FloatArray): Float =
        distances.maxOrNull()?.minus(distances.minOrNull() ?: 0f) ?: 0f

    private fun calculateAlertSeverity(probability: Float): ALERT_SEVERITY =
        when {
            probability > 0.9f -> ALERT_SEVERITY.CRITICAL
            probability > 0.7f -> ALERT_SEVERITY.HIGH
            probability > 0.5f -> ALERT_SEVERITY.MEDIUM
            else -> ALERT_SEVERITY.LOW
        }

    override fun onCleared() {
        super.onCleared()
        dataCollectionJob?.cancel()
    }

    // Data classes for internal state management
    data class CompressionStats(
        val ratio: Float = DATA_CONFIG.COMPRESSION_RATIO,
        val avgLatencyMs: Long = 0,
        val processedCount: Long = 0
    )

    data class CompressionConfig(
        val ratio: Float,
        val stats: CompressionStats
    )

    data class Alert(
        val type: ALERT_TYPES,
        val severity: ALERT_SEVERITY,
        val message: String,
        val timestamp: Long
    )
}