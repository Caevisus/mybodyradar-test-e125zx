package com.smartapparel.app.presentation.alerts

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.DividerItemDecoration
import com.google.android.material.chip.Chip
import com.google.android.material.snackbar.Snackbar
import com.smartapparel.app.R
import com.smartapparel.app.databinding.FragmentAlertsBinding
import com.smartapparel.app.domain.models.Alert
import com.smartapparel.app.presentation.common.BaseFragment
import com.smartapparel.app.utils.Constants.ALERT_TYPES
import com.smartapparel.app.utils.Logger
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

private const val TAG = "AlertsFragment"
private const val ANIMATION_DURATION = 300L

/**
 * Fragment responsible for displaying and managing real-time alerts with Material Design 3.0
 * components and optimized performance for <100ms latency requirements.
 */
@AndroidEntryPoint
class AlertsFragment : BaseFragment<FragmentAlertsBinding, AlertsViewModel>() {

    private val viewModel: AlertsViewModel by viewModels()
    private lateinit var alertsAdapter: AlertsAdapter
    private lateinit var activeAlertsAdapter: ActiveAlertsAdapter

    override fun createViewBinding(
        inflater: LayoutInflater,
        container: ViewGroup?
    ): FragmentAlertsBinding = FragmentAlertsBinding.inflate(inflater, container, false)

    override fun setupUI() {
        Logger.d(TAG, "Setting up alerts UI components")
        
        setupRecyclerViews()
        setupSwipeRefresh()
        setupFilterChips()
        setupErrorHandling()
        setupAccessibility()
    }

    private fun setupRecyclerViews() {
        // Setup active alerts RecyclerView
        activeAlertsAdapter = ActiveAlertsAdapter(
            onDismissClick = { alert -> viewModel.dismissAlert(alert) }
        )
        binding.rvActiveAlerts.apply {
            layoutManager = LinearLayoutManager(context, LinearLayoutManager.HORIZONTAL, false)
            adapter = activeAlertsAdapter
            setHasFixedSize(true)
            itemAnimator?.changeDuration = ANIMATION_DURATION
        }

        // Setup historical alerts RecyclerView
        alertsAdapter = AlertsAdapter(
            onAlertClick = { alert -> showAlertDetails(alert) }
        )
        binding.rvAlerts.apply {
            layoutManager = LinearLayoutManager(context)
            adapter = alertsAdapter
            addItemDecoration(DividerItemDecoration(context, DividerItemDecoration.VERTICAL))
            setHasFixedSize(true)
        }
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefreshLayout.apply {
            setColorSchemeResources(
                R.color.colorPrimary,
                R.color.colorSecondary,
                R.color.colorTertiary
            )
            setOnRefreshListener { viewModel.refresh() }
        }
    }

    private fun setupFilterChips() {
        binding.chipGroupAlertTypes.apply {
            ALERT_TYPES::class.sealedSubclasses.forEach { alertType ->
                addView(createFilterChip(alertType.simpleName))
            }
            setOnCheckedStateChangeListener { group, _ ->
                val selectedTypes = group.checkedChipIds.mapNotNull { id ->
                    group.findViewById<Chip>(id)?.text?.toString()
                }
                viewModel.loadAlerts(0) // Refresh with new filters
            }
        }
    }

    private fun createFilterChip(label: String): Chip =
        Chip(requireContext()).apply {
            text = label
            isCheckable = true
            isCheckedIconVisible = true
            setChipBackgroundColorResource(R.color.chip_background_color)
            setTextAppearanceResource(R.style.TextAppearance_MaterialComponents_Chip)
            contentDescription = "Filter alerts by $label"
        }

    private fun setupErrorHandling() {
        binding.errorView.apply {
            retryButton.setOnClickListener {
                viewModel.refresh()
            }
        }
    }

    private fun setupAccessibility() {
        binding.rvActiveAlerts.contentDescription = "Active alerts list"
        binding.rvAlerts.contentDescription = "Historical alerts list"
        binding.chipGroupAlertTypes.contentDescription = "Alert type filters"
    }

    override fun setupObservers() {
        Logger.d(TAG, "Setting up alerts data observers")

        // Observe active alerts
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.activeAlerts.collectLatest { alerts ->
                activeAlertsAdapter.submitList(alerts)
                updateActiveAlertsVisibility(alerts)
            }
        }

        // Observe paginated alerts
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.alerts.collectLatest { paginatedAlerts ->
                alertsAdapter.submitList(paginatedAlerts.alerts)
                updateEmptyState(paginatedAlerts.alerts.isEmpty())
            }
        }

        // Observe refresh state
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.isRefreshing.collectLatest { isRefreshing ->
                binding.swipeRefreshLayout.isRefreshing = isRefreshing
            }
        }

        // Observe loading state
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.isLoading.collectLatest { isLoading ->
                binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
            }
        }
    }

    private fun updateActiveAlertsVisibility(alerts: List<Alert>) {
        binding.activeAlertsContainer.visibility = if (alerts.isEmpty()) {
            View.GONE
        } else {
            View.VISIBLE
        }
    }

    private fun updateEmptyState(isEmpty: Boolean) {
        binding.emptyView.visibility = if (isEmpty) View.VISIBLE else View.GONE
        binding.rvAlerts.visibility = if (isEmpty) View.GONE else View.VISIBLE
    }

    private fun showAlertDetails(alert: Alert) {
        // Navigate to alert details screen
        findNavController().navigate(
            AlertsFragmentDirections.actionAlertsToAlertDetails(alert)
        )
    }

    override fun handleErrorRetry() {
        viewModel.refresh()
    }

    companion object {
        fun newInstance() = AlertsFragment()
    }
}