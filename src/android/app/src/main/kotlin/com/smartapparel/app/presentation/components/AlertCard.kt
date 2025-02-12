package com.smartapparel.app.presentation.components

import android.content.Context
import android.util.AttributeSet
import android.view.LayoutInflater
import android.view.HapticFeedbackConstants
import android.view.animation.AnimationUtils
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import com.google.android.material.card.MaterialCardView // version: 1.9.0
import com.google.android.material.textview.MaterialTextView
import com.google.android.material.button.MaterialButton
import com.smartapparel.app.R
import com.smartapparel.app.domain.models.Alert
import com.smartapparel.app.utils.Constants.ALERT_SEVERITY
import com.smartapparel.app.utils.Constants.ALERT_TYPES

/**
 * Athletic-optimized Material Design 3.0 card component for displaying alert information.
 * Features enhanced visibility for outdoor use, motion-optimized animations, and robust touch interaction.
 */
class AlertCard @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = com.google.android.material.R.attr.materialCardViewStyle
) : MaterialCardView(context, attrs, defStyleAttr) {

    private val titleView: MaterialTextView
    private val messageView: MaterialTextView
    private val severityView: MaterialTextView
    private val actionButton: MaterialButton
    
    private var onActionClick: ((Alert) -> Unit)? = null
    private var currentAlert: Alert? = null
    
    private val baseElevation = resources.getDimension(R.dimen.card_elevation)
    private val elevatedState = resources.getDimension(R.dimen.card_elevation_raised)
    private val touchTargetSize = resources.getDimensionPixelSize(R.dimen.touch_target_min)
    private val animationDuration = 150L // Motion-optimized duration

    init {
        // Inflate layout with athletic-optimized parameters
        LayoutInflater.from(context).inflate(R.layout.view_alert_card, this, true)
        
        // Initialize views with enhanced contrast settings
        titleView = findViewById(R.id.alert_title)
        messageView = findViewById(R.id.alert_message)
        severityView = findViewById(R.id.alert_severity)
        actionButton = findViewById(R.id.alert_action_button)

        // Configure athletic-optimized touch feedback
        isClickable = true
        isFocusable = true
        
        // Set up motion-aware elevation animation
        ViewCompat.setStateListAnimator(this, null)
        elevation = baseElevation
        
        // Configure enhanced touch interaction
        setOnTouchListener { view, event ->
            view.onTouchEvent(event).also {
                when (event.action) {
                    android.view.MotionEvent.ACTION_DOWN -> {
                        elevation = elevatedState
                        performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                    }
                    android.view.MotionEvent.ACTION_UP, android.view.MotionEvent.ACTION_CANCEL -> {
                        elevation = baseElevation
                    }
                }
            }
        }
    }

    /**
     * Binds alert data with enhanced visibility and interaction handling.
     * @param alert Alert data to display
     */
    fun bind(alert: Alert) {
        currentAlert = alert
        
        // Configure title with high-contrast visibility
        titleView.text = when (alert.type) {
            ALERT_TYPES.BIOMECHANICAL -> "Biomechanical Alert"
            ALERT_TYPES.PHYSIOLOGICAL -> "Physiological Alert"
            ALERT_TYPES.PERFORMANCE -> "Performance Alert"
            ALERT_TYPES.SYSTEM -> "System Alert"
        }

        // Set message with enhanced readability
        messageView.text = alert.message
        
        // Apply athletic-optimized severity styling
        applySeverityStyle(alert.severity)
        
        // Configure action button with enhanced touch target
        actionButton.apply {
            text = if (alert.isActive()) "View Details" else "Dismissed"
            isEnabled = alert.isActive()
            minimumHeight = touchTargetSize
            setOnClickListener { 
                performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                currentAlert?.let { onActionClick?.invoke(it) }
            }
        }
    }

    /**
     * Sets click listener with enhanced touch feedback.
     * @param listener Callback for action button clicks
     */
    fun setOnActionClickListener(listener: (Alert) -> Unit) {
        onActionClick = listener
    }

    /**
     * Applies severity-based styling with outdoor visibility optimizations.
     * @param severity Alert severity level
     */
    private fun applySeverityStyle(severity: ALERT_SEVERITY) {
        val (backgroundColor, textColor, elevation) = when (severity) {
            ALERT_SEVERITY.CRITICAL -> Triple(
                R.color.error,
                R.color.text_primary_dark,
                resources.getDimension(R.dimen.card_elevation_raised)
            )
            ALERT_SEVERITY.HIGH -> Triple(
                R.color.warning,
                R.color.text_primary_light,
                resources.getDimension(R.dimen.card_elevation) * 1.5f
            )
            ALERT_SEVERITY.MEDIUM -> Triple(
                R.color.heatmap_medium,
                R.color.text_primary_light,
                resources.getDimension(R.dimen.card_elevation) * 1.25f
            )
            ALERT_SEVERITY.LOW -> Triple(
                R.color.heatmap_low,
                R.color.text_primary_light,
                resources.getDimension(R.dimen.card_elevation)
            )
        }

        // Apply outdoor-optimized styling
        setCardBackgroundColor(ContextCompat.getColor(context, backgroundColor))
        severityView.apply {
            text = severity.toString()
            setTextColor(ContextCompat.getColor(context, textColor))
        }
        
        // Configure dynamic elevation for enhanced visibility
        this.elevation = elevation
        
        // Apply motion-optimized ripple effect
        val stateAnimator = AnimationUtils.loadStateListAnimator(
            context,
            R.animator.card_state_list_anim
        )
        ViewCompat.setStateListAnimator(this, stateAnimator)
    }
}