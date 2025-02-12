package com.smartapparel.app.domain.usecases

import javax.inject.Inject // v1
import kotlinx.coroutines.flow.Flow // v1.7.0
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.smartapparel.app.domain.models.Team
import com.smartapparel.app.data.repository.TeamRepository

/**
 * Use case for retrieving a team by its ID with enhanced analytics support.
 * Implements secure data access patterns and validation.
 */
class GetTeamByIdUseCase @Inject constructor(
    private val teamRepository: TeamRepository
) {
    /**
     * Executes the use case to retrieve a team with analytics data.
     *
     * @param teamId Unique identifier of the team to retrieve
     * @return Flow emitting the team with analytics data or null if not found
     * @throws IllegalArgumentException if teamId is invalid
     * @throws SecurityException if access is unauthorized
     */
    operator fun invoke(teamId: String): Flow<Team?> {
        require(teamId.isNotBlank()) { "Team ID cannot be empty" }

        return teamRepository.getTeamById(teamId)
            .onEach { team ->
                team?.let {
                    require(it.validate()) { "Invalid team data retrieved" }
                }
            }
            .catch { error ->
                throw when (error) {
                    is IllegalArgumentException -> error
                    is SecurityException -> error
                    else -> IllegalStateException("Failed to retrieve team: ${error.message}", error)
                }
            }
    }
}

/**
 * Use case for retrieving all teams with analytics summaries.
 * Implements pagination and secure data access patterns.
 */
class GetAllTeamsUseCase @Inject constructor(
    private val teamRepository: TeamRepository
) {
    companion object {
        private const val DEFAULT_PAGE_SIZE = 50
        private const val MAX_PAGE_SIZE = 100
    }

    /**
     * Executes the use case to retrieve all teams with analytics data.
     *
     * @param pageSize Number of teams to retrieve per page (default: 50, max: 100)
     * @param offset Starting position for pagination
     * @return Flow emitting list of teams with analytics summaries
     * @throws IllegalArgumentException if pagination parameters are invalid
     * @throws SecurityException if access is unauthorized
     */
    operator fun invoke(
        pageSize: Int = DEFAULT_PAGE_SIZE,
        offset: Int = 0
    ): Flow<List<Team>> {
        require(pageSize in 1..MAX_PAGE_SIZE) { 
            "Page size must be between 1 and $MAX_PAGE_SIZE" 
        }
        require(offset >= 0) { "Offset cannot be negative" }

        return teamRepository.getAllTeams(pageSize, offset)
            .onEach { teams ->
                teams.forEach { team ->
                    require(team.validate()) { "Invalid team data in list" }
                }
            }
            .catch { error ->
                throw when (error) {
                    is IllegalArgumentException -> error
                    is SecurityException -> error
                    else -> IllegalStateException("Failed to retrieve teams: ${error.message}", error)
                }
            }
    }
}

/**
 * Use case for creating a new team with validation and security checks.
 */
class CreateTeamUseCase @Inject constructor(
    private val teamRepository: TeamRepository
) {
    /**
     * Executes the use case to create a new team.
     *
     * @param team Team object to create
     * @return Result containing the created team or error
     * @throws IllegalArgumentException if team data is invalid
     * @throws SecurityException if operation is unauthorized
     */
    suspend operator fun invoke(team: Team): Result<Team> = withContext(Dispatchers.IO) {
        try {
            require(team.validate()) { "Invalid team data" }
            teamRepository.createTeam(team)
        } catch (error: Exception) {
            Result.failure(when (error) {
                is IllegalArgumentException -> error
                is SecurityException -> error
                else -> IllegalStateException("Failed to create team: ${error.message}", error)
            })
        }
    }
}

/**
 * Use case for updating an existing team with validation and optimistic locking.
 */
class UpdateTeamUseCase @Inject constructor(
    private val teamRepository: TeamRepository
) {
    /**
     * Executes the use case to update an existing team.
     *
     * @param team Team object with updated data
     * @return Result containing the updated team or error
     * @throws IllegalArgumentException if team data is invalid
     * @throws SecurityException if operation is unauthorized
     * @throws IllegalStateException if team not found or concurrent modification
     */
    suspend operator fun invoke(team: Team): Result<Team> = withContext(Dispatchers.IO) {
        try {
            require(team.validate()) { "Invalid team data" }
            teamRepository.updateTeam(team)
        } catch (error: Exception) {
            Result.failure(when (error) {
                is IllegalArgumentException -> error
                is SecurityException -> error
                is IllegalStateException -> error
                else -> IllegalStateException("Failed to update team: ${error.message}", error)
            })
        }
    }
}

/**
 * Use case for deleting a team while maintaining referential integrity.
 */
class DeleteTeamUseCase @Inject constructor(
    private val teamRepository: TeamRepository
) {
    /**
     * Executes the use case to delete a team.
     *
     * @param teamId Unique identifier of the team to delete
     * @return Result indicating success or failure
     * @throws IllegalArgumentException if teamId is invalid
     * @throws SecurityException if operation is unauthorized
     * @throws IllegalStateException if team not found
     */
    suspend operator fun invoke(teamId: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            require(teamId.isNotBlank()) { "Team ID cannot be empty" }
            teamRepository.deleteTeam(teamId)
        } catch (error: Exception) {
            Result.failure(when (error) {
                is IllegalArgumentException -> error
                is SecurityException -> error
                is IllegalStateException -> error
                else -> IllegalStateException("Failed to delete team: ${error.message}", error)
            })
        }
    }
}