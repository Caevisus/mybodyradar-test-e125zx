package com.smartapparel.app.presentation.components

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import android.animation.ValueAnimator
import android.graphics.drawable.GradientDrawable
import android.view.animation.DecelerateInterpolator
import com.github.mikephil.charting.animation.Easing // version: 3.1.0
import com.smartapparel.app.domain.models.SensorData
import com.smartapparel.app.utils.SAMPLING_RATES
import kotlin.math.max
import kotlin.math.min

/**
 * Custom View component for rendering real-time heat map visualizations of muscle activity
 * and force distribution from sensor data. Supports both 2D and 3D visualization modes
 * with interactive gestures and optimized performance through double buffering.
 */
class HeatMapView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {

    private val mainPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        isFilterBitmap = true
        isDither = true
    }

    private val bufferPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private var backBuffer: Bitmap? = null
    private val transformMatrix = Matrix()
    private var dataMatrix = FloatArray(DEFAULT_RESOLUTION * DEFAULT_RESOLUTION)
    private var is3DMode = false
    private var rotationAngle = 0f
    private var resolution = DEFAULT_RESOLUTION
    private var scale = 1f
    private var translateX = 0f
    private var translateY = 0f

    private val colorGradient = ColorGradient()
    private var lastFrameTime = 0L
    private var frameInterval = 1000L / SAMPLING_RATES.TOF_HZ

    private val gestureDetector = GestureDetector(context, GestureListener())
    private val scaleDetector = ScaleGestureDetector(context, ScaleListener())
    private var transitionAnimator: ValueAnimator? = null

    init {
        // Enable hardware acceleration for better performance
        setLayerType(LAYER_TYPE_HARDWARE, null)
        
        // Initialize transition animator
        transitionAnimator = ValueAnimator().apply {
            duration = TRANSITION_DURATION
            interpolator = DecelerateInterpolator()
        }
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        // Create new back buffer when size changes
        backBuffer?.recycle()
        backBuffer = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    }

    override fun onDraw(canvas: Canvas) {
        val currentTime = System.nanoTime()
        if (currentTime - lastFrameTime < frameInterval * 1_000_000) {
            return // Skip frame if not enough time has passed
        }

        backBuffer?.let { buffer ->
            val bufferCanvas = Canvas(buffer)
            bufferCanvas.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR)

            // Apply transformations
            bufferCanvas.save()
            bufferCanvas.concat(transformMatrix)

            // Draw heat map cells
            val cellWidth = width.toFloat() / resolution
            val cellHeight = height.toFloat() / resolution

            for (i in 0 until resolution) {
                for (j in 0 until resolution) {
                    val value = dataMatrix[i * resolution + j]
                    mainPaint.color = colorGradient.getColor(value)
                    
                    val left = j * cellWidth
                    val top = i * cellHeight
                    
                    if (is3DMode) {
                        draw3DCell(bufferCanvas, left, top, cellWidth, cellHeight, value)
                    } else {
                        bufferCanvas.drawRect(
                            left, top,
                            left + cellWidth, top + cellHeight,
                            mainPaint
                        )
                    }
                }
            }

            bufferCanvas.restore()

            // Draw legend
            drawLegend(bufferCanvas)

            // Copy back buffer to screen
            canvas.drawBitmap(buffer, 0f, 0f, bufferPaint)
        }

        lastFrameTime = currentTime
    }

    /**
     * Updates the heat map with new sensor data, applying smooth transitions
     */
    fun updateData(sensorData: SensorData) {
        sensorData.tofData?.let { tofData ->
            val newData = processToFData(tofData.distances)
            animateDataTransition(newData)
        }

        sensorData.imuData?.let { imuData ->
            // Combine IMU data for enhanced visualization
            updateIMUOverlay(imuData)
        }

        invalidate()
    }

    /**
     * Sets the visualization mode (2D or 3D)
     */
    fun setVisualizationMode(enable3D: Boolean) {
        if (is3DMode != enable3D) {
            is3DMode = enable3D
            animateTransition()
        }
    }

    private fun draw3DCell(
        canvas: Canvas,
        left: Float,
        top: Float,
        width: Float,
        height: Float,
        value: Float
    ) {
        val path = Path()
        val elevation = value * MAX_ELEVATION

        // Draw base
        path.moveTo(left, top)
        path.lineTo(left + width, top)
        path.lineTo(left + width, top + height)
        path.lineTo(left, top + height)
        path.close()

        // Draw elevated surface with perspective
        val perspectiveOffset = elevation * PERSPECTIVE_FACTOR
        path.moveTo(left, top)
        path.lineTo(left + perspectiveOffset, top - elevation)
        path.lineTo(left + width + perspectiveOffset, top - elevation)
        path.lineTo(left + width, top)
        path.close()

        canvas.drawPath(path, mainPaint)
    }

    private fun drawLegend(canvas: Canvas) {
        val legendWidth = width * 0.1f
        val legendHeight = height * 0.8f
        val legendX = width - legendWidth * 1.5f
        val legendY = height * 0.1f

        // Draw gradient legend
        val gradient = GradientDrawable(
            GradientDrawable.Orientation.BOTTOM_TOP,
            colorGradient.getGradientColors()
        )
        gradient.bounds = RectF(
            legendX,
            legendY,
            legendX + legendWidth,
            legendY + legendHeight
        ).toRect()
        gradient.draw(canvas)

        // Draw labels
        mainPaint.textSize = legendWidth * 0.4f
        mainPaint.color = Color.BLACK
        canvas.drawText("Max", legendX + legendWidth * 1.2f, legendY, mainPaint)
        canvas.drawText("Min", legendX + legendWidth * 1.2f, legendY + legendHeight, mainPaint)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        scaleDetector.onTouchEvent(event)
        gestureDetector.onTouchEvent(event)
        return true
    }

    private inner class ScaleListener : ScaleGestureDetector.SimpleOnScaleGestureListener() {
        override fun onScale(detector: ScaleGestureDetector): Boolean {
            scale *= detector.scaleFactor
            scale = scale.coerceIn(MIN_SCALE, MAX_SCALE)
            updateTransformMatrix()
            return true
        }
    }

    private inner class GestureListener : GestureDetector.SimpleOnGestureListener() {
        override fun onScroll(
            e1: MotionEvent?,
            e2: MotionEvent,
            distanceX: Float,
            distanceY: Float
        ): Boolean {
            translateX -= distanceX
            translateY -= distanceY
            updateTransformMatrix()
            return true
        }

        override fun onDoubleTap(e: MotionEvent): Boolean {
            if (is3DMode) {
                rotationAngle = (rotationAngle + 90f) % 360f
                updateTransformMatrix()
            }
            return true
        }
    }

    private fun updateTransformMatrix() {
        transformMatrix.reset()
        transformMatrix.postTranslate(translateX, translateY)
        transformMatrix.postScale(scale, scale)
        if (is3DMode) {
            transformMatrix.postRotate(rotationAngle, width / 2f, height / 2f)
        }
        invalidate()
    }

    private fun animateDataTransition(newData: FloatArray) {
        transitionAnimator?.cancel()
        transitionAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = TRANSITION_DURATION
            interpolator = DecelerateInterpolator()
            addUpdateListener { animator ->
                val fraction = animator.animatedValue as Float
                for (i in dataMatrix.indices) {
                    dataMatrix[i] = dataMatrix[i] * (1 - fraction) + newData[i] * fraction
                }
                invalidate()
            }
            start()
        }
    }

    private fun processToFData(distances: FloatArray): FloatArray {
        // Convert raw distances to normalized heat map values
        return FloatArray(resolution * resolution) { index ->
            val distance = distances.getOrNull(index) ?: 0f
            normalizeValue(distance)
        }
    }

    private fun normalizeValue(value: Float): Float {
        return (value - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE)
            .coerceIn(0f, 1f)
    }

    companion object {
        private const val DEFAULT_RESOLUTION = 32
        private const val TRANSITION_DURATION = 150L
        private const val MIN_SCALE = 0.5f
        private const val MAX_SCALE = 3.0f
        private const val MAX_ELEVATION = 100f
        private const val PERSPECTIVE_FACTOR = 0.5f
        private const val MIN_DISTANCE = 0f
        private const val MAX_DISTANCE = 1000f
    }
}

/**
 * Helper class for managing color gradients in the heat map
 */
private class ColorGradient {
    private val colors = intArrayOf(
        Color.rgb(0, 0, 255),    // Cold (blue)
        Color.rgb(0, 255, 255),  // Cyan
        Color.rgb(0, 255, 0),    // Green
        Color.rgb(255, 255, 0),  // Yellow
        Color.rgb(255, 0, 0)     // Hot (red)
    )

    fun getColor(value: Float): Int {
        val normalizedValue = value.coerceIn(0f, 1f)
        val position = normalizedValue * (colors.size - 1)
        val index = position.toInt()
        val fraction = position - index

        return if (index == colors.size - 1) {
            colors.last()
        } else {
            interpolateColor(colors[index], colors[index + 1], fraction)
        }
    }

    fun getGradientColors(): IntArray = colors

    private fun interpolateColor(startColor: Int, endColor: Int, fraction: Float): Int {
        val startA = Color.alpha(startColor)
        val startR = Color.red(startColor)
        val startG = Color.green(startColor)
        val startB = Color.blue(startColor)

        val endA = Color.alpha(endColor)
        val endR = Color.red(endColor)
        val endG = Color.green(endColor)
        val endB = Color.blue(endColor)

        return Color.argb(
            (startA + (endA - startA) * fraction).toInt(),
            (startR + (endR - startR) * fraction).toInt(),
            (startG + (endG - startG) * fraction).toInt(),
            (startB + (endB - startB) * fraction).toInt()
        )
    }
}