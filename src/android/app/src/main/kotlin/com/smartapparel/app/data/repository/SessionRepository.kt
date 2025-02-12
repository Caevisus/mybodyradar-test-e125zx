package com.smartapparel.app.data.repository

import javax.inject.Inject // version: 1.0
import javax.inject.Singleton // version: 1.0
import kotlinx.coroutines.flow.Flow // version: 1.7.0
import kotlinx.coroutines.flow.map // version: 1.7.0
import kotlinx.coroutines.flow.catch // version: 1.7.0
import kotlinx.coroutines.Dispatchers // version: 1.7.0
import kotlinx.coroutines.withContext // version: 1.7.0
import kotlinx.coroutines.delay // version: 1.7.0
import com.smartapparel.app.data.db.dao.SessionDao
import com.smartapparel.app.domain.models.Session
import com.smartapparel.app.utils.DATA_CONFIG
import com.smartapparel.app.utils.API_CONFIG
import java.util.concurrent.atomic.AtomicBoolean
import timber.log.Timber // version: 5.0.1

/**
 * Repository implementation for managing training session data with efficient local persistence,
 * real-time updates, and reliable cloud synchronization.
 */
@Singleton
class SessionRepository @Inject constructor(
    private val sessionDao: SessionDao,
    private val sessionApi: SessionApi,
    private val networkConnectivity: NetworkConnectivity,
    private val compressionUtil: CompressionUtil
) {
    private val isSyncing = AtomicBoolean(false)
    
    /**
     * Retrieves a specific session by ID with real-time updates.
     * Implements efficient data compression and caching.
     */
    fun getSessionById(sessionId: String): Flow<Session?> {
        require(sessionId.isNotBlank()) { "Session ID cannot be blank" }
        
        return sessionDao.getSessionById(sessionId)
            .map { entity -> 
                entity?.toDomainModel()
            }
            .catch { e ->
                Timber.e(e, "Error retrieving session $sessionId")
                throw e
            }
    }

    /**
     * Creates a new training session with proper validation and persistence.
     */
    suspend fun createSession(session: Session): Result<String> = withContext(Dispatchers.IO) {
        try {
            // Validate session data
            require(session.athleteId.isNotBlank()) { "Athlete ID cannot be blank" }
            require(session.startTime > 0) { "Invalid start time" }
            
            // Convert and persist locally
            val entity = session.toEntity()
            val id = sessionDao.insertSession(entity)
            
            // Attempt immediate upload if network available
            if (networkConnectivity.isConnected()) {
                uploadSession(session)
            }
            
            Result.success(session.id)
        } catch (e: Exception) {
            Timber.e(e, "Error creating session")
            Result.failure(e)
        }
    }

    /**
     * Updates an existing session with proper validation and sync status tracking.
     */
    suspend fun updateSession(session: Session): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val entity = session.toEntity()
            sessionDao.updateSession(entity)
            
            if (networkConnectivity.isConnected()) {
                uploadSession(session)
            }
            
            Result.success(Unit)
        } catch (e: Exception) {
            Timber.e(e, "Error updating session ${session.id}")
            Result.failure(e)
        }
    }

    /**
     * Synchronizes unuploaded sessions with the remote server using efficient batching
     * and compression.
     */
    suspend fun syncUnuploadedSessions() = withContext(Dispatchers.IO) {
        if (!networkConnectivity.isConnected() || !isSyncing.compareAndSet(false, true)) {
            return@withContext
        }
        
        try {
            var retryCount = 0
            var syncSuccess = false
            
            while (retryCount < API_CONFIG.RETRY_ATTEMPTS && !syncSuccess) {
                try {
                    val unsynced = sessionDao.getUnuploadedSessions()
                        .map { entities -> entities.map { it.toDomainModel() } }
                        .catch { e ->
                            Timber.e(e, "Error fetching unsynced sessions")
                            throw e
                        }
                    
                    // Process in batches for efficiency
                    unsynced.collect { sessions ->
                        sessions.chunked(DATA_CONFIG.BATCH_SIZE).forEach { batch ->
                            val compressedBatch = batch.map { session ->
                                compressionUtil.compressSession(session, DATA_CONFIG.COMPRESSION_RATIO)
                            }
                            
                            val response = sessionApi.uploadSessions(compressedBatch)
                            if (response.isSuccessful) {
                                val uploadedIds = batch.map { it.id }
                                sessionDao.markSessionsAsUploaded(
                                    uploadedIds,
                                    System.currentTimeMillis()
                                )
                            } else {
                                throw Exception("Failed to upload batch: ${response.message()}")
                            }
                        }
                    }
                    
                    syncSuccess = true
                } catch (e: Exception) {
                    Timber.e(e, "Sync attempt $retryCount failed")
                    retryCount++
                    if (retryCount < API_CONFIG.RETRY_ATTEMPTS) {
                        delay(API_CONFIG.RETRY_DELAY_MS)
                    }
                }
            }
        } finally {
            isSyncing.set(false)
        }
    }

    /**
     * Cleans up old sessions based on retention policy.
     */
    suspend fun cleanupOldSessions(athleteId: String) = withContext(Dispatchers.IO) {
        try {
            val cutoffTime = System.currentTimeMillis() - (5L * 365 * 24 * 60 * 60 * 1000) // 5 years
            val deletedCount = sessionDao.deleteOldSessions(athleteId, cutoffTime)
            Timber.i("Cleaned up $deletedCount old sessions for athlete $athleteId")
        } catch (e: Exception) {
            Timber.e(e, "Error cleaning up old sessions")
        }
    }

    private suspend fun uploadSession(session: Session) {
        try {
            val compressedSession = compressionUtil.compressSession(session, DATA_CONFIG.COMPRESSION_RATIO)
            val response = sessionApi.uploadSession(compressedSession)
            
            if (response.isSuccessful) {
                sessionDao.markSessionsAsUploaded(listOf(session.id), System.currentTimeMillis())
            } else {
                Timber.w("Failed to upload session ${session.id}: ${response.message()}")
            }
        } catch (e: Exception) {
            Timber.e(e, "Error uploading session ${session.id}")
        }
    }
}