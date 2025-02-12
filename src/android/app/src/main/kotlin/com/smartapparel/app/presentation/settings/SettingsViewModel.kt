package com.smartapparel.app.presentation.settings

import androidx.lifecycle.viewModelScope // version: 2.6.1
import com.google.firebase.analytics.FirebaseAnalytics // version: 21.2.0
import com.smartapparel.app.presentation.common.BaseViewModel
import com.smartapparel.app.utils.SecurityUtils
import com.smartapparel.app.utils.ALERT_TYPES
import javax.inject.Inject // version: 1
import kotlinx.coroutines.flow.MutableStateFlow // version: 1.7.1
import kotlinx.coroutines.flow.StateFlow // version: 1.7.1
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import android.content.SharedPreferences
import android.app.NotificationManager
import android.content.Context

private const val TAG = "SettingsViewModel"
private const val PREFERENCE_ENCRYPTION_KEY = "settings_key"
private const val DARK_MODE_KEY = "dark_mode"
private const val NOTIFICATIONS_KEY = "notifications_enabled"
private const val ALERT_PREFERENCES_KEY = "alert_preferences"

/**
 * ViewModel responsible for managing application settings with secure storage
 * and comprehensive monitoring capabilities.
 */
class SettingsViewModel @Inject constructor(
    private val sharedPreferences: SharedPreferences,
    private val notificationManager: NotificationManager,
    private val context: Context,
    private val analytics: FirebaseAnalytics
) : BaseViewModel() {

    // Theme preferences
    private val _isDarkMode = MutableStateFlow(false)
    val isDarkMode: StateFlow<Boolean> = _isDarkMode.asStateFlow()

    // Notification preferences
    private val _notificationsEnabled = MutableStateFlow(false)
    val notificationsEnabled: StateFlow<Boolean> = _notificationsEnabled.asStateFlow()

    // Alert type preferences
    private val _alertPreferences = MutableStateFlow<Map<String, Boolean>>(emptyMap())
    val alertPreferences: StateFlow<Map<String, Boolean>> = _alertPreferences.asStateFlow()

    init {
        loadSavedPreferences()
        setupPreferenceMonitoring()
    }

    /**
     * Securely toggles and persists dark/light theme mode
     */
    fun toggleDarkMode() = launchWithLoading {
        try {
            val newValue = !_isDarkMode.value
            _isDarkMode.value = newValue

            // Encrypt and save preference
            val encryptedValue = SecurityUtils.encryptData(newValue.toString().toByteArray())
            sharedPreferences.edit().putString(DARK_MODE_KEY, encryptedValue.toString()).apply()

            analytics.logEvent("theme_changed", mapOf(
                "dark_mode" to newValue.toString(),
                "timestamp" to System.currentTimeMillis().toString()
            ).toBundle())

        } catch (e: Exception) {
            handleError(e, "toggling dark mode")
        }
    }

    /**
     * Updates and securely stores notification preferences
     */
    fun updateNotificationSettings(enabled: Boolean) = launchWithLoading {
        try {
            if (enabled && !notificationManager.areNotificationsEnabled()) {
                // Request notification permission if needed
                requestNotificationPermission()
                return@launchWithLoading
            }

            _notificationsEnabled.value = enabled

            // Encrypt and save preference
            val encryptedValue = SecurityUtils.encryptData(enabled.toString().toByteArray())
            sharedPreferences.edit().putString(NOTIFICATIONS_KEY, encryptedValue.toString()).apply()

            analytics.logEvent("notification_settings_changed", mapOf(
                "enabled" to enabled.toString(),
                "timestamp" to System.currentTimeMillis().toString()
            ).toBundle())

        } catch (e: Exception) {
            handleError(e, "updating notification settings")
        }
    }

    /**
     * Updates specific alert type preferences with validation
     */
    fun updateAlertPreference(alertType: String, enabled: Boolean) = launchWithLoading {
        try {
            validateAlertType(alertType)

            val currentPreferences = _alertPreferences.value.toMutableMap()
            currentPreferences[alertType] = enabled
            _alertPreferences.value = currentPreferences

            // Encrypt and save preferences
            val encryptedValue = SecurityUtils.encryptData(
                currentPreferences.toString().toByteArray()
            )
            sharedPreferences.edit()
                .putString(ALERT_PREFERENCES_KEY, encryptedValue.toString())
                .apply()

            analytics.logEvent("alert_preference_changed", mapOf(
                "alert_type" to alertType,
                "enabled" to enabled.toString(),
                "timestamp" to System.currentTimeMillis().toString()
            ).toBundle())

        } catch (e: Exception) {
            handleError(e, "updating alert preference")
        }
    }

    /**
     * Securely loads and validates saved preferences
     */
    private fun loadSavedPreferences() = launchWithLoading {
        try {
            // Load and decrypt dark mode preference
            sharedPreferences.getString(DARK_MODE_KEY, null)?.let { encrypted ->
                val decrypted = SecurityUtils.decryptData(encrypted.toEncryptedData())
                _isDarkMode.value = String(decrypted).toBoolean()
            }

            // Load and decrypt notification preference
            sharedPreferences.getString(NOTIFICATIONS_KEY, null)?.let { encrypted ->
                val decrypted = SecurityUtils.decryptData(encrypted.toEncryptedData())
                _notificationsEnabled.value = String(decrypted).toBoolean()
            }

            // Load and decrypt alert preferences
            sharedPreferences.getString(ALERT_PREFERENCES_KEY, null)?.let { encrypted ->
                val decrypted = SecurityUtils.decryptData(encrypted.toEncryptedData())
                _alertPreferences.value = parseAlertPreferences(String(decrypted))
            }

            analytics.logEvent("settings_loaded", mapOf(
                "timestamp" to System.currentTimeMillis().toString()
            ).toBundle())

        } catch (e: Exception) {
            handleError(e, "loading saved preferences")
        }
    }

    /**
     * Sets up monitoring for preference changes
     */
    private fun setupPreferenceMonitoring() {
        sharedPreferences.registerOnSharedPreferenceChangeListener { _, key ->
            viewModelScope.launch {
                try {
                    when (key) {
                        DARK_MODE_KEY -> loadSavedPreferences()
                        NOTIFICATIONS_KEY -> loadSavedPreferences()
                        ALERT_PREFERENCES_KEY -> loadSavedPreferences()
                    }
                } catch (e: Exception) {
                    handleError(e, "monitoring preference changes")
                }
            }
        }
    }

    private fun validateAlertType(alertType: String) {
        if (!ALERT_TYPES::class.sealedSubclasses.map { it.simpleName }.contains(alertType)) {
            throw IllegalArgumentException("Invalid alert type: $alertType")
        }
    }

    private fun requestNotificationPermission() {
        // Implementation depends on specific notification permission request mechanism
    }

    private fun parseAlertPreferences(preferencesString: String): Map<String, Boolean> {
        // Implementation of alert preferences parsing
        return emptyMap() // Placeholder
    }

    override fun onCleared() {
        super.onCleared()
        // Cleanup resources
        sharedPreferences.unregisterOnSharedPreferenceChangeListener { _, _ -> }
    }
}