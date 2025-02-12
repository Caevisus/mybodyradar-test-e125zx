package com.smartapparel.app.domain.models

import android.os.Parcelable
import kotlinx.parcelize.Parcelize // v1.9.0
import com.google.gson.annotations.SerializedName // v2.10.1
import com.smartapparel.security.EncryptedField // v1.0.0
import java.util.HashMap

/**
 * Data class representing range of motion measurements with validation.
 */
@Parcelize
data class RangeOfMotion(
    val min: Double,
    val max: Double
) : Parcelable {
    fun isValid(): Boolean {
        return min >= 0.0 && 
               max > min && 
               max <= 360.0 && // Maximum possible joint rotation
               (max - min) <= 180.0 // Maximum physiological range
    }
}

/**
 * Data class representing baseline biomechanical measurements with validation.
 */
@Parcelize
data class BaselineData(
    val muscleProfiles: Map<String, Double>,
    val rangeOfMotion: Map<String, RangeOfMotion>,
    val forceDistribution: Map<String, Double>,
    val lastUpdated: Long
) : Parcelable {
    fun validateMeasurements(): Boolean {
        // Validate muscle profiles (0-100% activation)
        if (muscleProfiles.any { it.value < 0.0 || it.value > 100.0 }) {
            return false
        }

        // Validate range of motion measurements
        if (rangeOfMotion.any { !it.value.isValid() }) {
            return false
        }

        // Validate force distribution (should sum to 100%)
        val totalForce = forceDistribution.values.sum()
        if (totalForce < 99.9 || totalForce > 100.1) {
            return false
        }

        // Validate timestamp
        if (lastUpdated > System.currentTimeMillis()) {
            return false
        }

        return true
    }
}

/**
 * Data class representing notification preferences.
 */
@Parcelize
data class NotificationSettings(
    val enablePushNotifications: Boolean,
    val enableEmailAlerts: Boolean,
    val alertFrequency: String // "IMMEDIATE", "HOURLY", "DAILY"
) : Parcelable

/**
 * Data class representing data sharing preferences.
 */
@Parcelize
data class DataSharingSettings(
    val shareWithTeam: Boolean,
    val shareWithMedical: Boolean,
    val shareWithResearchers: Boolean,
    val dataSharingLevel: String // "FULL", "ANONYMOUS", "MINIMAL"
) : Parcelable

/**
 * Data class for athlete-specific settings and preferences.
 */
@Parcelize
data class AthletePreferences(
    val alertThresholds: Map<String, Double>,
    val notificationSettings: NotificationSettings,
    val dataSharingSettings: DataSharingSettings
) : Parcelable {
    fun validateThresholds(): Boolean {
        return alertThresholds.all { (metric, value) ->
            when (metric) {
                "impactForce" -> value in 0.0..1000.0 // Newtons
                "muscleLoad" -> value in 0.0..100.0 // Percentage
                "rangeDeviation" -> value in 0.0..45.0 // Degrees
                "asymmetryIndex" -> value in 0.0..50.0 // Percentage
                else -> false
            }
        }
    }
}

/**
 * Result class for validation operations.
 */
data class ValidationResult(
    val isValid: Boolean,
    val errors: List<String>
)

/**
 * Main data class representing an athlete with enhanced security and validation.
 */
@Parcelize
data class Athlete(
    @SerializedName("id") @EncryptedField
    val id: String,
    
    @SerializedName("name") @EncryptedField
    val name: String,
    
    @SerializedName("email") @EncryptedField
    val email: String,
    
    val teamId: String,
    val baselineData: BaselineData,
    val preferences: AthletePreferences,
    val createdAt: Long,
    val updatedAt: Long
) : Parcelable {

    fun toMap(): Map<String, Any> {
        val map = HashMap<String, Any>()
        
        // Sanitize and add encrypted fields
        map["id"] = id
        map["name"] = name.trim()
        map["email"] = email.lowercase().trim()
        map["teamId"] = teamId
        
        // Convert nested objects
        map["baselineData"] = baselineData
        map["preferences"] = preferences
        
        // Add timestamps
        map["createdAt"] = createdAt
        map["updatedAt"] = updatedAt
        
        return map
    }

    fun validate(): ValidationResult {
        val errors = mutableListOf<String>()

        // Validate personal information
        if (name.isBlank()) errors.add("Name cannot be empty")
        if (!email.matches(Regex("^[A-Za-z0-9+_.-]+@(.+)$"))) {
            errors.add("Invalid email format")
        }
        if (teamId.isBlank()) errors.add("Team ID cannot be empty")

        // Validate baseline data
        if (!baselineData.validateMeasurements()) {
            errors.add("Invalid baseline measurements")
        }

        // Validate preferences
        if (!preferences.validateThresholds()) {
            errors.add("Invalid alert thresholds")
        }

        // Validate timestamps
        if (createdAt > updatedAt) {
            errors.add("Created timestamp cannot be after updated timestamp")
        }
        if (updatedAt > System.currentTimeMillis()) {
            errors.add("Updated timestamp cannot be in the future")
        }

        return ValidationResult(
            isValid = errors.isEmpty(),
            errors = errors
        )
    }

    companion object {
        const val MAX_NAME_LENGTH = 100
        const val MIN_NAME_LENGTH = 2
    }
}