package com.smartapparel.app.presentation.dashboard

import android.os.Bundle // version: API 29+
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.viewmodels // version: 1.6.1
import androidx.lifecycle.lifecycleScope // version: 2.6.1
import androidx.lifecycle.repeatOnLifecycle // version: 2.6.1
import androidx.lifecycle.Lifecycle
import com.google.android.material.card.MaterialCardView // version: 1.9.0
import com.smartapparel.app.R
import com.smartapparel.app.databinding.FragmentDashboardBinding
import com.smartapparel.app.presentation.common.BaseFragment
import com.smartapparel.app.domain.models.SensorData
import com.smartapparel.app.presentation.components.HeatMapView
import com.smartapparel.app.utils.Constants.ALERT_SEVERITY
import com.smartapparel.app.utils.Logger
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch // version: 1.7.1
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.delay
import io.reactivex.rxjava3.disposables.CompositeDisposable
import android.view.animation.AnimationUtils
import android.graphics.Color
import android.widget.Toast
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

private const val TAG = "DashboardFragment"
private const val METRICS_UPDATE_INTERVAL = 100L // 100ms for real-time updates
private const val ANIMATION_DURATION = 300L
private const val MAX_ALERTS_DISPLAYED = 5

@AndroidEntryPoint
class DashboardFragment : BaseFragment<FragmentDashboardBinding, DashboardViewModel>() {

    override val viewModel: DashboardViewModel by viewModels()
    private var dataCollectionJob: Job? = null
    private val disposables = CompositeDisposable()
    
    private var is3DMode = false
    private var lastUpdateTime = 0L

    override fun createViewBinding(
        inflater: LayoutInflater,
        container: ViewGroup?
    ): FragmentDashboardBinding {
        return FragmentDashboardBinding.inflate(inflater, container, false)
    }

    override fun setupUI() {
        Logger.d(TAG, "Setting up Dashboard UI components")
        
        with(binding) {
            // Configure HeatMapView
            heatMapView.apply {
                setVisualizationMode(is3DMode)
                contentDescription = getString(R.string.heatmap_content_description)
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
            }

            // Configure visualization mode toggle
            visualizationModeSwitch.apply {
                setOnCheckedChangeListener { _, isChecked ->
                    is3DMode = isChecked
                    heatMapView.setVisualizationMode(isChecked)
                    Logger.d(TAG, "Visualization mode changed to 3D: $isChecked")
                }
                contentDescription = getString(R.string.visualization_mode_switch_description)
            }

            // Configure performance metrics cards
            setupMetricsCards()

            // Configure alerts recycler view
            alertsRecyclerView.apply {
                adapter = AlertsAdapter { alert ->
                    handleAlertClick(alert)
                }
                itemAnimator = SlideInAnimator().apply {
                    addDuration = ANIMATION_DURATION
                    removeDuration = ANIMATION_DURATION
                }
            }

            // Configure pull-to-refresh
            swipeRefreshLayout.apply {
                setOnRefreshListener {
                    refreshDashboard()
                }
                setColorSchemeResources(R.color.primary)
            }

            // Configure error handling UI
            errorLayout.apply {
                retryButton.setOnClickListener {
                    refreshDashboard()
                }
            }
        }
    }

    override fun setupObservers() {
        Logger.d(TAG, "Setting up Dashboard data observers")

        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                // Collect sensor data updates
                launch {
                    viewModel.sensorData.collectLatest { sensorData ->
                        updateHeatMap(sensorData)
                    }
                }

                // Collect performance metrics updates
                launch {
                    viewModel.performanceMetrics.collectLatest { metrics ->
                        updateMetricsCards(metrics)
                    }
                }

                // Collect alerts
                launch {
                    viewModel.alerts.collectLatest { alerts ->
                        updateAlerts(alerts)
                    }
                }

                // Collect compression stats
                launch {
                    viewModel.compressionStats.collectLatest { stats ->
                        updateCompressionInfo(stats)
                    }
                }
            }
        }
    }

    private fun updateHeatMap(sensorData: List<SensorData>) {
        val currentTime = System.currentTimeMillis()
        if (currentTime - lastUpdateTime >= METRICS_UPDATE_INTERVAL) {
            binding.heatMapView.updateData(sensorData.lastOrNull() ?: return)
            lastUpdateTime = currentTime
        }
    }

    private fun setupMetricsCards() {
        with(binding) {
            // Configure each metric card with proper accessibility
            listOf(
                forceMetricCard,
                balanceMetricCard,
                symmetryMetricCard,
                rangeMetricCard
            ).forEach { card ->
                setupMetricCard(card)
            }
        }
    }

    private fun setupMetricCard(card: MaterialCardView) {
        card.apply {
            // Add elevation animation on touch
            setOnTouchListener { view, event ->
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        animate()
                            .scaleX(1.05f)
                            .scaleY(1.05f)
                            .setDuration(ANIMATION_DURATION)
                            .start()
                    }
                    MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                        animate()
                            .scaleX(1f)
                            .scaleY(1f)
                            .setDuration(ANIMATION_DURATION)
                            .start()
                    }
                }
                false
            }

            // Configure accessibility
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
            contentDescription = "${card.tag} metric card"
        }
    }

    private fun updateMetricsCards(metrics: Map<String, Float>) {
        with(binding) {
            metrics.forEach { (metric, value) ->
                when (metric) {
                    "peak_force" -> updateMetricCard(
                        forceMetricCard,
                        value,
                        getString(R.string.force_metric_format)
                    )
                    "balance_ratio" -> updateMetricCard(
                        balanceMetricCard,
                        value,
                        getString(R.string.balance_metric_format)
                    )
                    "movement_symmetry" -> updateMetricCard(
                        symmetryMetricCard,
                        value,
                        getString(R.string.symmetry_metric_format)
                    )
                    "movement_range" -> updateMetricCard(
                        rangeMetricCard,
                        value,
                        getString(R.string.range_metric_format)
                    )
                }
            }
        }
    }

    private fun updateMetricCard(card: MaterialCardView, value: Float, format: String) {
        card.apply {
            val formattedValue = String.format(format, value)
            findViewById<TextView>(R.id.metricValue).text = formattedValue
            contentDescription = "$formattedValue ${card.tag}"
        }
    }

    private fun updateAlerts(alerts: List<Alert>) {
        val sortedAlerts = alerts
            .sortedByDescending { it.severity }
            .take(MAX_ALERTS_DISPLAYED)

        (binding.alertsRecyclerView.adapter as? AlertsAdapter)?.submitList(sortedAlerts)

        // Update accessibility announcement for critical alerts
        alerts.firstOrNull { it.severity == ALERT_SEVERITY.CRITICAL }?.let { criticalAlert ->
            announceForAccessibility(getString(R.string.critical_alert_announcement, criticalAlert.message))
        }
    }

    private fun handleAlertClick(alert: Alert) {
        // Show detailed alert dialog
        AlertDetailDialog.newInstance(alert).show(childFragmentManager, "alert_detail")
    }

    private fun refreshDashboard() {
        binding.swipeRefreshLayout.isRefreshing = true
        viewModel.refreshData()
    }

    private fun updateCompressionInfo(stats: DashboardViewModel.CompressionStats) {
        binding.compressionInfoText.text = getString(
            R.string.compression_info_format,
            stats.ratio,
            stats.avgLatencyMs
        )
    }

    override fun handleErrorRetry() {
        refreshDashboard()
    }

    override fun onDestroyView() {
        dataCollectionJob?.cancel()
        disposables.clear()
        super.onDestroyView()
    }

    companion object {
        fun newInstance() = DashboardFragment()
    }
}