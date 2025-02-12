package com.smartapparel.app.data.db.entities

import androidx.room.Entity // version: 2.6.0
import androidx.room.PrimaryKey // version: 2.6.0
import androidx.room.ColumnInfo // version: 2.6.0
import androidx.room.TypeConverters // version: 2.6.0
import androidx.room.Index // version: 2.6.0
import com.smartapparel.app.domain.models.Alert
import com.smartapparel.app.domain.models.AlertDetails
import com.smartapparel.app.utils.Constants.ALERT_TYPES
import com.smartapparel.app.utils.Constants.ALERT_SEVERITY
import org.json.JSONObject

/**
 * Room database entity representing an alert in the smart apparel system.
 * Supports 5-year data retention with efficient querying through indexed fields.
 * Includes comprehensive alert metadata and sensor readings.
 */
@Entity(
    tableName = "alerts",
    indices = [
        Index(value = ["timestamp", "athleteId"]),
        Index(value = ["sessionId"]),
        Index(value = ["type", "severity"])
    ]
)
@TypeConverters(AlertTypeConverter::class)
data class AlertEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,

    @ColumnInfo(name = "type")
    val type: ALERT_TYPES,

    @ColumnInfo(name = "severity")
    val severity: ALERT_SEVERITY,

    @ColumnInfo(name = "status")
    val status: String,

    @ColumnInfo(name = "timestamp")
    val timestamp: Long,

    @ColumnInfo(name = "session_id")
    val sessionId: String,

    @ColumnInfo(name = "athlete_id")
    val athleteId: String,

    @ColumnInfo(name = "message")
    val message: String,

    @ColumnInfo(name = "details")
    val details: String, // JSON string of AlertDetails

    @ColumnInfo(name = "acknowledged")
    val acknowledged: Boolean = false,

    @ColumnInfo(name = "acknowledged_by")
    val acknowledgedBy: String? = null,

    @ColumnInfo(name = "acknowledged_at")
    val acknowledgedAt: Long? = null,

    @ColumnInfo(name = "notified_users")
    val notifiedUsers: String = "[]" // JSON array of user IDs
) {
    /**
     * Validates that the timestamp is within the 5-year retention period
     */
    init {
        require(timestamp > 0) { "Timestamp must be positive" }
        val fiveYearsMs = 5L * 365 * 24 * 60 * 60 * 1000
        require(System.currentTimeMillis() - timestamp <= fiveYearsMs) {
            "Alert timestamp exceeds 5-year retention period"
        }
        require(details.isNotBlank()) { "Details cannot be empty" }
        try {
            JSONObject(details) // Validate JSON format
        } catch (e: Exception) {
            throw IllegalArgumentException("Details must be valid JSON", e)
        }
    }

    /**
     * Converts the database entity to a domain model instance.
     * Includes parsing of JSON strings into proper object structures.
     * @return Alert domain model with all properties mapped
     */
    fun toDomainModel(): Alert {
        val detailsJson = JSONObject(details)
        val alertDetails = AlertDetails(
            threshold = detailsJson.getDouble("threshold"),
            currentValue = detailsJson.getDouble("currentValue"),
            location = detailsJson.getString("location"),
            sensorData = detailsJson.getJSONObject("sensorData").toMap(),
            detectionTime = detailsJson.getLong("detectionTime"),
            historicalReadings = detailsJson.getJSONObject("historicalReadings").toMap(),
            confidenceScore = detailsJson.getDouble("confidenceScore")
        )

        val notifiedUsersList = JSONObject(notifiedUsers).getJSONArray("users")
            .let { array ->
                List(array.length()) { array.getString(it) }
            }

        return Alert(
            id = id,
            type = type,
            severity = severity,
            status = status,
            timestamp = timestamp,
            sessionId = sessionId,
            athleteId = athleteId,
            message = message,
            details = alertDetails,
            acknowledged = acknowledged,
            acknowledgedBy = acknowledgedBy,
            acknowledgedAt = acknowledgedAt,
            notifiedUsers = notifiedUsersList
        )
    }

    companion object {
        /**
         * Creates an AlertEntity from a domain model instance.
         * Handles conversion of complex objects to JSON strings for storage.
         */
        fun fromDomainModel(alert: Alert): AlertEntity {
            val detailsJson = JSONObject().apply {
                put("threshold", alert.details.threshold)
                put("currentValue", alert.details.currentValue)
                put("location", alert.details.location)
                put("sensorData", JSONObject(alert.details.sensorData))
                put("detectionTime", alert.details.detectionTime)
                put("historicalReadings", JSONObject(alert.details.historicalReadings))
                put("confidenceScore", alert.details.confidenceScore)
            }

            val notifiedUsersJson = JSONObject().apply {
                put("users", alert.notifiedUsers)
            }

            return AlertEntity(
                id = alert.id,
                type = alert.type,
                severity = alert.severity,
                status = alert.status,
                timestamp = alert.timestamp,
                sessionId = alert.sessionId,
                athleteId = alert.athleteId,
                message = alert.message,
                details = detailsJson.toString(),
                acknowledged = alert.acknowledged,
                acknowledgedBy = alert.acknowledgedBy,
                acknowledgedAt = alert.acknowledgedAt,
                notifiedUsers = notifiedUsersJson.toString()
            )
        }
    }
}

/**
 * Room type converter for handling custom enum types in the database.
 */
class AlertTypeConverter {
    @androidx.room.TypeConverter
    fun fromAlertType(type: ALERT_TYPES): String = type.javaClass.simpleName

    @androidx.room.TypeConverter
    fun toAlertType(value: String): ALERT_TYPES = when (value) {
        "BIOMECHANICAL" -> ALERT_TYPES.BIOMECHANICAL
        "PHYSIOLOGICAL" -> ALERT_TYPES.PHYSIOLOGICAL
        "PERFORMANCE" -> ALERT_TYPES.PERFORMANCE
        "SYSTEM" -> ALERT_TYPES.SYSTEM
        else -> throw IllegalArgumentException("Unknown alert type: $value")
    }

    @androidx.room.TypeConverter
    fun fromAlertSeverity(severity: ALERT_SEVERITY): String = severity.javaClass.simpleName

    @androidx.room.TypeConverter
    fun toAlertSeverity(value: String): ALERT_SEVERITY = when (value) {
        "LOW" -> ALERT_SEVERITY.LOW
        "MEDIUM" -> ALERT_SEVERITY.MEDIUM
        "HIGH" -> ALERT_SEVERITY.HIGH
        "CRITICAL" -> ALERT_SEVERITY.CRITICAL
        else -> throw IllegalArgumentException("Unknown severity level: $value")
    }
}

/**
 * Extension function to convert JSONObject to Map<String, Double>
 */
private fun JSONObject.toMap(): Map<String, Double> {
    val map = mutableMapOf<String, Double>()
    this.keys().forEach { key ->
        map[key] = this.getDouble(key)
    }
    return map
}