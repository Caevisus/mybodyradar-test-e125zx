package com.smartapparel.app.domain.models

import android.os.Parcelable // version: API 29+
import kotlinx.parcelize.Parcelize // version: 1.8.0
import com.google.gson.annotations.SerializedName // version: 2.10.1

/**
 * Data class representing comprehensive real-time biomechanical metrics collected during a training session.
 */
@Parcelize
data class SessionMetrics(
    val muscleActivity: Map<String, FloatArray> = mutableMapOf(),
    val forceDistribution: Map<String, FloatArray> = mutableMapOf(),
    val rangeOfMotion: Map<String, Map<String, FloatArray>> = mutableMapOf(),
    val anomalyScores: Map<String, Float> = mutableMapOf(),
    val timeSeriesData: Map<String, List<Double>> = mutableMapOf(),
    val comparativeMetrics: Map<String, Map<String, Double>> = mutableMapOf()
) : Parcelable {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is SessionMetrics) return false
        return muscleActivity.keys == other.muscleActivity.keys &&
                muscleActivity.all { (key, value) -> other.muscleActivity[key]?.contentEquals(value) == true } &&
                forceDistribution.keys == other.forceDistribution.keys &&
                forceDistribution.all { (key, value) -> other.forceDistribution[key]?.contentEquals(value) == true } &&
                rangeOfMotion == other.rangeOfMotion &&
                anomalyScores == other.anomalyScores &&
                timeSeriesData == other.timeSeriesData &&
                comparativeMetrics == other.comparativeMetrics
    }

    override fun hashCode(): Int {
        var result = muscleActivity.hashCode()
        result = 31 * result + forceDistribution.hashCode()
        result = 31 * result + rangeOfMotion.hashCode()
        result = 31 * result + anomalyScores.hashCode()
        result = 31 * result + timeSeriesData.hashCode()
        result = 31 * result + comparativeMetrics.hashCode()
        return result
    }
}

/**
 * Enhanced configuration class for customizing session parameters and monitoring settings.
 */
@Parcelize
data class SessionConfig(
    val type: String,
    val alertThresholds: Map<String, Double> = mapOf(
        "muscleLoad" to 85.0,
        "impactForce" to 850.0,
        "asymmetryIndex" to 15.0,
        "rangeDeviation" to 20.0
    ),
    val samplingRates: Map<String, Int> = mapOf(
        "imu" to SensorData.IMU_SAMPLING_RATE,
        "tof" to SensorData.TOF_SAMPLING_RATE
    ),
    val dataRetention: Int = 30, // days
    val enabledMetrics: Map<String, Boolean> = mapOf(
        "muscleActivity" to true,
        "forceDistribution" to true,
        "rangeOfMotion" to true,
        "anomalyDetection" to true
    ),
    val processingModes: Map<String, String> = mapOf(
        "muscleActivity" to "realtime",
        "forceDistribution" to "batch",
        "anomalyDetection" to "hybrid"
    ),
    val compressionLevel: Int = 6 // 0-9, higher means more compression
) : Parcelable {
    init {
        require(type.isNotBlank()) { "Session type cannot be blank" }
        require(compressionLevel in 0..9) { "Compression level must be between 0 and 9" }
        require(dataRetention > 0) { "Data retention period must be positive" }
    }
}

/**
 * Primary data class representing a comprehensive training session with enhanced monitoring capabilities.
 */
@Parcelize
data class Session(
    @SerializedName("id")
    val id: String,
    
    @SerializedName("athleteId")
    val athleteId: String,
    
    @SerializedName("startTime")
    val startTime: Long,
    
    @SerializedName("endTime")
    var endTime: Long = 0,
    
    @SerializedName("config")
    val config: SessionConfig,
    
    @SerializedName("metrics")
    var metrics: SessionMetrics = SessionMetrics(),
    
    @SerializedName("sensorData")
    val sensorData: MutableList<SensorData> = mutableListOf(),
    
    @SerializedName("status")
    var status: String = "active",
    
    @SerializedName("metadata")
    val metadata: MutableMap<String, Any> = mutableMapOf(),
    
    @SerializedName("alerts")
    val alerts: MutableList<String> = mutableListOf()
) : Parcelable {
    
    init {
        require(id.isNotBlank()) { "Session ID cannot be blank" }
        require(athleteId.isNotBlank()) { "Athlete ID cannot be blank" }
        require(startTime > 0) { "Start time must be positive" }
        validateSessionState()
    }

    private fun validateSessionState() {
        if (endTime > 0) {
            require(endTime > startTime) { "End time must be after start time" }
        }
    }

    /**
     * Checks if the session is currently active with additional validation.
     */
    fun isActive(): Boolean {
        return status == "active" &&
                endTime == 0L &&
                System.currentTimeMillis() - startTime <= MAX_SESSION_DURATION
    }

    /**
     * Processes and stores new sensor data with enhanced metrics calculation.
     */
    fun addSensorData(data: SensorData) {
        require(isActive()) { "Cannot add data to inactive session" }
        require(data.hasValidData()) { "Invalid sensor data" }

        // Apply sampling rate filtering
        if (shouldProcessSample(data)) {
            sensorData.add(data)
            updateMetrics(data)
            checkAlertThresholds(data)
            metadata["lastUpdate"] = System.currentTimeMillis()
        }
    }

    /**
     * Finalizes session with comprehensive data processing.
     */
    fun endSession() {
        require(isActive()) { "Session is not active" }
        
        endTime = System.currentTimeMillis()
        status = "completed"
        
        // Final metrics calculation
        calculateFinalMetrics()
        
        // Apply data retention policy
        applyDataRetention()
        
        // Update metadata
        metadata["duration"] = endTime - startTime
        metadata["totalSamples"] = sensorData.size
        metadata["alertCount"] = alerts.size
    }

    private fun shouldProcessSample(data: SensorData): Boolean {
        val lastSample = sensorData.lastOrNull()
        if (lastSample == null) return true

        val sampleRate = when {
            data.imuData != null -> config.samplingRates["imu"] ?: SensorData.IMU_SAMPLING_RATE
            data.tofData != null -> config.samplingRates["tof"] ?: SensorData.TOF_SAMPLING_RATE
            else -> return false
        }

        return (data.timestamp - lastSample.timestamp) >= (1000 / sampleRate)
    }

    private fun updateMetrics(data: SensorData) {
        // Update real-time metrics based on new sensor data
        if (config.enabledMetrics["muscleActivity"] == true) {
            updateMuscleActivity(data)
        }
        if (config.enabledMetrics["forceDistribution"] == true) {
            updateForceDistribution(data)
        }
        if (config.enabledMetrics["rangeOfMotion"] == true) {
            updateRangeOfMotion(data)
        }
        if (config.enabledMetrics["anomalyDetection"] == true) {
            updateAnomalyScores(data)
        }
    }

    private fun updateMuscleActivity(data: SensorData) {
        // Implementation for muscle activity tracking
    }

    private fun updateForceDistribution(data: SensorData) {
        // Implementation for force distribution analysis
    }

    private fun updateRangeOfMotion(data: SensorData) {
        // Implementation for range of motion tracking
    }

    private fun updateAnomalyScores(data: SensorData) {
        // Implementation for anomaly detection
    }

    private fun checkAlertThresholds(data: SensorData) {
        // Implementation for alert threshold checking
    }

    private fun calculateFinalMetrics() {
        // Implementation for final metrics calculation
    }

    private fun applyDataRetention() {
        // Implementation for data retention policy
    }

    companion object {
        const val MAX_SESSION_DURATION = 12 * 60 * 60 * 1000L // 12 hours in milliseconds
    }
}