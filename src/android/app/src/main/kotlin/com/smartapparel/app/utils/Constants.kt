package com.smartapparel.app.utils

import android.os.Build // version: API 29+

/**
 * Core API configuration settings for the smart apparel application.
 */
object API_CONFIG {
    const val BASE_URL: String = BuildConfig.API_BASE_URL
    const val API_VERSION: String = "v1"
    const val TIMEOUT_MS: Long = 30000L
    const val RETRY_ATTEMPTS: Int = 3
    const val RETRY_DELAY_MS: Long = 5000L
}

/**
 * Supported sensor types in the smart apparel system.
 */
sealed class SENSOR_TYPES {
    object IMU : SENSOR_TYPES()
    object TOF : SENSOR_TYPES()
}

/**
 * Possible states of sensor connectivity and operation.
 */
sealed class SENSOR_STATUS {
    object DISCONNECTED : SENSOR_STATUS()
    object CONNECTING : SENSOR_STATUS()
    object CALIBRATING : SENSOR_STATUS()
    object ACTIVE : SENSOR_STATUS()
    object ERROR : SENSOR_STATUS()
}

/**
 * Sensor sampling rate configurations and processing windows.
 */
object SAMPLING_RATES {
    const val IMU_HZ: Int = 200 // 200Hz sampling rate for IMU
    const val TOF_HZ: Int = 100 // 100Hz sampling rate for ToF
    const val BUFFER_SIZE_MS: Int = 1000 // 1 second buffer
    const val PROCESSING_WINDOW_MS: Int = 100 // 100ms processing window
}

/**
 * Bluetooth configuration parameters for sensor communication.
 */
object BLUETOOTH_CONFIG {
    const val SERVICE_UUID: String = "180D"
    const val IMU_CHARACTERISTIC: String = "2A37"
    const val TOF_CHARACTERISTIC: String = "2A38"
    const val MTU_SIZE: Int = 512
    const val SCAN_PERIOD_MS: Long = 10000L
    const val CONNECTION_TIMEOUT_MS: Long = 5000L
}

/**
 * Categories of system alerts.
 */
sealed class ALERT_TYPES {
    object BIOMECHANICAL : ALERT_TYPES()
    object PHYSIOLOGICAL : ALERT_TYPES()
    object PERFORMANCE : ALERT_TYPES()
    object SYSTEM : ALERT_TYPES()
}

/**
 * Alert severity levels for classification.
 */
sealed class ALERT_SEVERITY {
    object LOW : ALERT_SEVERITY()
    object MEDIUM : ALERT_SEVERITY()
    object HIGH : ALERT_SEVERITY()
    object CRITICAL : ALERT_SEVERITY()
}

/**
 * Threshold values for various alert conditions.
 */
object ALERT_THRESHOLDS {
    const val FORCE_N: Float = 850f // Maximum force in Newtons
    const val IMPACT_G: Float = 10.0f // Maximum impact in G-force
    const val ASYMMETRY_PERCENT: Float = 15.0f // Maximum asymmetry percentage
    const val STRAIN_PERCENT: Float = 85.0f // Maximum strain percentage
    const val FATIGUE_PERCENT: Float = 75.0f // Fatigue threshold percentage
    const val TEMPERATURE_MAX_C: Float = 40.0f // Maximum temperature in Celsius
    const val HEART_RATE_MAX_BPM: Int = 200 // Maximum heart rate in BPM
}

/**
 * Sensor calibration parameters and limits.
 */
object CALIBRATION_PARAMS {
    const val TOF_GAIN_MIN: Int = 1
    const val TOF_GAIN_MAX: Int = 16
    const val TOF_GAIN_DEFAULT: Int = 8
    const val IMU_DRIFT_MIN: Float = 0.1f
    const val IMU_DRIFT_MAX: Float = 2.0f
    const val IMU_DRIFT_DEFAULT: Float = 0.5f
    const val CALIBRATION_TIMEOUT_MS: Long = 30000L
    const val CALIBRATION_SAMPLES: Int = 100
}

/**
 * Data management and storage configuration parameters.
 */
object DATA_CONFIG {
    const val BUFFER_SIZE: Int = 1024 // Buffer size in bytes
    const val CACHE_EXPIRY_MS: Long = 24 * 60 * 60 * 1000L // 24 hours
    const val MAX_LOCAL_STORAGE_MB: Int = 500 // Maximum local storage in MB
    const val COMPRESSION_RATIO: Float = 10.0f // 10:1 compression ratio
    const val SYNC_INTERVAL_MS: Long = 300000L // 5 minutes
    const val BATCH_SIZE: Int = 100 // Number of records per batch
}