package com.smartapparel.app.data.repository

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.*
import android.net.NetworkInfo
import androidx.work.*
import com.smartapparel.app.domain.models.Athlete
import com.smartapparel.app.utils.SecurityUtils
import com.smartapparel.app.utils.Constants.DATA_CONFIG
import java.util.concurrent.TimeUnit
import kotlin.time.Duration.Companion.milliseconds

/**
 * Repository implementation for secure athlete data management with offline-first approach
 * and real-time synchronization capabilities.
 * @version 1.0.0
 */
@Singleton
class AthleteRepository @Inject constructor(
    private val athleteDao: AthleteDao,
    private val apiService: ApiService,
    private val securityUtils: SecurityUtils,
    private val syncManager: WorkManager,
    private val networkInfo: NetworkInfo
) {
    companion object {
        private const val SYNC_WORK_NAME = "athlete_sync_work"
        private const val MAX_SYNC_ATTEMPTS = 3
        private const val SYNC_BACKOFF_DELAY_MS = 5000L
    }

    init {
        setupPeriodicSync()
    }

    /**
     * Retrieves a flow of all athletes with real-time updates and decryption
     * @return Flow of decrypted athlete list
     */
    fun getAthletes(): Flow<List<Athlete>> = flow {
        // Emit local data first (offline-first approach)
        athleteDao.getAllAthletes()
            .map { athletes ->
                athletes.map { athlete ->
                    decryptAthleteData(athlete)
                }
            }
            .collect { decryptedAthletes ->
                emit(decryptedAthletes)
                
                // Schedule background sync if online
                if (networkInfo.isConnected) {
                    scheduleSyncWork(forceFetch = false)
                }
            }
    }.catch { error ->
        // Log error and emit empty list as fallback
        error.printStackTrace()
        emit(emptyList())
    }

    /**
     * Retrieves a specific athlete by ID with real-time updates
     * @param athleteId Unique identifier of the athlete
     * @return Flow of decrypted athlete data
     */
    fun getAthleteById(athleteId: String): Flow<Athlete?> = flow {
        athleteDao.getAthleteById(athleteId)
            .map { athlete ->
                athlete?.let { decryptAthleteData(it) }
            }
            .collect { decryptedAthlete ->
                emit(decryptedAthlete)
                
                // Schedule targeted sync for this athlete
                if (networkInfo.isConnected) {
                    syncAthleteData(athleteId, forceFetch = false)
                }
            }
    }.catch { error ->
        error.printStackTrace()
        emit(null)
    }

    /**
     * Synchronizes athlete data between local and remote storage with conflict resolution
     * @param athleteId Unique identifier of the athlete to sync
     * @param forceFetch Force remote fetch regardless of cache status
     * @return SyncResult indicating success or failure with details
     */
    suspend fun syncAthleteData(athleteId: String, forceFetch: Boolean = false): SyncResult {
        if (!networkInfo.isConnected) {
            return SyncResult.Error("No network connection available")
        }

        return try {
            // Get local version
            val localAthlete = athleteDao.getAthleteByIdSync(athleteId)
            
            // Get remote version
            val remoteAthlete = apiService.getAthlete(athleteId)

            when {
                // Remote is newer
                remoteAthlete.version > (localAthlete?.version ?: -1) -> {
                    val encryptedAthlete = encryptAthleteData(remoteAthlete)
                    athleteDao.insertAthlete(encryptedAthlete)
                    SyncResult.Success("Remote data synchronized")
                }
                // Local is newer
                localAthlete != null && localAthlete.version > remoteAthlete.version -> {
                    val decryptedAthlete = decryptAthleteData(localAthlete)
                    apiService.updateAthlete(decryptedAthlete)
                    SyncResult.Success("Local data synchronized")
                }
                // Versions match
                else -> SyncResult.Success("Data already in sync")
            }
        } catch (e: Exception) {
            SyncResult.Error("Sync failed: ${e.message}")
        }
    }

    /**
     * Sets up periodic background synchronization
     */
    private fun setupPeriodicSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .setRequiresBatteryNotLow(true)
            .build()

        val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(
            DATA_CONFIG.SYNC_INTERVAL_MS.milliseconds
        )
            .setConstraints(constraints)
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL,
                SYNC_BACKOFF_DELAY_MS,
                TimeUnit.MILLISECONDS
            )
            .build()

        syncManager.enqueueUniquePeriodicWork(
            SYNC_WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            syncRequest
        )
    }

    /**
     * Schedules immediate sync work
     */
    private fun scheduleSyncWork(forceFetch: Boolean) {
        val syncWork = OneTimeWorkRequestBuilder<SyncWorker>()
            .setInputData(workDataOf("forceFetch" to forceFetch))
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .build()

        syncManager.enqueue(syncWork)
    }

    /**
     * Encrypts sensitive athlete data fields
     */
    private fun encryptAthleteData(athlete: Athlete): Athlete {
        return athlete.copy(
            id = securityUtils.encryptData(athlete.id.toByteArray()).toString(),
            name = securityUtils.encryptData(athlete.name.toByteArray()).toString(),
            email = securityUtils.encryptData(athlete.email.toByteArray()).toString()
        )
    }

    /**
     * Decrypts sensitive athlete data fields
     */
    private fun decryptAthleteData(athlete: Athlete): Athlete {
        return athlete.copy(
            id = String(securityUtils.decryptData(athlete.id.toByteArray())),
            name = String(securityUtils.decryptData(athlete.name.toByteArray())),
            email = String(securityUtils.decryptData(athlete.email.toByteArray()))
        )
    }
}

/**
 * Sealed class representing sync operation results
 */
sealed class SyncResult {
    data class Success(val message: String) : SyncResult()
    data class Error(val message: String) : SyncResult()
}