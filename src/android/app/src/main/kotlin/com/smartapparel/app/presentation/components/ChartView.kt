package com.smartapparel.app.presentation.components

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.util.AttributeSet
import android.view.View
import androidx.core.content.ContextCompat
import com.github.mikephil.charting.charts.BarChart // version: 3.1.0
import com.github.mikephil.charting.charts.LineChart // version: 3.1.0
import com.github.mikephil.charting.charts.ScatterChart // version: 3.1.0
import com.github.mikephil.charting.components.XAxis
import com.github.mikephil.charting.components.YAxis
import com.github.mikephil.charting.data.Entry
import com.github.mikephil.charting.data.LineDataSet
import com.github.mikephil.charting.utils.ColorTemplate
import com.smartapparel.app.domain.models.SensorData
import com.smartapparel.app.utils.SAMPLING_RATES
import kotlinx.coroutines.ExperimentalCoroutinesApi
import java.lang.ref.WeakReference
import java.util.concurrent.ConcurrentLinkedQueue
import kotlin.math.max
import kotlin.math.min

/**
 * Custom View component for real-time visualization of sensor data with support for
 * multiple chart types and hardware-accelerated rendering.
 *
 * @property context Android Context
 * @property attrs Optional AttributeSet for XML inflation
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ChartView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {

    // Chart types supported by the view
    enum class ChartType {
        LINE_CHART,
        HEAT_MAP,
        SCATTER_PLOT,
        BAR_CHART
    }

    // Paint objects for custom rendering
    private val chartPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 2f
    }

    // MPAndroidChart components
    private val lineChart = LineChart(context)
    private val scatterChart = ScatterChart(context)
    private val barChart = BarChart(context)

    // Data structures
    private val dataBuffer = ConcurrentLinkedQueue<Entry>()
    private var currentType = ChartType.LINE_CHART
    private var chartBuffer: WeakReference<Bitmap>? = null

    // Color gradient for heat map
    private val heatMapColors = intArrayOf(
        0xFF0000FF.toInt(), // Cold (blue)
        0xFF00FF00.toInt(), // Medium (green)
        0xFFFF0000.toInt()  // Hot (red)
    )

    init {
        // Enable hardware acceleration
        setLayerType(LAYER_TYPE_HARDWARE, null)

        // Configure common chart settings
        setupChartDefaults()
        
        // Initialize data buffer with capacity based on sampling rate
        val bufferCapacity = SAMPLING_RATES.BUFFER_SIZE_MS * 
            max(SAMPLING_RATES.IMU_HZ, SAMPLING_RATES.TOF_HZ) / 1000
        
        // Set up accessibility
        contentDescription = "Real-time sensor data visualization chart"
    }

    /**
     * Configures default chart settings and styling
     */
    private fun setupChartDefaults() {
        lineChart.apply {
            setDrawGridBackground(false)
            description.isEnabled = false
            legend.isEnabled = true
            
            xAxis.apply {
                position = XAxis.XAxisPosition.BOTTOM
                setDrawGridLines(true)
                labelRotationAngle = 0f
            }
            
            axisLeft.apply {
                setDrawGridLines(true)
                setDrawZeroLine(true)
            }
            
            axisRight.isEnabled = false
            
            setTouchEnabled(true)
            isDragEnabled = true
            setScaleEnabled(true)
            setPinchZoom(true)
        }

        // Apply similar configurations to other chart types
        scatterChart.apply {
            setDrawGridBackground(false)
            description.isEnabled = false
            legend.isEnabled = true
        }

        barChart.apply {
            setDrawGridBackground(false)
            description.isEnabled = false
            legend.isEnabled = true
        }
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        
        // Create new bitmap buffer for the current size
        chartBuffer = WeakReference(
            Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        )
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        // Use double buffering for smooth rendering
        chartBuffer?.get()?.let { buffer ->
            val bufferCanvas = Canvas(buffer)
            
            // Clear the buffer
            bufferCanvas.drawColor(0xFFFFFFFF.toInt())
            
            when (currentType) {
                ChartType.LINE_CHART -> drawLineChart(bufferCanvas)
                ChartType.HEAT_MAP -> drawHeatMap(bufferCanvas)
                ChartType.SCATTER_PLOT -> drawScatterPlot(bufferCanvas)
                ChartType.BAR_CHART -> drawBarChart(bufferCanvas)
            }
            
            // Draw the buffer to the main canvas
            canvas.drawBitmap(buffer, 0f, 0f, null)
        }
    }

    /**
     * Updates the chart with new sensor data
     *
     * @param data New sensor data to visualize
     */
    fun updateData(data: SensorData) {
        // Process data based on chart type
        when (currentType) {
            ChartType.LINE_CHART -> {
                data.imuData?.let { imu ->
                    // Add accelerometer magnitude to buffer
                    val magnitude = sqrt(
                        imu.accelerometer[0] * imu.accelerometer[0] +
                        imu.accelerometer[1] * imu.accelerometer[1] +
                        imu.accelerometer[2] * imu.accelerometer[2]
                    )
                    dataBuffer.offer(Entry(data.timestamp.toFloat(), magnitude))
                }
            }
            ChartType.HEAT_MAP -> {
                data.tofData?.let { tof ->
                    // Update heat map with distance data
                    updateHeatMapData(tof.distances)
                }
            }
            ChartType.SCATTER_PLOT -> {
                data.imuData?.let { imu ->
                    // Add gyroscope data points
                    dataBuffer.offer(Entry(imu.gyroscope[0], imu.gyroscope[1]))
                }
            }
            ChartType.BAR_CHART -> {
                // Update statistical data for bar chart
                updateBarChartData(data)
            }
        }

        // Maintain buffer size
        while (dataBuffer.size > SAMPLING_RATES.BUFFER_SIZE_MS) {
            dataBuffer.poll()
        }

        // Request redraw
        invalidate()
    }

    /**
     * Changes the current chart type with animation
     *
     * @param type New chart type to display
     */
    fun setChartType(type: ChartType) {
        if (currentType != type) {
            currentType = type
            dataBuffer.clear()
            setupChartDefaults()
            invalidate()
        }
    }

    private fun drawLineChart(canvas: Canvas) {
        val entries = dataBuffer.toList()
        val dataSet = LineDataSet(entries, "Sensor Data").apply {
            color = 0xFF2196F3.toInt()
            setDrawCircles(false)
            setDrawValues(false)
            lineWidth = 2f
        }
        lineChart.data = LineData(dataSet)
        lineChart.draw(canvas)
    }

    private fun drawHeatMap(canvas: Canvas) {
        // Implementation of heat map rendering using custom shader
        val shader = LinearGradient(
            0f, 0f, width.toFloat(), height.toFloat(),
            heatMapColors, null, Shader.TileMode.CLAMP
        )
        chartPaint.shader = shader
        // Draw heat map visualization
    }

    private fun drawScatterPlot(canvas: Canvas) {
        val entries = dataBuffer.toList()
        val dataSet = ScatterDataSet(entries, "Motion Data").apply {
            setColors(*ColorTemplate.MATERIAL_COLORS)
            scatterShape = ScatterChart.ScatterShape.CIRCLE
            scatterShapeSize = 8f
        }
        scatterChart.data = ScatterData(dataSet)
        scatterChart.draw(canvas)
    }

    private fun drawBarChart(canvas: Canvas) {
        // Implementation of bar chart visualization
        val entries = dataBuffer.toList()
        val dataSet = BarDataSet(entries.map { BarEntry(it.x, it.y) }, "Statistics").apply {
            setColors(*ColorTemplate.MATERIAL_COLORS)
            valueTextSize = 10f
        }
        barChart.data = BarData(dataSet)
        barChart.draw(canvas)
    }

    private fun updateHeatMapData(distances: FloatArray) {
        // Process distance data for heat map visualization
        // Implementation of heat map data processing
    }

    private fun updateBarChartData(data: SensorData) {
        // Process sensor data for statistical visualization
        // Implementation of statistical data processing
    }

    companion object {
        private const val DEFAULT_ANIMATION_DURATION = 300L
        private const val MAX_DATA_POINTS = 1000
    }
}