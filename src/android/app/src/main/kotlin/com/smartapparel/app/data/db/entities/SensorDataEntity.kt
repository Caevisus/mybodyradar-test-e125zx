package com.smartapparel.app.data.db.entities

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.ColumnInfo
import androidx.room.TypeConverters
import androidx.room.Index
import com.smartapparel.app.utils.SENSOR_TYPES
import com.smartapparel.app.utils.DATA_CONFIG
import com.smartapparel.app.domain.models.SensorData
import com.smartapparel.app.domain.models.IMUData
import com.smartapparel.app.domain.models.ToFData
import java.security.MessageDigest
import java.util.UUID
import kotlin.math.ceil

/**
 * Room database entity representing compressed sensor data measurements.
 * Implements 10:1 compression ratio for efficient local storage and data integrity validation.
 *
 * @property id Unique identifier for the database record
 * @property sensorId Physical sensor identifier
 * @property timestamp Unix timestamp in milliseconds
 * @property sensorType Type of sensor (IMU/TOF)
 * @property imuData Compressed IMU sensor data (if applicable)
 * @property tofData Compressed ToF sensor data (if applicable)
 * @property batteryLevel Current battery level percentage
 * @property calibrationVersion Sensor calibration version identifier
 * @property sessionId Training session identifier
 * @property checksum SHA-256 hash for data integrity validation
 */
@Entity(
    tableName = "sensor_data",
    indices = [Index(value = ["sensorId", "timestamp"])]
)
@TypeConverters(SensorDataConverters::class)
data class SensorDataEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String = UUID.randomUUID().toString(),

    @ColumnInfo(name = "sensor_id")
    val sensorId: String,

    @ColumnInfo(name = "timestamp")
    val timestamp: Long,

    @ColumnInfo(name = "sensor_type")
    val sensorType: SENSOR_TYPES,

    @ColumnInfo(name = "imu_data", typeAffinity = ColumnInfo.BLOB)
    val imuData: ByteArray?,

    @ColumnInfo(name = "tof_data", typeAffinity = ColumnInfo.BLOB)
    val tofData: ByteArray?,

    @ColumnInfo(name = "battery_level")
    val batteryLevel: Int,

    @ColumnInfo(name = "calibration_version")
    val calibrationVersion: String,

    @ColumnInfo(name = "session_id")
    val sessionId: Long,

    @ColumnInfo(name = "checksum")
    val checksum: String
) {
    init {
        require(sensorId.isNotBlank()) { "Sensor ID cannot be blank" }
        require(timestamp > 0) { "Timestamp must be positive" }
        require(batteryLevel in 0..100) { "Battery level must be between 0 and 100" }
        require(calibrationVersion.isNotBlank()) { "Calibration version cannot be blank" }
        require(sessionId > 0) { "Session ID must be positive" }
        
        // Validate data size against local storage constraints
        val totalSize = (imuData?.size ?: 0) + (tofData?.size ?: 0)
        val maxSize = ceil(DATA_CONFIG.BUFFER_SIZE * DATA_CONFIG.COMPRESSION_RATIO).toInt()
        require(totalSize <= maxSize) { "Compressed data size exceeds storage constraints" }
        
        // Verify checksum matches data
        require(generateChecksum() == checksum) { "Data integrity validation failed" }
    }

    /**
     * Generates SHA-256 checksum for data integrity validation
     */
    private fun generateChecksum(): String {
        val digest = MessageDigest.getInstance("SHA-256")
        digest.update(sensorId.toByteArray())
        digest.update(timestamp.toString().toByteArray())
        digest.update(sensorType.toString().toByteArray())
        imuData?.let { digest.update(it) }
        tofData?.let { digest.update(it) }
        digest.update(batteryLevel.toString().toByteArray())
        digest.update(calibrationVersion.toByteArray())
        digest.update(sessionId.toString().toByteArray())
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    /**
     * Converts database entity to domain model, performing data decompression
     */
    fun toDomainModel(): SensorData {
        // Verify data integrity before conversion
        require(generateChecksum() == checksum) { "Data integrity validation failed" }

        val imuDataConverted = imuData?.let {
            val decompressed = DataCompressor.decompress(it)
            IMUData(
                accelerometer = decompressed.copyOfRange(0, 3),
                gyroscope = decompressed.copyOfRange(3, 6),
                magnetometer = decompressed.copyOfRange(6, 9),
                temperature = decompressed[9]
            )
        }

        val tofDataConverted = tofData?.let {
            val decompressed = DataCompressor.decompress(it)
            ToFData(
                distances = decompressed.copyOfRange(0, decompressed.size - 2),
                gain = decompressed[decompressed.size - 2].toInt(),
                ambientLight = decompressed[decompressed.size - 1].toInt()
            )
        }

        return SensorData(
            sensorId = sensorId,
            timestamp = timestamp,
            imuData = imuDataConverted,
            tofData = tofDataConverted
        )
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as SensorDataEntity

        if (id != other.id) return false
        if (sensorId != other.sensorId) return false
        if (timestamp != other.timestamp) return false
        if (sensorType != other.sensorType) return false
        if (imuData != null) {
            if (other.imuData == null) return false
            if (!imuData.contentEquals(other.imuData)) return false
        } else if (other.imuData != null) return false
        if (tofData != null) {
            if (other.tofData == null) return false
            if (!tofData.contentEquals(other.tofData)) return false
        } else if (other.tofData != null) return false
        if (batteryLevel != other.batteryLevel) return false
        if (calibrationVersion != other.calibrationVersion) return false
        if (sessionId != other.sessionId) return false
        if (checksum != other.checksum) return false

        return true
    }

    override fun hashCode(): Int {
        var result = id.hashCode()
        result = 31 * result + sensorId.hashCode()
        result = 31 * result + timestamp.hashCode()
        result = 31 * result + sensorType.hashCode()
        result = 31 * result + (imuData?.contentHashCode() ?: 0)
        result = 31 * result + (tofData?.contentHashCode() ?: 0)
        result = 31 * result + batteryLevel
        result = 31 * result + calibrationVersion.hashCode()
        result = 31 * result + sessionId.hashCode()
        result = 31 * result + checksum.hashCode()
        return result
    }

    companion object {
        /**
         * Creates a new entity instance from domain model
         */
        fun fromDomainModel(
            sensorData: SensorData,
            batteryLevel: Int,
            calibrationVersion: String,
            sessionId: Long
        ): SensorDataEntity {
            val imuCompressed = sensorData.imuData?.let { imu ->
                val data = FloatArray(10).apply {
                    System.arraycopy(imu.accelerometer, 0, this, 0, 3)
                    System.arraycopy(imu.gyroscope, 0, this, 3, 3)
                    System.arraycopy(imu.magnetometer, 0, this, 6, 3)
                    this[9] = imu.temperature
                }
                DataCompressor.compress(data)
            }

            val tofCompressed = sensorData.tofData?.let { tof ->
                val data = FloatArray(tof.distances.size + 2).apply {
                    System.arraycopy(tof.distances, 0, this, 0, tof.distances.size)
                    this[tof.distances.size] = tof.gain.toFloat()
                    this[tof.distances.size + 1] = tof.ambientLight.toFloat()
                }
                DataCompressor.compress(data)
            }

            val sensorType = when {
                sensorData.imuData != null -> SENSOR_TYPES.IMU
                sensorData.tofData != null -> SENSOR_TYPES.TOF
                else -> throw IllegalArgumentException("Sensor data must contain either IMU or ToF data")
            }

            return SensorDataEntity(
                sensorId = sensorData.sensorId,
                timestamp = sensorData.timestamp,
                sensorType = sensorType,
                imuData = imuCompressed,
                tofData = tofCompressed,
                batteryLevel = batteryLevel,
                calibrationVersion = calibrationVersion,
                sessionId = sessionId,
                checksum = "" // Will be generated in init block
            )
        }
    }
}