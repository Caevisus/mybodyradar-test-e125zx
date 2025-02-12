package com.smartapparel.app.presentation.components

import android.content.Context
import android.util.AttributeSet
import android.view.LayoutInflater
import android.view.View
import android.widget.TextView
import androidx.constraintlayout.widget.ConstraintLayout
import androidx.core.view.ViewCompat
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat
import androidx.core.view.accessibility.AccessibilityDelegateCompat
import com.google.android.material.progressindicator.CircularProgressIndicator
import com.google.android.material.shape.MaterialShapeDrawable
import com.google.android.material.elevation.ElevationOverlayProvider
import com.smartapparel.app.R

/**
 * A Material Design 3.0 compliant loading indicator component with accessibility support.
 * Implements smooth animations, dynamic elevation, and proper screen reader announcements.
 *
 * @property context The view context
 * @property attrs Optional XML attributes
 * @property defStyleAttr Default style attribute
 */
class LoadingView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : ConstraintLayout(context, attrs, defStyleAttr) {

    private val progressIndicator: CircularProgressIndicator
    private val messageView: TextView
    private var isVisible: Boolean = false
    private val backgroundDrawable: MaterialShapeDrawable
    private val elevationOverlayProvider: ElevationOverlayProvider
    private val defaultElevation: Float
    private val animationDuration: Long

    private val accessibilityDelegate = object : AccessibilityDelegateCompat() {
        override fun onInitializeAccessibilityNodeInfo(
            host: View,
            info: AccessibilityNodeInfoCompat
        ) {
            super.onInitializeAccessibilityNodeInfo(host, info)
            info.isHeading = true
            info.roleDescription = context.getString(R.string.loading_view_role_description)
        }
    }

    init {
        // Inflate layout
        LayoutInflater.from(context).inflate(R.layout.view_loading, this, true)

        // Initialize animation duration from resources
        animationDuration = context.resources.getInteger(R.integer.loading_animation_duration).toLong()
        
        // Setup elevation
        elevationOverlayProvider = ElevationOverlayProvider(context)
        defaultElevation = resources.getDimension(R.dimen.loading_view_elevation)

        // Initialize background
        backgroundDrawable = MaterialShapeDrawable().apply {
            fillColor = elevationOverlayProvider.compositeOverlayWithThemeSurfaceColorIfNeeded(
                defaultElevation
            )
            elevation = defaultElevation
            alpha = 0
        }
        background = backgroundDrawable

        // Initialize progress indicator
        progressIndicator = findViewById<CircularProgressIndicator>(R.id.progress_indicator).apply {
            setIndicatorColor(context.getColor(R.color.loading_indicator_color))
            trackCornerRadius = resources.getDimensionPixelSize(R.dimen.loading_indicator_corner_radius)
            isIndeterminate = true
            hide()
        }

        // Initialize message view
        messageView = findViewById<TextView>(R.id.message_view).apply {
            setTextAppearance(R.style.TextAppearance_SmartApparel_Loading)
        }

        // Set initial visibility
        visibility = View.GONE
        isVisible = false

        // Setup accessibility
        ViewCompat.setAccessibilityDelegate(this, accessibilityDelegate)
        ViewCompat.setAccessibilityLiveRegion(
            this,
            ViewCompat.ACCESSIBILITY_LIVE_REGION_POLITE
        )
    }

    /**
     * Shows the loading indicator with optional message.
     * Implements smooth animation and proper accessibility announcements.
     *
     * @param message Optional message to display
     */
    fun show(message: String? = null) {
        if (isVisible) return

        // Update message if provided
        message?.let { setMessage(it) }

        // Cancel any ongoing animations
        animate().cancel()

        // Show with animation
        visibility = View.VISIBLE
        animate()
            .alpha(1f)
            .setDuration(animationDuration)
            .withStartAction {
                progressIndicator.show()
                backgroundDrawable.elevation = defaultElevation
            }
            .withEndAction {
                isVisible = true
                // Announce to screen readers
                announceForAccessibility(
                    context.getString(
                        R.string.loading_view_announcement,
                        messageView.text
                    )
                )
            }
            .start()
    }

    /**
     * Hides the loading indicator with smooth animation.
     */
    fun hide() {
        if (!isVisible) return

        // Cancel any ongoing animations
        animate().cancel()

        // Hide with animation
        animate()
            .alpha(0f)
            .setDuration(animationDuration)
            .withStartAction {
                progressIndicator.hide()
                backgroundDrawable.elevation = 0f
            }
            .withEndAction {
                visibility = View.GONE
                isVisible = false
                messageView.text = ""
                // Announce completion to screen readers
                announceForAccessibility(
                    context.getString(R.string.loading_view_completion_announcement)
                )
            }
            .start()
    }

    /**
     * Updates the loading message with accessibility announcement.
     *
     * @param message The new message to display
     */
    fun setMessage(message: String) {
        messageView.text = message
        contentDescription = message
        if (isVisible) {
            // Announce message change to screen readers
            announceForAccessibility(
                context.getString(
                    R.string.loading_view_message_changed_announcement,
                    message
                )
            )
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        
        // Setup dynamic color observer
        ViewCompat.setOnApplyWindowInsetsListener(this) { _, insets ->
            backgroundDrawable.fillColor = elevationOverlayProvider
                .compositeOverlayWithThemeSurfaceColorIfNeeded(defaultElevation)
            insets
        }
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        
        // Clear animations and listeners
        animate().cancel()
        ViewCompat.setOnApplyWindowInsetsListener(this, null)
    }
}