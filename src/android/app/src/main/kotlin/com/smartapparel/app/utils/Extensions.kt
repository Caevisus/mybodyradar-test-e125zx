package com.smartapparel.app.utils

import android.view.View // version: API 29+
import androidx.lifecycle.LifecycleOwner // version: 2.6.1
import kotlinx.coroutines.flow.Flow // version: 1.7.1
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.conflate
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import android.animation.ObjectAnimator
import android.view.animation.AccelerateDecelerateInterpolator
import com.smartapparel.app.domain.models.IMUData
import com.smartapparel.app.domain.models.ToFData
import java.nio.ByteBuffer
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.abs

/**
 * Converts IMU sensor data to byte array format for BLE transmission.
 * Includes validation, error handling, and memory optimization.
 *
 * @return ByteArray containing serialized IMU data or null if validation fails
 */
fun IMUData.toByteArray(): ByteArray? {
    try {
        // Validate sensor data ranges
        if (!validateIMUData()) return null

        // Calculate buffer size: header(1) + accel(12) + gyro(12) + mag(12) + temp(4) + timestamp(8) + checksum(1)
        val buffer = ByteBuffer.allocate(50)
        
        // Write header byte for IMU packet type
        buffer.put(0x01)

        // Write accelerometer data with range validation
        accelerometer.forEach { value ->
            if (abs(value) > 100f) return null // Max 100 m/s²
            buffer.putFloat(value)
        }

        // Write gyroscope data with range validation
        gyroscope.forEach { value ->
            if (abs(value) > 35f) return null // Max 35 rad/s
            buffer.putFloat(value)
        }

        // Write magnetometer data with range validation
        magnetometer.forEach { value ->
            if (abs(value) > 4900f) return null // Max 4900 µT
            buffer.putFloat(value)
        }

        // Write temperature
        if (temperature < -40f || temperature > 85f) return null
        buffer.putFloat(temperature)

        // Write timestamp
        buffer.putLong(System.currentTimeMillis())

        // Calculate and write checksum
        val checksum = buffer.array().take(buffer.position()).fold(0) { acc, byte -> acc + byte }
        buffer.put(checksum.toByte())

        return buffer.array()
    } catch (e: Exception) {
        return null
    }
}

/**
 * Converts ToF sensor data to byte array format for BLE transmission.
 * Includes validation, error handling, and memory optimization.
 *
 * @return ByteArray containing serialized ToF data or null if validation fails
 */
fun ToFData.toByteArray(): ByteArray? {
    try {
        // Validate ToF data
        if (!validateToFData()) return null

        // Calculate buffer size: header(1) + distances(4*n) + gain(1) + ambient(4) + timestamp(8) + checksum(1)
        val bufferSize = 1 + (distances.size * 4) + 1 + 4 + 8 + 1
        val buffer = ByteBuffer.allocate(bufferSize)

        // Write header byte for ToF packet type
        buffer.put(0x02)

        // Write distance array with validation
        distances.forEach { distance ->
            if (distance < 0f || distance > 4000f) return null // Max 4m range
            buffer.putFloat(distance)
        }

        // Write gain value
        if (gain !in CALIBRATION_PARAMS.TOF_GAIN_MIN..CALIBRATION_PARAMS.TOF_GAIN_MAX) return null
        buffer.put(gain.toByte())

        // Write ambient light value
        if (ambientLight < 0) return null
        buffer.putInt(ambientLight)

        // Write timestamp
        buffer.putLong(System.currentTimeMillis())

        // Calculate and write checksum
        val checksum = buffer.array().take(buffer.position()).fold(0) { acc, byte -> acc + byte }
        buffer.put(checksum.toByte())

        return buffer.array()
    } catch (e: Exception) {
        return null
    }
}

/**
 * Throttles a Flow to emit only the latest value within the specified time window.
 * Includes enhanced error handling and cancellation support.
 *
 * @param windowMillis Time window in milliseconds
 * @return Flow emitting throttled values
 */
fun <T> Flow<T>.throttleLatest(windowMillis: Long): Flow<T> {
    require(windowMillis > 0) { "Window duration must be positive" }
    
    val mutex = Mutex()
    val lastEmissionTime = AtomicLong(0)
    
    return flow {
        collect { value ->
            val currentTime = System.currentTimeMillis()
            mutex.withLock {
                val lastEmission = lastEmissionTime.get()
                if (currentTime - lastEmission >= windowMillis) {
                    emit(value)
                    lastEmissionTime.set(currentTime)
                }
            }
        }
    }.conflate() // Use conflate to handle backpressure
}

/**
 * Sets view visibility with fade animation, including null safety and state preservation.
 *
 * @param visibility View visibility constant (View.VISIBLE, View.INVISIBLE, View.GONE)
 * @param durationMillis Animation duration in milliseconds
 */
fun View.setVisibilityWithFade(visibility: Int, durationMillis: Long = 300) {
    // Validate parameters
    if (durationMillis <= 0) return
    if (this.visibility == visibility) return
    
    // Cancel any ongoing animations
    animate().cancel()
    
    val targetAlpha = when (visibility) {
        View.VISIBLE -> 1f
        else -> 0f
    }
    
    // Configure fade animation
    ObjectAnimator.ofFloat(this, "alpha", alpha, targetAlpha).apply {
        duration = durationMillis
        interpolator = AccelerateDecelerateInterpolator()
        
        // Update visibility at appropriate times
        if (visibility == View.VISIBLE) {
            this@setVisibilityWithFade.visibility = View.VISIBLE
        }
        
        withEndAction {
            if (visibility != View.VISIBLE) {
                this@setVisibilityWithFade.visibility = visibility
            }
        }
        
        start()
    }
}

// Private helper functions

private fun IMUData.validateIMUData(): Boolean {
    return accelerometer.size == 3 &&
           gyroscope.size == 3 &&
           magnetometer.size == 3 &&
           temperature in -40f..85f &&
           accelerometer.all { abs(it) <= 100f } &&
           gyroscope.all { abs(it) <= 35f } &&
           magnetometer.all { abs(it) <= 4900f }
}

private fun ToFData.validateToFData(): Boolean {
    return distances.isNotEmpty() &&
           distances.all { it in 0f..4000f } &&
           gain in CALIBRATION_PARAMS.TOF_GAIN_MIN..CALIBRATION_PARAMS.TOF_GAIN_MAX &&
           ambientLight >= 0
}