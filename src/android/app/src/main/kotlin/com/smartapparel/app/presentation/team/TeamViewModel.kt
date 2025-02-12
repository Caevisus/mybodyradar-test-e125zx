package com.smartapparel.app.presentation.team

import javax.inject.Inject // version: 1
import kotlinx.coroutines.flow.StateFlow // version: 1.7.1
import kotlinx.coroutines.flow.MutableStateFlow // version: 1.7.1
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.withTimeout
import com.smartapparel.app.presentation.common.BaseViewModel
import com.smartapparel.app.domain.models.Team
import com.smartapparel.app.domain.usecases.GetTeamByIdUseCase
import com.smartapparel.app.domain.usecases.GetAllTeamsUseCase
import com.smartapparel.app.utils.Logger

private const val TAG = "TeamViewModel"
private const val DEBOUNCE_MS = 300L
private const val OPERATION_TIMEOUT = 5000L // 5 seconds timeout for team operations

/**
 * Enhanced ViewModel for managing team-related UI state and operations with comprehensive
 * error handling, performance optimization, and analytics support.
 */
class TeamViewModel @Inject constructor(
    private val getTeamByIdUseCase: GetTeamByIdUseCase,
    private val getAllTeamsUseCase: GetAllTeamsUseCase
) : BaseViewModel() {

    // Thread-safe state management for selected team
    private val _selectedTeam = MutableStateFlow<Team?>(null)
    val selectedTeam: StateFlow<Team?> = _selectedTeam.asStateFlow()

    // Thread-safe state management for team list
    private val _teams = MutableStateFlow<List<Team>>(emptyList())
    val teams: StateFlow<List<Team>> = _teams.asStateFlow()

    init {
        Logger.d(TAG, "Initializing TeamViewModel")
        loadTeams() // Initial load of teams
    }

    /**
     * Loads all teams from the repository with caching and error handling.
     * Implements debouncing to prevent rapid reloads and performance degradation.
     */
    fun loadTeams() {
        Logger.d(TAG, "Loading teams")
        launchWithLoading {
            try {
                withTimeout(OPERATION_TIMEOUT) {
                    getAllTeamsUseCase()
                        .debounce(DEBOUNCE_MS)
                        .onEach { teamList ->
                            Logger.d(TAG, "Teams loaded successfully", mapOf(
                                "teamCount" to teamList.size
                            ))
                        }
                        .catch { error ->
                            Logger.e(TAG, "Error loading teams", error)
                            throw error
                        }
                        .collectLatest { teamList ->
                            validateTeamList(teamList)
                            _teams.value = teamList
                        }
                }
            } catch (e: Exception) {
                Logger.e(TAG, "Failed to load teams", e)
                handleError(e, "loading teams")
            }
        }
    }

    /**
     * Selects a team by ID and loads its details with validation.
     * Implements security checks and performance optimization.
     *
     * @param teamId Unique identifier of the team to select
     */
    fun selectTeam(teamId: String) {
        Logger.d(TAG, "Selecting team", mapOf("teamId" to teamId))
        launchWithLoading {
            try {
                require(teamId.isNotBlank()) { "Team ID cannot be empty" }

                withTimeout(OPERATION_TIMEOUT) {
                    getTeamByIdUseCase(teamId)
                        .debounce(DEBOUNCE_MS)
                        .onEach { team ->
                            Logger.d(TAG, "Team selected successfully", mapOf(
                                "teamId" to teamId,
                                "teamName" to (team?.name ?: "null")
                            ))
                        }
                        .catch { error ->
                            Logger.e(TAG, "Error selecting team", error, mapOf(
                                "teamId" to teamId
                            ))
                            throw error
                        }
                        .collectLatest { team ->
                            team?.let { validateTeam(it) }
                            _selectedTeam.value = team
                        }
                }
            } catch (e: Exception) {
                Logger.e(TAG, "Failed to select team", e, mapOf(
                    "teamId" to teamId
                ))
                handleError(e, "selecting team")
            }
        }
    }

    /**
     * Clears the currently selected team with cleanup.
     * Implements proper resource management and state cleanup.
     */
    fun clearSelectedTeam() {
        Logger.d(TAG, "Clearing selected team")
        launchWithLoading {
            try {
                _selectedTeam.value?.let { previousTeam ->
                    Logger.d(TAG, "Clearing team selection", mapOf(
                        "previousTeamId" to previousTeam.id
                    ))
                }
                _selectedTeam.value = null
            } catch (e: Exception) {
                Logger.e(TAG, "Error clearing team selection", e)
                handleError(e, "clearing team selection")
            }
        }
    }

    /**
     * Validates a team object for data integrity.
     * Implements comprehensive validation checks.
     */
    private fun validateTeam(team: Team) {
        require(team.validate()) { "Invalid team data" }
    }

    /**
     * Validates a list of teams for data integrity.
     * Implements batch validation with error collection.
     */
    private fun validateTeamList(teams: List<Team>) {
        val errors = mutableListOf<String>()
        teams.forEachIndexed { index, team ->
            try {
                validateTeam(team)
            } catch (e: Exception) {
                errors.add("Invalid team at index $index: ${e.message}")
            }
        }
        require(errors.isEmpty()) { errors.joinToString("\n") }
    }

    override fun onCleared() {
        super.onCleared()
        Logger.d(TAG, "TeamViewModel cleared")
    }
}