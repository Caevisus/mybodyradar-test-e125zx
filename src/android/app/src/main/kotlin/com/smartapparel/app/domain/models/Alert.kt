package com.smartapparel.app.domain.models

import android.os.Parcelable // version: API 29+
import kotlinx.parcelize.Parcelize // version: 1.8.0
import com.smartapparel.app.utils.Constants.ALERT_TYPES
import com.smartapparel.app.utils.Constants.ALERT_SEVERITY

/**
 * Data class containing comprehensive information about an alert including sensor readings and threshold data.
 * Implements Parcelable for efficient data transfer between components.
 */
@Parcelize
data class AlertDetails(
    val threshold: Double,
    val currentValue: Double,
    val location: String,
    val sensorData: Map<String, Double>,
    val detectionTime: Long,
    val historicalReadings: Map<String, Double>,
    val confidenceScore: Double
) : Parcelable {
    
    /**
     * Checks if the current value exceeds the defined threshold.
     * @return Boolean indicating if threshold is exceeded
     */
    fun exceedsThreshold(): Boolean = currentValue > threshold
}

/**
 * Domain model class representing a comprehensive alert in the smart apparel system.
 * Supports real-time monitoring and medical analysis with extensive metadata tracking.
 * Implements Parcelable for efficient data transfer and process death survival.
 */
@Parcelize
data class Alert(
    val id: String,
    val type: ALERT_TYPES,
    val severity: ALERT_SEVERITY,
    val status: String,
    val timestamp: Long,
    val sessionId: String,
    val athleteId: String,
    val message: String,
    val details: AlertDetails,
    val acknowledged: Boolean,
    val acknowledgedBy: String?,
    val acknowledgedAt: Long?,
    val notifiedUsers: List<String>
) : Parcelable {

    companion object {
        const val STATUS_ACTIVE = "ACTIVE"
        const val STATUS_RESOLVED = "RESOLVED"
        const val STATUS_DISMISSED = "DISMISSED"
    }

    /**
     * Checks if the alert is currently active.
     * @return Boolean indicating if alert status is active
     */
    fun isActive(): Boolean = status == STATUS_ACTIVE

    /**
     * Checks if the alert is of critical severity.
     * @return Boolean indicating if alert severity is CRITICAL
     */
    fun isCritical(): Boolean = severity == ALERT_SEVERITY.CRITICAL

    /**
     * Determines if alert requires immediate attention based on status and severity.
     * Used for prioritizing alerts in the monitoring system.
     * @return Boolean indicating if immediate attention is required
     */
    fun requiresImmediate(): Boolean = isActive() && isCritical()
}