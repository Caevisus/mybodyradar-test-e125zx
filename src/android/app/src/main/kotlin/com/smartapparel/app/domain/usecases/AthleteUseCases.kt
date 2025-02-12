package com.smartapparel.app.domain.usecases

import javax.inject.Inject // version: 1
import kotlinx.coroutines.flow.* // version: 1.7.0
import com.smartapparel.app.domain.models.Athlete
import com.smartapparel.app.domain.models.BaselineData
import com.smartapparel.app.data.repository.AthleteRepository
import com.smartapparel.app.data.repository.SyncResult

/**
 * Use case for securely retrieving a single athlete's data with offline support
 */
class GetAthleteUseCase @Inject constructor(
    private val repository: AthleteRepository
) {
    /**
     * Executes the use case to retrieve athlete data with validation and encryption
     * @param athleteId Unique identifier of the athlete
     * @return Flow of encrypted athlete data with error handling
     */
    operator fun invoke(athleteId: String): Flow<Result<Athlete>> = flow {
        // Validate athlete ID format
        if (athleteId.isBlank()) {
            emit(Result.failure(IllegalArgumentException("Athlete ID cannot be empty")))
            return@flow
        }

        try {
            repository.getAthleteById(athleteId)
                .map { athlete ->
                    athlete?.let { 
                        // Validate retrieved athlete data
                        val validationResult = it.validate()
                        if (!validationResult.isValid) {
                            throw IllegalStateException("Invalid athlete data: ${validationResult.errors}")
                        }
                        Result.success(it)
                    } ?: Result.failure(NoSuchElementException("Athlete not found"))
                }
                .collect { result ->
                    emit(result)
                }
        } catch (e: Exception) {
            emit(Result.failure(e))
        }
    }
}

/**
 * Use case for retrieving all athletes in a team with batch processing
 */
class GetTeamAthletesUseCase @Inject constructor(
    private val repository: AthleteRepository
) {
    /**
     * Executes the use case to retrieve team athletes with optimization
     * @param teamId Unique identifier of the team
     * @return Flow of batch-processed athlete list
     */
    operator fun invoke(teamId: String): Flow<Result<List<Athlete>>> = flow {
        // Validate team ID
        if (teamId.isBlank()) {
            emit(Result.failure(IllegalArgumentException("Team ID cannot be empty")))
            return@flow
        }

        try {
            repository.getAthletes()
                .map { athletes ->
                    // Filter athletes by team and validate each athlete
                    val teamAthletes = athletes.filter { it.teamId == teamId }
                        .map { athlete ->
                            val validationResult = athlete.validate()
                            if (!validationResult.isValid) {
                                throw IllegalStateException(
                                    "Invalid athlete data for ID ${athlete.id}: ${validationResult.errors}"
                                )
                            }
                            athlete
                        }
                    Result.success(teamAthletes)
                }
                .catch { e ->
                    emit(Result.failure(e))
                }
                .collect { result ->
                    emit(result)
                }
        } catch (e: Exception) {
            emit(Result.failure(e))
        }
    }
}

/**
 * Use case for securely updating athlete's baseline measurements with validation
 */
class UpdateAthleteBaselineUseCase @Inject constructor(
    private val repository: AthleteRepository
) {
    /**
     * Executes the use case to update baseline data with validation
     * @param athleteId Unique identifier of the athlete
     * @param baselineData New baseline measurements
     * @return Result indicating success or failure
     */
    suspend operator fun invoke(
        athleteId: String,
        baselineData: BaselineData
    ): Result<Unit> {
        // Validate inputs
        if (athleteId.isBlank()) {
            return Result.failure(IllegalArgumentException("Athlete ID cannot be empty"))
        }

        if (!baselineData.validateMeasurements()) {
            return Result.failure(IllegalArgumentException("Invalid baseline measurements"))
        }

        return try {
            // Retrieve current athlete data
            val athleteFlow = repository.getAthleteById(athleteId)
            val athlete = athleteFlow.first()
                ?: return Result.failure(NoSuchElementException("Athlete not found"))

            // Create updated athlete with new baseline data
            val updatedAthlete = athlete.copy(
                baselineData = baselineData,
                updatedAt = System.currentTimeMillis()
            )

            // Validate updated athlete
            val validationResult = updatedAthlete.validate()
            if (!validationResult.isValid) {
                return Result.failure(
                    IllegalStateException("Invalid athlete data: ${validationResult.errors}")
                )
            }

            // Attempt update with sync
            when (val syncResult = repository.syncAthleteData(athleteId)) {
                is SyncResult.Success -> Result.success(Unit)
                is SyncResult.Error -> Result.failure(
                    Exception("Failed to sync athlete data: ${syncResult.message}")
                )
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}