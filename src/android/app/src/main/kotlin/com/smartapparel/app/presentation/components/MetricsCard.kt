package com.smartapparel.app.presentation.components

import android.animation.ValueAnimator // version: API 29+
import android.content.Context
import android.util.AttributeSet
import android.view.LayoutInflater
import android.view.View
import android.view.accessibility.AccessibilityEvent
import androidx.constraintlayout.widget.ConstraintLayout // version: 2.1.4
import androidx.core.content.ContextCompat
import androidx.core.view.AccessibilityDelegateCompat
import androidx.core.view.ViewCompat
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat
import com.google.android.material.card.MaterialCardView // version: 1.9.0
import com.google.android.material.textview.MaterialTextView
import com.google.android.material.button.MaterialButton
import com.smartapparel.app.R
import com.smartapparel.app.domain.models.SensorData
import com.smartapparel.app.utils.SENSOR_STATUS
import kotlin.math.abs

/**
 * A custom Material Design card component that displays real-time performance metrics
 * with support for smooth animations, expansion/collapse, and accessibility features.
 *
 * @property updateThrottleMs Minimum time between updates in milliseconds (default: 100ms)
 */
class MetricsCard @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = com.google.android.material.R.attr.materialCardViewStyle
) : MaterialCardView(context, attrs, defStyleAttr) {

    private var titleTextView: MaterialTextView
    private var muscleActivityTextView: MaterialTextView
    private var forceDistributionTextView: MaterialTextView
    private var expandButton: MaterialButton
    private var forceDistributionView: CustomForceDistributionView
    private var contentLayout: ConstraintLayout

    private var isExpanded = false
    private var lastUpdateTimestamp = 0L
    private var updateThrottleMs = 100f

    private val metricAnimator: ValueAnimator = ValueAnimator().apply {
        duration = 150L
        interpolator = android.view.animation.FastOutSlowInInterpolator()
    }

    private var currentMuscleActivity = 0f
    private var currentForceDistribution = 50f

    init {
        LayoutInflater.from(context).inflate(R.layout.metrics_card_layout, this, true)
        
        // Initialize views
        titleTextView = findViewById(R.id.metrics_title)
        muscleActivityTextView = findViewById(R.id.muscle_activity_value)
        forceDistributionTextView = findViewById(R.id.force_distribution_value)
        expandButton = findViewById(R.id.expand_button)
        forceDistributionView = findViewById(R.id.force_distribution_view)
        contentLayout = findViewById(R.id.metrics_content_layout)

        initializeCardStyle()
        setupAccessibility()
        setupExpandButton()
    }

    private fun initializeCardStyle() {
        elevation = resources.getDimension(R.dimen.card_elevation)
        radius = resources.getDimension(R.dimen.card_corner_radius)
        strokeWidth = resources.getDimension(R.dimen.card_stroke_width).toInt()
        strokeColor = ContextCompat.getColor(context, R.color.card_stroke)
        
        setCardBackgroundColor(ContextCompat.getColor(context, R.color.card_background))
        cardElevation = resources.getDimension(R.dimen.card_elevation)
    }

    private fun setupAccessibility() {
        ViewCompat.setAccessibilityDelegate(this, object : AccessibilityDelegateCompat() {
            override fun onInitializeAccessibilityNodeInfo(
                host: View,
                info: AccessibilityNodeInfoCompat
            ) {
                super.onInitializeAccessibilityNodeInfo(host, info)
                info.addAction(
                    AccessibilityNodeInfoCompat.AccessibilityActionCompat(
                        AccessibilityNodeInfoCompat.ACTION_CLICK,
                        if (isExpanded) context.getString(R.string.collapse_metrics)
                        else context.getString(R.string.expand_metrics)
                    )
                )
            }
        })

        contentDescription = context.getString(R.string.metrics_card_description)
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
    }

    private fun setupExpandButton() {
        expandButton.setOnClickListener {
            toggleExpanded()
        }
    }

    /**
     * Updates the metrics display with new sensor data.
     * Implements throttling to maintain performance while ensuring smooth animations.
     *
     * @param sensorData The latest sensor data containing IMU and ToF measurements
     */
    fun updateMetrics(sensorData: SensorData) {
        val currentTime = System.currentTimeMillis()
        if (currentTime - lastUpdateTimestamp < updateThrottleMs) return
        
        if (sensorData.status != SENSOR_STATUS.ACTIVE) return

        sensorData.imuData?.let { imuData ->
            // Calculate muscle activity from accelerometer magnitude
            val activityValue = calculateMuscleActivity(imuData.accelerometer)
            animateMetricUpdate(currentMuscleActivity, activityValue) { value ->
                currentMuscleActivity = value
                muscleActivityTextView.text = String.format("%.1f%%", value)
            }
        }

        sensorData.tofData?.let { tofData ->
            // Calculate force distribution from ToF distances
            val distribution = calculateForceDistribution(tofData.distances)
            animateMetricUpdate(currentForceDistribution, distribution) { value ->
                currentForceDistribution = value
                forceDistributionTextView.text = 
                    String.format("%d/%d", (value).toInt(), (100 - value).toInt())
                forceDistributionView.updateDistribution(value)
            }
        }

        lastUpdateTimestamp = currentTime
        announceMetricsUpdate()
    }

    private fun calculateMuscleActivity(accelerometer: FloatArray): Float {
        val magnitude = sqrt(
            accelerometer[0] * accelerometer[0] +
            accelerometer[1] * accelerometer[1] +
            accelerometer[2] * accelerometer[2]
        )
        return (magnitude / 9.81f * 100f).coerceIn(0f, 100f)
    }

    private fun calculateForceDistribution(distances: FloatArray): Float {
        val leftSide = distances.take(distances.size / 2).average()
        val rightSide = distances.drop(distances.size / 2).average()
        val total = leftSide + rightSide
        return if (total > 0) (leftSide / total * 100f).coerceIn(0f, 100f) else 50f
    }

    private fun animateMetricUpdate(
        currentValue: Float,
        targetValue: Float,
        updateCallback: (Float) -> Unit
    ) {
        if (abs(currentValue - targetValue) < 0.1f) return

        metricAnimator.cancel()
        metricAnimator.setFloatValues(currentValue, targetValue)
        metricAnimator.addUpdateListener { animation ->
            updateCallback(animation.animatedValue as Float)
        }
        metricAnimator.start()
    }

    private fun toggleExpanded() {
        isExpanded = !isExpanded
        
        val rotationTarget = if (isExpanded) 180f else 0f
        expandButton.animate()
            .rotation(rotationTarget)
            .setDuration(200)
            .start()

        contentLayout.visibility = if (isExpanded) View.VISIBLE else View.GONE
        
        announceExpandStateChange()
    }

    private fun announceMetricsUpdate() {
        if (isExpanded) {
            announceForAccessibility(
                context.getString(
                    R.string.metrics_update_announcement,
                    muscleActivityTextView.text,
                    forceDistributionTextView.text
                )
            )
        }
    }

    private fun announceExpandStateChange() {
        announceForAccessibility(
            if (isExpanded) context.getString(R.string.metrics_expanded)
            else context.getString(R.string.metrics_collapsed)
        )
    }

    /**
     * Sets the minimum time between metric updates.
     *
     * @param throttleMs Minimum time between updates in milliseconds
     */
    fun setUpdateThrottle(throttleMs: Float) {
        updateThrottleMs = throttleMs.coerceAtLeast(16.67f) // Minimum 60fps
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        metricAnimator.cancel()
    }

    companion object {
        private const val ANIMATION_DURATION = 200L
        private const val MIN_UPDATE_THROTTLE_MS = 16.67f // 60fps
    }
}