package com.smartapparel.app.presentation.profile

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.view.AccessibilityDelegateCompat
import androidx.core.view.ViewCompat
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.work.WorkManager
import com.smartapparel.app.R
import com.smartapparel.app.databinding.FragmentProfileBinding
import com.smartapparel.app.domain.models.Athlete
import com.smartapparel.app.domain.models.BaselineData
import com.smartapparel.app.presentation.common.BaseFragment
import com.smartapparel.app.utils.Logger
import com.smartapparel.app.utils.SecurityUtils
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.concurrent.TimeUnit
import javax.inject.Inject

private const val TAG = "ProfileFragment"
private const val SYNC_WORK_NAME = "profile_sync_work"
private const val SYNC_INTERVAL_MS = 300000L // 5 minutes
private const val DATE_FORMAT_PATTERN = "MMM dd, yyyy HH:mm"

/**
 * Fragment responsible for displaying and managing athlete profile information
 * with enhanced security, accessibility support, and offline capabilities.
 */
@AndroidEntryPoint
class ProfileFragment : BaseFragment<FragmentProfileBinding, ProfileViewModel>() {

    @Inject
    lateinit var securityUtils: SecurityUtils

    override val viewModel: ProfileViewModel by viewModels()
    private lateinit var workManager: WorkManager
    private val dateFormatter = SimpleDateFormat(DATE_FORMAT_PATTERN, Locale.getDefault())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        workManager = WorkManager.getInstance(requireContext())
        setupPeriodicSync()
    }

    override fun createViewBinding(
        inflater: LayoutInflater,
        container: ViewGroup?
    ): FragmentProfileBinding {
        return FragmentProfileBinding.inflate(inflater, container, false)
    }

    override fun setupUI() {
        setupAccessibility()
        setupProfileControls()
        setupSyncIndicator()
        setupErrorHandling()
    }

    override fun setupObservers() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collectLatest { state ->
                handleLoadingState(state.isLoading)
                state.athlete?.let { updateProfileData(it) }
                state.error?.let { showError(it) }
                updateSyncStatus(state.isSyncing, state.lastSyncTimestamp)
            }
        }
    }

    private fun setupAccessibility() {
        with(binding) {
            // Profile section
            ViewCompat.setAccessibilityDelegate(profileSection, object : AccessibilityDelegateCompat() {
                override fun onInitializeAccessibilityNodeInfo(
                    host: View,
                    info: AccessibilityNodeInfoCompat
                ) {
                    super.onInitializeAccessibilityNodeInfo(host, info)
                    info.roleDescription = "Profile information section"
                    info.isHeading = true
                }
            })

            // Baseline data section
            ViewCompat.setAccessibilityDelegate(baselineSection, object : AccessibilityDelegateCompat() {
                override fun onInitializeAccessibilityNodeInfo(
                    host: View,
                    info: AccessibilityNodeInfoCompat
                ) {
                    super.onInitializeAccessibilityNodeInfo(host, info)
                    info.roleDescription = "Baseline measurements section"
                    info.isHeading = true
                }
            })
        }
    }

    private fun setupProfileControls() {
        with(binding) {
            // Edit profile button
            editProfileButton.setOnClickListener {
                Logger.d(TAG, "Edit profile button clicked")
                // Navigate to edit profile screen
                // Implementation details based on navigation requirements
            }

            // Update baseline button
            updateBaselineButton.setOnClickListener {
                Logger.d(TAG, "Update baseline button clicked")
                // Show baseline update dialog
                showBaselineUpdateDialog()
            }

            // Sync button
            syncButton.setOnClickListener {
                Logger.d(TAG, "Manual sync triggered")
                viewModel.uiState.value.athlete?.let { athlete ->
                    forceSyncProfile(athlete.id)
                }
            }
        }
    }

    private fun setupSyncIndicator() {
        with(binding) {
            syncStatusIndicator.apply {
                contentDescription = "Sync status indicator"
                ViewCompat.setAccessibilityLiveRegion(
                    this,
                    ViewCompat.ACCESSIBILITY_LIVE_REGION_POLITE
                )
            }
        }
    }

    private fun setupErrorHandling() {
        binding.errorContainer.apply {
            visibility = View.GONE
            retryButton.setOnClickListener {
                Logger.d(TAG, "Retry button clicked")
                viewModel.resetError()
                viewModel.uiState.value.athlete?.let { athlete ->
                    viewModel.loadAthleteProfile(athlete.id)
                }
            }
        }
    }

    private fun updateProfileData(athlete: Athlete) {
        with(binding) {
            // Update profile information with security checks
            try {
                val decryptedName = securityUtils.decryptData(athlete.name.toByteArray())
                val decryptedEmail = securityUtils.decryptData(athlete.email.toByteArray())

                profileName.text = String(decryptedName)
                profileEmail.text = String(decryptedEmail)
                
                // Update baseline data
                updateBaselineDisplay(athlete.baselineData)
                
                // Update last modified timestamp
                lastModifiedText.text = dateFormatter.format(athlete.updatedAt)
                
                // Update accessibility labels
                updateAccessibilityLabels(athlete)
                
            } catch (e: Exception) {
                Logger.e(TAG, "Error decrypting profile data", e)
                showError("Error displaying profile data")
            }
        }
    }

    private fun updateBaselineDisplay(baselineData: BaselineData) {
        with(binding) {
            // Display muscle profiles
            muscleProfilesContainer.removeAllViews()
            baselineData.muscleProfiles.forEach { (muscle, activation) ->
                // Add muscle profile view
                // Implementation details based on UI requirements
            }

            // Display range of motion
            rangeOfMotionContainer.removeAllViews()
            baselineData.rangeOfMotion.forEach { (joint, range) ->
                // Add range of motion view
                // Implementation details based on UI requirements
            }

            // Display force distribution
            forceDistributionContainer.removeAllViews()
            baselineData.forceDistribution.forEach { (region, force) ->
                // Add force distribution view
                // Implementation details based on UI requirements
            }
        }
    }

    private fun updateAccessibilityLabels(athlete: Athlete) {
        with(binding) {
            profileSection.contentDescription = "Profile section for ${athlete.name}"
            baselineSection.contentDescription = 
                "Baseline measurements last updated ${dateFormatter.format(athlete.baselineData.lastUpdated)}"
        }
    }

    private fun updateSyncStatus(isSyncing: Boolean, lastSyncTimestamp: Long) {
        with(binding) {
            syncStatusIndicator.isActivated = isSyncing
            
            val syncTimeText = if (lastSyncTimestamp > 0) {
                "Last synced: ${dateFormatter.format(lastSyncTimestamp)}"
            } else {
                "Not synced yet"
            }
            
            syncStatusText.text = syncTimeText
            syncStatusIndicator.contentDescription = 
                if (isSyncing) "Syncing profile data" else syncTimeText
        }
    }

    private fun setupPeriodicSync() {
        // Cancel any existing sync work
        workManager.cancelUniqueWork(SYNC_WORK_NAME)

        // Setup new periodic sync
        val syncRequest = androidx.work.PeriodicWorkRequestBuilder<ProfileSyncWorker>(
            SYNC_INTERVAL_MS,
            TimeUnit.MILLISECONDS
        ).build()

        workManager.enqueueUniquePeriodicWork(
            SYNC_WORK_NAME,
            androidx.work.ExistingPeriodicWorkPolicy.REPLACE,
            syncRequest
        )
    }

    private fun forceSyncProfile(athleteId: String) {
        val syncRequest = androidx.work.OneTimeWorkRequestBuilder<ProfileSyncWorker>()
            .setInputData(
                androidx.work.workDataOf(
                    "athlete_id" to athleteId,
                    "force_sync" to true
                )
            )
            .build()

        workManager.enqueue(syncRequest)
    }

    private fun showBaselineUpdateDialog() {
        // Show dialog to update baseline measurements
        // Implementation details based on UI requirements
    }

    override fun onDestroyView() {
        super.onDestroyView()
        workManager.cancelUniqueWork(SYNC_WORK_NAME)
    }

    companion object {
        fun newInstance() = ProfileFragment()
    }
}