package com.smartapparel.app.presentation.team

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.card.MaterialCardView // version: 1.9.0
import com.google.android.material.dialog.MaterialAlertDialogBuilder // version: 1.9.0
import com.smartapparel.app.databinding.FragmentTeamBinding
import com.smartapparel.app.presentation.common.BaseFragment
import com.smartapparel.app.domain.models.Team
import com.smartapparel.security.SecurityManager // version: 1.0.0
import com.smartapparel.app.utils.Logger
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

private const val TAG = "TeamFragment"
private const val UPDATE_INTERVAL = 100L // 100ms for real-time updates
private const val ANALYTICS_BATCH_SIZE = 50

/**
 * Fragment for displaying and managing team information with real-time analytics
 * and secure data sharing capabilities.
 */
@AndroidEntryPoint
class TeamFragment : BaseFragment<FragmentTeamBinding, TeamViewModel>() {

    @Inject
    lateinit var securityManager: SecurityManager

    private val teamViewModel: TeamViewModel by viewModels()
    override val viewModel: TeamViewModel get() = teamViewModel

    private lateinit var teamAdapter: TeamListAdapter
    private lateinit var analyticsRenderer: AnalyticsRenderer
    private var updateJob: Job? = null

    override fun createViewBinding(
        inflater: LayoutInflater,
        container: ViewGroup?
    ): FragmentTeamBinding {
        return FragmentTeamBinding.inflate(inflater, container, false)
    }

    override fun setupUI() {
        Logger.d(TAG, "Setting up team fragment UI")

        // Initialize RecyclerView with efficient view recycling
        binding.teamRecyclerView.apply {
            layoutManager = LinearLayoutManager(context)
            setHasFixedSize(true)
            teamAdapter = TeamListAdapter(
                onTeamSelected = { team -> handleTeamSelection(team.id) },
                onTeamShared = { team -> handleTeamSharing(team) }
            )
            adapter = teamAdapter
        }

        // Setup pull-to-refresh with team colors
        binding.swipeRefreshLayout.apply {
            setColorSchemeResources(R.color.team_primary, R.color.team_secondary)
            setOnRefreshListener {
                viewModel.loadTeams()
            }
        }

        // Initialize analytics dashboard
        binding.analyticsContainer.apply {
            analyticsRenderer = AnalyticsRenderer(this)
            setOnClickListener {
                expandAnalytics()
            }
        }

        // Setup sharing controls with security
        binding.shareButton.apply {
            isEnabled = false
            setOnClickListener {
                viewModel.selectedTeam.value?.let { team ->
                    handleTeamSharing(team)
                }
            }
        }

        // Initialize error handling UI
        binding.errorView.apply {
            retryButton.setOnClickListener {
                viewModel.loadTeams()
            }
        }
    }

    override fun setupObservers() {
        Logger.d(TAG, "Setting up team fragment observers")

        // Observe teams list
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.teams.collectLatest { teams ->
                Logger.d(TAG, "Teams updated", mapOf("count" to teams.size))
                teamAdapter.submitList(teams)
                binding.swipeRefreshLayout.isRefreshing = false
            }
        }

        // Observe selected team
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.selectedTeam.collectLatest { team ->
                team?.let {
                    Logger.d(TAG, "Team selected", mapOf("teamId" to it.id))
                    updateTeamUI(it)
                    startAnalyticsUpdates()
                } ?: run {
                    binding.shareButton.isEnabled = false
                    stopAnalyticsUpdates()
                }
            }
        }

        // Observe loading state
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.isLoading.collectLatest { isLoading ->
                binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
            }
        }

        // Initial data load
        viewModel.loadTeams()
    }

    private fun handleTeamSelection(teamId: String) {
        Logger.d(TAG, "Handling team selection", mapOf("teamId" to teamId))
        
        if (securityManager.hasTeamAccess(teamId)) {
            viewModel.selectTeam(teamId)
            binding.shareButton.isEnabled = true
        } else {
            showError("Access denied to team")
        }
    }

    private fun handleTeamSharing(team: Team) {
        Logger.d(TAG, "Handling team sharing", mapOf("teamId" to team.id))

        MaterialAlertDialogBuilder(requireContext())
            .setTitle(R.string.share_team_data)
            .setMultiChoiceItems(
                R.array.share_options,
                null
            ) { _, _, _ -> }
            .setPositiveButton(R.string.share) { dialog, _ ->
                if (securityManager.canShareTeamData(team.id)) {
                    viewModel.shareTeamData(team)
                } else {
                    showError("Insufficient permissions to share team data")
                }
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun startAnalyticsUpdates() {
        Logger.d(TAG, "Starting analytics updates")
        
        updateJob?.cancel()
        updateJob = viewLifecycleOwner.lifecycleScope.launch {
            while (true) {
                viewModel.selectedTeam.value?.let { team ->
                    analyticsRenderer.updateAnalytics(
                        team,
                        ANALYTICS_BATCH_SIZE
                    )
                }
                kotlinx.coroutines.delay(UPDATE_INTERVAL)
            }
        }
    }

    private fun stopAnalyticsUpdates() {
        Logger.d(TAG, "Stopping analytics updates")
        updateJob?.cancel()
        updateJob = null
    }

    private fun updateTeamUI(team: Team) {
        binding.apply {
            teamNameText.text = team.name
            memberCountText.text = team.athleteIds.size.toString()
            lastUpdatedText.text = formatDateTime(team.updatedAt)
            analyticsContainer.visibility = View.VISIBLE
        }
    }

    private fun expandAnalytics() {
        // Implement analytics expansion animation
        binding.analyticsContainer.apply {
            val params = layoutParams
            params.height = ViewGroup.LayoutParams.MATCH_PARENT
            layoutParams = params
        }
    }

    override fun onDestroyView() {
        stopAnalyticsUpdates()
        super.onDestroyView()
    }

    companion object {
        fun newInstance() = TeamFragment()
    }
}