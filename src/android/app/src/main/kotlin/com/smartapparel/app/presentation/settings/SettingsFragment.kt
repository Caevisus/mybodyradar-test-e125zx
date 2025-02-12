package com.smartapparel.app.presentation.settings

import android.os.Bundle
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.biometric.BiometricManager // version: 1.2.0
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.material.card.MaterialCardView // version: 1.9.0
import com.google.android.material.switchmaterial.MaterialSwitch // version: 1.9.0
import com.smartapparel.app.R
import com.smartapparel.app.databinding.FragmentSettingsBinding
import com.smartapparel.app.presentation.common.BaseFragment
import com.smartapparel.app.utils.ALERT_TYPES
import com.smartapparel.app.utils.Logger
import javax.inject.Inject
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

private const val TAG = "SettingsFragment"

/**
 * Fragment responsible for managing application settings with comprehensive security
 * features and system monitoring capabilities.
 */
class SettingsFragment : BaseFragment<FragmentSettingsBinding, SettingsViewModel>(
    R.layout.fragment_settings
) {

    @Inject
    override lateinit var viewModel: SettingsViewModel

    private lateinit var biometricPrompt: BiometricPrompt
    private lateinit var alertSwitches: Map<String, MaterialSwitch>

    override fun createViewBinding(
        inflater: LayoutInflater,
        container: ViewGroup?
    ): FragmentSettingsBinding {
        return FragmentSettingsBinding.inflate(inflater, container, false)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setupBiometricPrompt()
    }

    override fun setupUI() {
        Logger.d(TAG, "Setting up UI components")

        with(binding) {
            // Theme Settings
            setupThemeSettings()

            // Notification Settings
            setupNotificationSettings()

            // Alert Preferences
            setupAlertPreferences()

            // Security Settings
            setupSecuritySettings()

            // System Monitoring
            setupSystemMonitoring()

            // Data Privacy
            setupDataPrivacySettings()
        }
    }

    override fun setupObservers() {
        Logger.d(TAG, "Setting up state observers")

        viewLifecycleOwner.lifecycleScope.launch {
            // Theme preference observer
            viewModel.isDarkMode.collectLatest { isDarkMode ->
                binding.switchTheme.isChecked = isDarkMode
                Logger.d(TAG, "Theme preference updated: isDarkMode=$isDarkMode")
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            // Notification preference observer
            viewModel.notificationsEnabled.collectLatest { enabled ->
                binding.switchNotifications.isChecked = enabled
                Logger.d(TAG, "Notification preference updated: enabled=$enabled")
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            // Alert preferences observer
            viewModel.alertPreferences.collectLatest { preferences ->
                updateAlertSwitches(preferences)
                Logger.d(TAG, "Alert preferences updated: $preferences")
            }
        }
    }

    private fun setupThemeSettings() {
        with(binding) {
            cardTheme.apply {
                setOnClickListener {
                    switchTheme.toggle()
                }
            }

            switchTheme.apply {
                setOnCheckedChangeListener { _, isChecked ->
                    viewModel.toggleDarkMode()
                    Logger.d(TAG, "Theme switch toggled: isChecked=$isChecked")
                }
            }
        }
    }

    private fun setupNotificationSettings() {
        with(binding) {
            cardNotifications.apply {
                setOnClickListener {
                    switchNotifications.toggle()
                }
            }

            switchNotifications.apply {
                setOnCheckedChangeListener { _, isChecked ->
                    viewModel.updateNotificationSettings(isChecked)
                    Logger.d(TAG, "Notifications switch toggled: isChecked=$isChecked")
                }
            }
        }
    }

    private fun setupAlertPreferences() {
        alertSwitches = ALERT_TYPES::class.sealedSubclasses.associate { alertType ->
            val alertName = alertType.simpleName ?: return@associate "" to MaterialSwitch(requireContext())
            
            val switch = MaterialSwitch(requireContext()).apply {
                text = alertName
                setOnCheckedChangeListener { _, isChecked ->
                    viewModel.updateAlertPreference(alertName, isChecked)
                    Logger.d(TAG, "Alert preference updated: type=$alertName, enabled=$isChecked")
                }
            }

            binding.layoutAlertPreferences.addView(switch)
            alertName to switch
        }
    }

    private fun setupSecuritySettings() {
        with(binding) {
            switchBiometric.apply {
                isEnabled = isBiometricAvailable()
                setOnCheckedChangeListener { _, isChecked ->
                    if (isChecked) {
                        authenticateWithBiometric()
                    }
                    Logger.d(TAG, "Biometric authentication toggled: isChecked=$isChecked")
                }
            }

            buttonChangePin.setOnClickListener {
                showPinChangeDialog()
                Logger.d(TAG, "PIN change requested")
            }
        }
    }

    private fun setupSystemMonitoring() {
        with(binding) {
            // Performance Monitoring
            switchPerformanceMonitoring.setOnCheckedChangeListener { _, isChecked ->
                viewModel.updateSystemMonitoring("performance", isChecked)
                Logger.d(TAG, "Performance monitoring toggled: enabled=$isChecked")
            }

            // Error Reporting
            switchErrorReporting.setOnCheckedChangeListener { _, isChecked ->
                viewModel.updateSystemMonitoring("errors", isChecked)
                Logger.d(TAG, "Error reporting toggled: enabled=$isChecked")
            }

            // Analytics
            switchAnalytics.setOnCheckedChangeListener { _, isChecked ->
                viewModel.updateSystemMonitoring("analytics", isChecked)
                Logger.d(TAG, "Analytics toggled: enabled=$isChecked")
            }
        }
    }

    private fun setupDataPrivacySettings() {
        with(binding) {
            buttonExportData.setOnClickListener {
                viewModel.initiateDataExport()
                Logger.d(TAG, "Data export initiated")
            }

            buttonDeleteData.setOnClickListener {
                showDeleteDataConfirmation()
                Logger.d(TAG, "Data deletion requested")
            }
        }
    }

    private fun setupBiometricPrompt() {
        val executor = ContextCompat.getMainExecutor(requireContext())
        
        biometricPrompt = BiometricPrompt(
            this,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    viewModel.updateBiometricAuth(true)
                    Logger.d(TAG, "Biometric authentication succeeded")
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    binding.switchBiometric.isChecked = false
                    Logger.e(TAG, "Biometric authentication error: $errString")
                }
            }
        )
    }

    private fun authenticateWithBiometric() {
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(getString(R.string.biometric_prompt_title))
            .setSubtitle(getString(R.string.biometric_prompt_subtitle))
            .setNegativeButtonText(getString(R.string.biometric_prompt_cancel))
            .build()

        biometricPrompt.authenticate(promptInfo)
        Logger.d(TAG, "Biometric authentication prompt shown")
    }

    private fun isBiometricAvailable(): Boolean {
        val biometricManager = BiometricManager.from(requireContext())
        return biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) ==
                BiometricManager.BIOMETRIC_SUCCESS
    }

    private fun updateAlertSwitches(preferences: Map<String, Boolean>) {
        alertSwitches.forEach { (alertType, switch) ->
            switch.isChecked = preferences[alertType] ?: false
        }
    }

    private fun showPinChangeDialog() {
        // Implementation for PIN change dialog
        Logger.d(TAG, "Showing PIN change dialog")
    }

    private fun showDeleteDataConfirmation() {
        // Implementation for data deletion confirmation
        Logger.d(TAG, "Showing data deletion confirmation dialog")
    }

    companion object {
        fun newInstance() = SettingsFragment()
    }
}