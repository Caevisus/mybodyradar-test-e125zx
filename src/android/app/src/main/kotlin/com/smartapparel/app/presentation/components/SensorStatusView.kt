package com.smartapparel.app.presentation.components

import android.content.Context // version: API 29+
import android.util.AttributeSet // version: API 29+
import android.view.View // version: API 29+
import android.view.LayoutInflater
import android.widget.TextView
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.Button
import android.graphics.drawable.Drawable
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import androidx.constraintlayout.widget.ConstraintLayout // version: 2.1.4
import androidx.core.content.ContextCompat
import java.lang.ref.WeakReference // version: API 29+
import com.smartapparel.app.domain.models.SensorData
import com.smartapparel.app.utils.SENSOR_STATUS
import com.smartapparel.app.R

/**
 * Custom view component that displays real-time sensor status information including
 * connection state, calibration status, battery level, signal strength, and error states.
 * Optimized for performance with <100ms update latency and accessibility support.
 */
class SensorStatusView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : ConstraintLayout(context, attrs, defStyleAttr) {

    private val statusText: TextView
    private val statusIcon: ImageView
    private val batteryLevel: TextView
    private val signalStrength: ProgressBar
    private val calibrateButton: Button
    
    private var _currentStatus: SENSOR_STATUS = SENSOR_STATUS.DISCONNECTED
    private var calibrationListener: WeakReference<() -> Unit>? = null
    private var isUpdating: Boolean = false
    private var lastUpdateTime: Long = 0
    
    // Cache drawables for performance
    private val connectedDrawable: Drawable?
    private val disconnectedDrawable: Drawable?
    private val errorDrawable: Drawable?
    private val calibratingDrawable: Drawable?
    
    // Update throttling handler
    private val updateHandler = Handler(Looper.getMainLooper())
    
    init {
        // Inflate layout
        LayoutInflater.from(context).inflate(R.layout.view_sensor_status, this, true)
        
        // Initialize views
        statusText = findViewById(R.id.status_text)
        statusIcon = findViewById(R.id.status_icon)
        batteryLevel = findViewById(R.id.battery_level)
        signalStrength = findViewById(R.id.signal_strength)
        calibrateButton = findViewById(R.id.calibrate_button)
        
        // Cache drawables
        connectedDrawable = ContextCompat.getDrawable(context, R.drawable.ic_sensor_connected)
        disconnectedDrawable = ContextCompat.getDrawable(context, R.drawable.ic_sensor_disconnected)
        errorDrawable = ContextCompat.getDrawable(context, R.drawable.ic_sensor_error)
        calibratingDrawable = ContextCompat.getDrawable(context, R.drawable.ic_sensor_calibrating)
        
        // Set up initial state
        setupInitialState()
        
        // Configure accessibility
        setupAccessibility()
    }
    
    private fun setupInitialState() {
        statusText.text = context.getString(R.string.status_disconnected)
        statusIcon.setImageDrawable(disconnectedDrawable)
        batteryLevel.visibility = View.GONE
        signalStrength.visibility = View.GONE
        calibrateButton.visibility = View.GONE
        
        calibrateButton.setOnClickListener {
            calibrationListener?.get()?.invoke()
        }
    }
    
    private fun setupAccessibility() {
        contentDescription = context.getString(R.string.sensor_status_content_description)
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
        
        statusText.accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        calibrateButton.contentDescription = context.getString(R.string.calibrate_button_description)
    }
    
    /**
     * Updates the view with current sensor status information.
     * Throttled to ensure updates occur no more frequently than every 100ms.
     */
    fun updateStatus(sensorData: SensorData) {
        val currentTime = System.currentTimeMillis()
        if (currentTime - lastUpdateTime < 100) {
            // Throttle updates to maintain performance
            updateHandler.removeCallbacksAndMessages(null)
            updateHandler.postDelayed({ updateStatusImmediate(sensorData) }, 100)
            return
        }
        updateStatusImmediate(sensorData)
    }
    
    private fun updateStatusImmediate(sensorData: SensorData) {
        isUpdating = true
        lastUpdateTime = System.currentTimeMillis()
        
        when (sensorData.status) {
            SENSOR_STATUS.DISCONNECTED -> {
                statusText.text = context.getString(R.string.status_disconnected)
                statusIcon.setImageDrawable(disconnectedDrawable)
                batteryLevel.visibility = View.GONE
                signalStrength.visibility = View.GONE
                calibrateButton.visibility = View.GONE
            }
            SENSOR_STATUS.CONNECTING -> {
                statusText.text = context.getString(R.string.status_connecting)
                statusIcon.setImageDrawable(connectedDrawable)
                batteryLevel.visibility = View.VISIBLE
                signalStrength.visibility = View.VISIBLE
                calibrateButton.visibility = View.GONE
            }
            SENSOR_STATUS.CALIBRATING -> {
                statusText.text = context.getString(R.string.status_calibrating)
                statusIcon.setImageDrawable(calibratingDrawable)
                batteryLevel.visibility = View.VISIBLE
                signalStrength.visibility = View.VISIBLE
                calibrateButton.visibility = View.GONE
            }
            SENSOR_STATUS.ACTIVE -> {
                statusText.text = context.getString(R.string.status_active)
                statusIcon.setImageDrawable(connectedDrawable)
                batteryLevel.visibility = View.VISIBLE
                signalStrength.visibility = View.VISIBLE
                calibrateButton.visibility = View.VISIBLE
            }
            SENSOR_STATUS.ERROR -> {
                statusText.text = context.getString(R.string.status_error)
                statusIcon.setImageDrawable(errorDrawable)
                batteryLevel.visibility = View.GONE
                signalStrength.visibility = View.GONE
                calibrateButton.visibility = View.VISIBLE
            }
        }
        
        // Update battery and signal strength if available
        if (sensorData.status != SENSOR_STATUS.DISCONNECTED && sensorData.status != SENSOR_STATUS.ERROR) {
            updateMetrics(sensorData)
        }
        
        // Notify accessibility services of status change
        if (_currentStatus != sensorData.status) {
            announceForAccessibility(statusText.text)
            _currentStatus = sensorData.status
        }
        
        isUpdating = false
    }
    
    private fun updateMetrics(sensorData: SensorData) {
        // Update battery level with proper formatting
        batteryLevel.text = context.getString(
            R.string.battery_level_format,
            sensorData.batteryLevel
        )
        
        // Update signal strength indicator
        signalStrength.progress = sensorData.signalStrength
    }
    
    /**
     * Sets the listener for calibration button clicks.
     * Uses WeakReference to prevent memory leaks.
     */
    fun setOnCalibrationRequestListener(listener: () -> Unit) {
        calibrationListener = WeakReference(listener)
    }
    
    /**
     * Displays error state with proper error handling and user feedback.
     */
    fun showError(errorMessage: String, errorCode: Int) {
        if (errorCode !in 1000..1099) {
            throw IllegalArgumentException("Invalid sensor error code: $errorCode")
        }
        
        statusText.text = errorMessage
        statusIcon.setImageDrawable(errorDrawable)
        batteryLevel.visibility = View.GONE
        signalStrength.visibility = View.GONE
        calibrateButton.visibility = View.VISIBLE
        
        // Announce error for accessibility
        announceForAccessibility(
            context.getString(R.string.sensor_error_announcement, errorMessage)
        )
        
        _currentStatus = SENSOR_STATUS.ERROR
    }
    
    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        updateHandler.removeCallbacksAndMessages(null)
        calibrationListener = null
    }
}