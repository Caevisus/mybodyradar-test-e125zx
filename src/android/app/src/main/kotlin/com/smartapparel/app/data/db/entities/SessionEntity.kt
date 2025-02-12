package com.smartapparel.app.data.db.entities

import androidx.room.Entity // version: 2.6.0
import androidx.room.PrimaryKey // version: 2.6.0
import androidx.room.ColumnInfo // version: 2.6.0
import androidx.room.TypeConverters // version: 2.6.0
import com.google.gson.Gson // version: 2.10.1
import com.smartapparel.app.domain.models.Session
import java.util.zip.Deflater
import java.util.zip.Inflater

@Entity(
    tableName = "sessions",
    indices = [
        Index(value = ["athlete_id", "start_time"]),
        Index(value = ["is_uploaded"])
    ]
)
@TypeConverters(Gson::class)
data class SessionEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,

    @ColumnInfo(name = "athlete_id")
    val athleteId: String,

    @ColumnInfo(name = "team_id")
    val teamId: String,

    @ColumnInfo(name = "start_time")
    val startTime: Long,

    @ColumnInfo(name = "end_time")
    val endTime: Long,

    @ColumnInfo(name = "activity_type")
    val activityType: String,

    @ColumnInfo(name = "notes")
    val notes: String?,

    @ColumnInfo(name = "metrics_json")
    val metricsJson: String,

    @ColumnInfo(name = "is_uploaded", defaultValue = "0")
    val isUploaded: Boolean = false,

    @ColumnInfo(name = "last_sync_timestamp")
    val lastSyncTimestamp: Long = 0
) {
    companion object {
        private const val COMPRESSION_THRESHOLD = 1024 * 100 // 100KB
        private const val COMPRESSION_BUFFER = 1024 * 8 // 8KB buffer
    }

    init {
        require(id.isNotBlank()) { "Session ID cannot be blank" }
        require(athleteId.isNotBlank()) { "Athlete ID cannot be blank" }
        require(teamId.isNotBlank()) { "Team ID cannot be blank" }
        require(startTime > 0) { "Start time must be positive" }
        require(activityType.isNotBlank()) { "Activity type cannot be blank" }
        
        // Validate timestamps
        val currentTime = System.currentTimeMillis()
        require(startTime <= currentTime) { "Start time cannot be in the future" }
        if (endTime > 0) {
            require(endTime > startTime) { "End time must be after start time" }
            require(endTime <= currentTime) { "End time cannot be in the future" }
        }

        // Validate JSON format
        try {
            Gson().fromJson(metricsJson, Map::class.java)
        } catch (e: Exception) {
            throw IllegalArgumentException("Invalid metrics JSON format")
        }

        // Apply compression if needed
        if (metricsJson.length > COMPRESSION_THRESHOLD) {
            compressMetricsJson()
        }
    }

    /**
     * Converts database entity to domain model with enhanced validation
     */
    fun toDomainModel(): Session {
        val decompressedJson = if (isCompressed(metricsJson)) {
            decompressMetricsJson(metricsJson)
        } else {
            metricsJson
        }

        val metrics = try {
            Gson().fromJson(decompressedJson, SessionMetrics::class.java)
        } catch (e: Exception) {
            throw IllegalStateException("Failed to parse metrics JSON: ${e.message}")
        }

        validateMetrics(metrics)

        return Session(
            id = id,
            athleteId = athleteId,
            startTime = startTime,
            endTime = endTime,
            config = SessionConfig(
                type = activityType,
                dataRetention = 30, // Default retention period
                compressionLevel = if (isCompressed(metricsJson)) 6 else 0
            ),
            metrics = metrics,
            status = if (endTime > 0) "completed" else "active",
            metadata = mutableMapOf(
                "isUploaded" to isUploaded,
                "lastSyncTimestamp" to lastSyncTimestamp,
                "notes" to (notes ?: "")
            )
        )
    }

    private fun validateMetrics(metrics: SessionMetrics) {
        require(metrics.muscleActivity.isNotEmpty()) { "Muscle activity data is missing" }
        require(metrics.forceDistribution.isNotEmpty()) { "Force distribution data is missing" }
        metrics.muscleActivity.values.forEach { values ->
            require(values.all { it in 0f..100f }) { "Invalid muscle activity values" }
        }
        metrics.forceDistribution.values.forEach { values ->
            require(values.all { it >= 0f }) { "Invalid force distribution values" }
        }
    }

    private fun compressMetricsJson() {
        val input = metricsJson.toByteArray(Charsets.UTF_8)
        val output = ByteArray(input.size)
        val deflater = Deflater().apply {
            setInput(input)
            finish()
        }
        
        val compressedLength = deflater.deflate(output)
        deflater.end()
        
        if (compressedLength < input.size) {
            metricsJson = output.copyOf(compressedLength).toString(Charsets.UTF_8)
        }
    }

    private fun decompressMetricsJson(compressed: String): String {
        val input = compressed.toByteArray(Charsets.UTF_8)
        val output = ByteArray(COMPRESSION_BUFFER)
        val inflater = Inflater().apply {
            setInput(input)
        }
        
        val resultLength = inflater.inflate(output)
        inflater.end()
        
        return output.copyOf(resultLength).toString(Charsets.UTF_8)
    }

    private fun isCompressed(data: String): Boolean {
        return try {
            val bytes = data.toByteArray(Charsets.UTF_8)
            bytes.size >= 2 && bytes[0] == 0x1f.toByte() && bytes[1] == 0x8b.toByte()
        } catch (e: Exception) {
            false
        }
    }
}