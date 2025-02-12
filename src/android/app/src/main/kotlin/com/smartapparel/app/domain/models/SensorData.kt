package com.smartapparel.app.domain.models

import android.os.Parcelable // version: API 29+
import kotlinx.parcelize.Parcelize // version: 1.8.0
import com.smartapparel.app.utils.SENSOR_STATUS
import com.smartapparel.app.utils.SENSOR_TYPES
import com.smartapparel.app.utils.SAMPLING_RATES

/**
 * Data class representing IMU sensor readings sampled at 200Hz.
 * Implements Parcelable for efficient data transfer between Android components.
 *
 * @property accelerometer 3-axis accelerometer readings [x, y, z] in m/s²
 * @property gyroscope 3-axis gyroscope readings [x, y, z] in rad/s
 * @property magnetometer 3-axis magnetometer readings [x, y, z] in μT
 * @property temperature IMU temperature reading in °C
 */
@Parcelize
data class IMUData(
    val accelerometer: FloatArray,
    val gyroscope: FloatArray,
    val magnetometer: FloatArray,
    val temperature: Float
) : Parcelable {
    init {
        require(accelerometer.size == 3) { "Accelerometer data must have 3 axes" }
        require(gyroscope.size == 3) { "Gyroscope data must have 3 axes" }
        require(magnetometer.size == 3) { "Magnetometer data must have 3 axes" }
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is IMUData) return false
        return accelerometer.contentEquals(other.accelerometer) &&
                gyroscope.contentEquals(other.gyroscope) &&
                magnetometer.contentEquals(other.magnetometer) &&
                temperature == other.temperature
    }

    override fun hashCode(): Int {
        var result = accelerometer.contentHashCode()
        result = 31 * result + gyroscope.contentHashCode()
        result = 31 * result + magnetometer.contentHashCode()
        result = 31 * result + temperature.hashCode()
        return result
    }
}

/**
 * Data class representing Time-of-Flight sensor readings sampled at 100Hz.
 * Implements Parcelable for efficient data transfer between Android components.
 *
 * @property distances Array of distance measurements in millimeters
 * @property gain Current sensor gain setting (1-16)
 * @property ambientLight Ambient light level reading
 */
@Parcelize
data class ToFData(
    val distances: FloatArray,
    val gain: Int,
    val ambientLight: Int
) : Parcelable {
    init {
        require(distances.isNotEmpty()) { "Distances array cannot be empty" }
        require(gain in 1..16) { "Gain must be between 1 and 16" }
        require(ambientLight >= 0) { "Ambient light must be non-negative" }
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ToFData) return false
        return distances.contentEquals(other.distances) &&
                gain == other.gain &&
                ambientLight == other.ambientLight
    }

    override fun hashCode(): Int {
        var result = distances.contentHashCode()
        result = 31 * result + gain
        result = 31 * result + ambientLight
        return result
    }
}

/**
 * Primary data class representing combined sensor data readings with status information.
 * Implements Parcelable for efficient data transfer between Android components.
 *
 * @property sensorId Unique identifier for the sensor
 * @property timestamp Unix timestamp in milliseconds when the data was captured
 * @property imuData Optional IMU sensor readings
 * @property tofData Optional ToF sensor readings
 * @property status Current sensor connection status
 */
@Parcelize
data class SensorData(
    val sensorId: String,
    val timestamp: Long = System.currentTimeMillis(),
    val imuData: IMUData? = null,
    val tofData: ToFData? = null,
    val status: SENSOR_STATUS = SENSOR_STATUS.DISCONNECTED
) : Parcelable {
    init {
        require(sensorId.isNotBlank()) { "Sensor ID cannot be blank" }
        require(timestamp > 0) { "Timestamp must be positive" }
    }

    /**
     * Checks if the sensor is currently active and connected.
     *
     * @return true if sensor status is ACTIVE
     */
    fun isActive(): Boolean = status == SENSOR_STATUS.ACTIVE

    /**
     * Validates if sensor data contains valid readings from either sensor type.
     *
     * @return true if either IMU or ToF data is present and valid
     */
    fun hasValidData(): Boolean = imuData != null || tofData != null

    companion object {
        /**
         * Sampling rates for different sensor types in Hz
         */
        const val IMU_SAMPLING_RATE = SAMPLING_RATES.IMU_HZ
        const val TOF_SAMPLING_RATE = SAMPLING_RATES.TOF_HZ
    }
}