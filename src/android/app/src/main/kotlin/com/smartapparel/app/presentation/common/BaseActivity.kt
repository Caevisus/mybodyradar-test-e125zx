package com.smartapparel.app.presentation.common

import android.content.res.Configuration
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.progressindicator.CircularProgressIndicator
import com.google.android.material.theme.ThemeManager
import com.smartapparel.app.utils.Logger
import com.smartapparel.app.utils.SENSOR_STATUS
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

private const val TAG = "BaseActivity"
private const val LOADING_ANIMATION_DURATION = 250L

/**
 * Abstract base activity providing comprehensive functionality for all activities
 * in the Smart Apparel application.
 *
 * Features:
 * - Material Design 3.0 theming with dynamic color support
 * - WCAG 2.1 Level AA accessibility compliance
 * - Enhanced lifecycle management and logging
 * - Loading state management with animations
 * - Error handling with Material Design dialogs
 * - Sensor connectivity monitoring
 *
 * @since 1.0.0
 */
abstract class BaseActivity : AppCompatActivity() {

    private lateinit var loadingIndicator: CircularProgressIndicator
    private var isLoading: Boolean = false
    private var isDarkTheme: Boolean = false
    private var isMultiWindowMode: Boolean = false

    override fun onCreate(savedInstanceState: Bundle?) {
        // Apply Material Design 3.0 theme before super.onCreate
        applyMaterialTheme()
        
        super.onCreate(savedInstanceState)
        
        Logger.d(TAG, "Activity onCreate: ${javaClass.simpleName}")

        // Configure window insets for edge-to-edge design
        WindowCompat.setDecorFitsSystemWindows(window, false)

        // Initialize loading indicator with accessibility support
        setupLoadingIndicator()

        // Restore instance state
        savedInstanceState?.let { restoreInstanceState(it) }

        // Monitor sensor status
        monitorSensorStatus()
    }

    /**
     * Applies Material Design 3.0 theme with dynamic color support
     */
    private fun applyMaterialTheme() {
        isDarkTheme = resources.configuration.uiMode and 
            Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
        
        ThemeManager.applyDynamicColors(this, isDarkTheme)
    }

    /**
     * Sets up loading indicator with accessibility support
     */
    private fun setupLoadingIndicator() {
        loadingIndicator = CircularProgressIndicator(this).apply {
            isIndeterminate = true
            visibility = View.GONE
            contentDescription = getString(android.R.string.loading)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
        }
    }

    /**
     * Shows loading indicator with animation and accessibility announcement
     */
    protected fun showLoading() {
        if (isLoading) return
        
        isLoading = true
        Logger.d(TAG, "Showing loading indicator")

        loadingIndicator.apply {
            alpha = 0f
            visibility = View.VISIBLE
            announceForAccessibility(contentDescription)
            animate()
                .alpha(1f)
                .setDuration(LOADING_ANIMATION_DURATION)
                .start()
        }
    }

    /**
     * Hides loading indicator with animation
     */
    protected fun hideLoading() {
        if (!isLoading) return
        
        Logger.d(TAG, "Hiding loading indicator")

        loadingIndicator.animate()
            .alpha(0f)
            .setDuration(LOADING_ANIMATION_DURATION)
            .withEndAction {
                loadingIndicator.visibility = View.GONE
                isLoading = false
            }
            .start()
    }

    /**
     * Shows error dialog with Material Design styling and accessibility support
     */
    protected fun showError(message: String, isCritical: Boolean = false) {
        Logger.e(TAG, "Showing error dialog: $message, critical: $isCritical")

        MaterialAlertDialogBuilder(this).apply {
            setTitle(if (isCritical) R.string.error_critical else R.string.error_title)
            setMessage(message)
            setPositiveButton(android.R.string.ok) { dialog, _ -> dialog.dismiss() }
            
            if (isCritical) {
                setCancelable(false)
                setNegativeButton(R.string.retry) { _, _ -> onErrorRetry() }
            }
            
            create().apply {
                window?.setFlags(
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                )
                show()
            }
        }
    }

    /**
     * Handles configuration changes including theme updates
     */
    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        
        val wasNightMode = isDarkTheme
        isDarkTheme = newConfig.uiMode and 
            Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
        
        if (wasNightMode != isDarkTheme) {
            Logger.d(TAG, "Theme changed, recreating activity")
            recreate()
        }
    }

    /**
     * Monitors sensor connectivity status
     */
    private fun monitorSensorStatus() {
        lifecycleScope.launch {
            sensorStatusFlow.collectLatest { status ->
                when (status) {
                    SENSOR_STATUS.DISCONNECTED -> {
                        showError(getString(R.string.error_sensor_disconnected))
                        Logger.e(TAG, "Sensor disconnected")
                    }
                    SENSOR_STATUS.ERROR -> {
                        showError(getString(R.string.error_sensor_malfunction), true)
                        Logger.e(TAG, "Sensor malfunction detected")
                    }
                    else -> {
                        // Handle other sensor states
                    }
                }
            }
        }
    }

    /**
     * Saves instance state
     */
    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putBoolean(KEY_IS_LOADING, isLoading)
        Logger.d(TAG, "Saving instance state")
    }

    /**
     * Restores instance state
     */
    private fun restoreInstanceState(savedState: Bundle) {
        if (savedState.getBoolean(KEY_IS_LOADING, false)) {
            showLoading()
        }
        Logger.d(TAG, "Restoring instance state")
    }

    /**
     * Called when retry is requested for critical errors
     */
    protected open fun onErrorRetry() {
        Logger.d(TAG, "Error retry requested")
    }

    companion object {
        private const val KEY_IS_LOADING = "key_is_loading"
    }
}