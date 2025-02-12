package com.smartapparel.app.presentation.profile

import androidx.lifecycle.viewModelScope // version: 2.6.1
import javax.inject.Inject // version: 1
import kotlinx.coroutines.flow.* // version: 1.7.1
import kotlinx.coroutines.launch
import com.smartapparel.app.presentation.common.BaseViewModel
import com.smartapparel.app.domain.usecases.GetAthleteUseCase
import com.smartapparel.app.domain.usecases.UpdateAthleteBaselineUseCase
import com.smartapparel.app.domain.models.Athlete
import com.smartapparel.app.domain.models.BaselineData
import com.smartapparel.app.utils.SecurityUtils
import com.smartapparel.app.utils.Logger

private const val TAG = "ProfileViewModel"

/**
 * Data class representing the UI state for the profile screen
 */
data class ProfileUiState(
    val athlete: Athlete? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val isSyncing: Boolean = false,
    val lastSyncTimestamp: Long = 0
)

/**
 * ViewModel responsible for managing athlete profile data and UI state with real-time updates,
 * secure data handling, and offline support.
 */
class ProfileViewModel @Inject constructor(
    private val getAthleteUseCase: GetAthleteUseCase,
    private val updateAthleteBaselineUseCase: UpdateAthleteBaselineUseCase
) : BaseViewModel() {

    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    /**
     * Securely loads athlete profile data with offline support and real-time updates
     * @param athleteId Unique identifier of the athlete
     */
    fun loadAthleteProfile(athleteId: String) {
        // Validate input
        if (athleteId.isBlank()) {
            _uiState.update { it.copy(error = "Invalid athlete ID") }
            return
        }

        launchWithLoading {
            Logger.d(TAG, "Loading athlete profile", mapOf("athleteId" to athleteId))
            
            try {
                getAthleteUseCase(athleteId)
                    .catch { error ->
                        Logger.e(TAG, "Error loading athlete profile", error)
                        _uiState.update { 
                            it.copy(
                                error = "Failed to load profile: ${error.message}",
                                isLoading = false
                            )
                        }
                    }
                    .collect { result ->
                        result.fold(
                            onSuccess = { athlete ->
                                Logger.d(TAG, "Successfully loaded athlete profile")
                                _uiState.update {
                                    it.copy(
                                        athlete = athlete,
                                        isLoading = false,
                                        error = null,
                                        lastSyncTimestamp = System.currentTimeMillis()
                                    )
                                }
                            },
                            onFailure = { error ->
                                Logger.e(TAG, "Failed to load athlete profile", error)
                                _uiState.update {
                                    it.copy(
                                        error = "Failed to load profile: ${error.message}",
                                        isLoading = false
                                    )
                                }
                            }
                        )
                    }
            } catch (e: Exception) {
                Logger.e(TAG, "Unexpected error loading athlete profile", e)
                _uiState.update {
                    it.copy(
                        error = "Unexpected error: ${e.message}",
                        isLoading = false
                    )
                }
            }
        }
    }

    /**
     * Securely updates athlete's baseline measurements with validation and sync support
     * @param baselineData New baseline measurements to update
     */
    fun updateBaseline(baselineData: BaselineData) {
        val currentAthlete = _uiState.value.athlete
        if (currentAthlete == null) {
            _uiState.update { it.copy(error = "No athlete data loaded") }
            return
        }

        if (!baselineData.validateMeasurements()) {
            _uiState.update { it.copy(error = "Invalid baseline measurements") }
            return
        }

        launchWithLoading {
            Logger.d(TAG, "Updating athlete baseline data", mapOf(
                "athleteId" to currentAthlete.id,
                "timestamp" to System.currentTimeMillis()
            ))

            _uiState.update { it.copy(isSyncing = true) }

            try {
                updateAthleteBaselineUseCase(currentAthlete.id, baselineData)
                    .fold(
                        onSuccess = {
                            Logger.d(TAG, "Successfully updated baseline data")
                            // Reload athlete data to reflect changes
                            loadAthleteProfile(currentAthlete.id)
                            _uiState.update {
                                it.copy(
                                    isSyncing = false,
                                    error = null,
                                    lastSyncTimestamp = System.currentTimeMillis()
                                )
                            }
                        },
                        onFailure = { error ->
                            Logger.e(TAG, "Failed to update baseline data", error)
                            _uiState.update {
                                it.copy(
                                    error = "Failed to update baseline: ${error.message}",
                                    isSyncing = false
                                )
                            }
                        }
                    )
            } catch (e: Exception) {
                Logger.e(TAG, "Unexpected error updating baseline data", e)
                _uiState.update {
                    it.copy(
                        error = "Unexpected error: ${e.message}",
                        isSyncing = false
                    )
                }
            }
        }
    }

    /**
     * Resets error state and cleans up resources
     */
    fun resetError() {
        _uiState.update { it.copy(error = null) }
        Logger.d(TAG, "Error state reset")
    }

    /**
     * Cleanup when ViewModel is cleared
     */
    override fun onCleared() {
        super.onCleared()
        Logger.d(TAG, "ProfileViewModel cleared")
    }
}