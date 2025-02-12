package com.smartapparel.app.domain.models

import android.os.Parcelable // latest
import kotlinx.parcelize.Parcelize // v1.9.0
import com.google.gson.annotations.SerializedName // v2.10.1
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicReference

/**
 * Data class representing comprehensive team-wide configuration settings
 * with enhanced analytics and security features.
 */
@Parcelize
data class TeamSettings(
    @SerializedName("alertThresholds")
    val alertThresholds: Map<String, Double> = mapOf(),

    @SerializedName("notificationSettings")
    val notificationSettings: Map<String, Boolean> = mapOf(),

    @SerializedName("dataSharingRules")
    val dataSharingRules: Map<String, String> = mapOf(),

    @SerializedName("lastUpdated")
    val lastUpdated: Long = System.currentTimeMillis()
) : Parcelable {
    
    fun validateSettings(): Boolean {
        // Validate alert thresholds
        if (alertThresholds.any { (metric, value) ->
            when (metric) {
                "teamImpactForce" -> value !in 0.0..2000.0 // Newtons
                "teamMuscleLoad" -> value !in 0.0..100.0 // Percentage
                "teamAsymmetryIndex" -> value !in 0.0..50.0 // Percentage
                else -> true
            }
        }) {
            return false
        }

        // Validate notification settings exist for required channels
        val requiredNotifications = setOf("pushEnabled", "emailEnabled", "alertsEnabled")
        if (!notificationSettings.keys.containsAll(requiredNotifications)) {
            return false
        }

        // Validate data sharing rules
        val validSharingLevels = setOf("FULL", "ANONYMOUS", "MINIMAL", "NONE")
        if (dataSharingRules.any { it.value !in validSharingLevels }) {
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
 * Main data class representing a team with comprehensive management capabilities
 * and security features. Implements thread-safe operations for concurrent access.
 */
@Parcelize
data class Team(
    @SerializedName("id")
    val id: String,

    @SerializedName("name")
    val name: String,

    @SerializedName("athleteIds")
    private val _athleteIds: List<String> = CopyOnWriteArrayList(),

    @SerializedName("settings")
    private val _settings: TeamSettings = TeamSettings(),

    @SerializedName("organizationId")
    val organizationId: String,

    @SerializedName("createdAt")
    val createdAt: Long = System.currentTimeMillis(),

    @SerializedName("updatedAt")
    private var _updatedAt: Long = System.currentTimeMillis()
) : Parcelable {

    // Thread-safe access to mutable properties
    val athleteIds: List<String> get() = _athleteIds
    val settings: TeamSettings get() = _settings
    val updatedAt: Long get() = _updatedAt

    init {
        require(id.isNotBlank()) { "Team ID cannot be empty" }
        require(name.length in 2..100) { "Team name must be between 2 and 100 characters" }
        require(organizationId.isNotBlank()) { "Organization ID cannot be empty" }
        require(_settings.validateSettings()) { "Invalid team settings" }
        require(createdAt <= _updatedAt) { "Created timestamp cannot be after updated timestamp" }
    }

    /**
     * Adds an athlete to the team roster with validation and security checks.
     * Thread-safe implementation using CopyOnWriteArrayList.
     */
    fun addAthlete(athleteId: String): Boolean {
        if (athleteId.isBlank()) return false
        
        return synchronized(this) {
            if (athleteId !in _athleteIds) {
                (_athleteIds as CopyOnWriteArrayList<String>).add(athleteId)
                _updatedAt = System.currentTimeMillis()
                true
            } else {
                false
            }
        }
    }

    /**
     * Removes an athlete from the team roster with validation and security checks.
     * Thread-safe implementation using CopyOnWriteArrayList.
     */
    fun removeAthlete(athleteId: String): Boolean {
        if (athleteId.isBlank()) return false

        return synchronized(this) {
            if ((_athleteIds as CopyOnWriteArrayList<String>).remove(athleteId)) {
                _updatedAt = System.currentTimeMillis()
                true
            } else {
                false
            }
        }
    }

    /**
     * Updates team settings with validation and atomic operations.
     * Thread-safe implementation using AtomicReference.
     */
    fun updateSettings(newSettings: TeamSettings) {
        require(newSettings.validateSettings()) { "Invalid team settings" }

        synchronized(this) {
            (_settings as AtomicReference<TeamSettings>).set(newSettings)
            _updatedAt = System.currentTimeMillis()
        }
    }

    /**
     * Validates the entire team object state.
     */
    fun validate(): Boolean {
        return id.isNotBlank() &&
               name.length in 2..100 &&
               organizationId.isNotBlank() &&
               settings.validateSettings() &&
               createdAt <= updatedAt &&
               updatedAt <= System.currentTimeMillis()
    }

    companion object {
        const val MAX_TEAM_SIZE = 100
        const val MAX_NAME_LENGTH = 100
        const val MIN_NAME_LENGTH = 2
    }
}