package com.smartapparel.app.data.db.dao

import androidx.room.Dao // version: 2.6.0
import androidx.room.Query // version: 2.6.0
import androidx.room.Insert // version: 2.6.0
import androidx.room.Update // version: 2.6.0
import androidx.room.Delete // version: 2.6.0
import androidx.room.Transaction // version: 2.6.0
import kotlinx.coroutines.flow.Flow // version: 1.7.0
import com.smartapparel.app.data.db.entities.SessionEntity

/**
 * Room DAO interface for managing training session data with optimized queries and sync capabilities.
 * Implements 5-year data retention policy with efficient storage management.
 */
@Dao
interface SessionDao {
    /**
     * Retrieves a specific session by ID with reactive updates.
     * Uses index on id column for optimized query performance.
     */
    @Query("SELECT * FROM sessions WHERE id = :sessionId")
    fun getSessionById(sessionId: String): Flow<SessionEntity?>

    /**
     * Retrieves all sessions for a specific athlete ordered by start time.
     * Uses composite index on athlete_id and start_time for optimized query performance.
     */
    @Query("""
        SELECT * FROM sessions 
        WHERE athlete_id = :athleteId 
        ORDER BY start_time DESC
    """)
    fun getSessionsByAthleteId(athleteId: String): Flow<List<SessionEntity>>

    /**
     * Retrieves the currently active session (if any).
     * Uses index on end_time for efficient filtering of active sessions.
     */
    @Query("SELECT * FROM sessions WHERE end_time = 0 LIMIT 1")
    fun getActiveSession(): Flow<SessionEntity?>

    /**
     * Retrieves sessions within a specific date range.
     * Supports 5-year historical data retention requirement.
     */
    @Query("""
        SELECT * FROM sessions 
        WHERE athlete_id = :athleteId 
        AND start_time BETWEEN :startTime AND :endTime 
        ORDER BY start_time DESC
    """)
    fun getSessionsByDateRange(
        athleteId: String,
        startTime: Long,
        endTime: Long
    ): Flow<List<SessionEntity>>

    /**
     * Retrieves all sessions pending sync to server.
     * Uses index on is_uploaded for efficient sync status filtering.
     */
    @Query("SELECT * FROM sessions WHERE is_uploaded = 0")
    fun getUnuploadedSessions(): Flow<List<SessionEntity>>

    /**
     * Retrieves the count of sessions for storage management.
     */
    @Query("SELECT COUNT(*) FROM sessions WHERE athlete_id = :athleteId")
    suspend fun getSessionCount(athleteId: String): Int

    /**
     * Inserts a new session with proper sync status tracking.
     */
    @Insert
    suspend fun insertSession(session: SessionEntity): Long

    /**
     * Updates existing session data while maintaining sync status.
     */
    @Update
    suspend fun updateSession(session: SessionEntity): Int

    /**
     * Removes session data with proper cleanup.
     */
    @Delete
    suspend fun deleteSession(session: SessionEntity): Int

    /**
     * Updates sync status for uploaded sessions.
     */
    @Query("""
        UPDATE sessions 
        SET is_uploaded = 1, 
            last_sync_timestamp = :timestamp 
        WHERE id IN (:sessionIds)
    """)
    suspend fun markSessionsAsUploaded(sessionIds: List<String>, timestamp: Long): Int

    /**
     * Cleans up old sessions based on retention policy.
     * Implements 5-year data retention requirement.
     */
    @Query("""
        DELETE FROM sessions 
        WHERE athlete_id = :athleteId 
        AND start_time < :cutoffTime
    """)
    suspend fun deleteOldSessions(athleteId: String, cutoffTime: Long): Int

    /**
     * Retrieves sessions with specific activity type.
     */
    @Query("""
        SELECT * FROM sessions 
        WHERE athlete_id = :athleteId 
        AND activity_type = :activityType 
        ORDER BY start_time DESC
    """)
    fun getSessionsByActivityType(
        athleteId: String,
        activityType: String
    ): Flow<List<SessionEntity>>

    /**
     * Atomic operation to end an active session.
     */
    @Transaction
    suspend fun endActiveSession(sessionId: String, endTime: Long): Int {
        return updateSession(
            SessionEntity(
                id = sessionId,
                endTime = endTime,
                isUploaded = false
            )
        )
    }
}