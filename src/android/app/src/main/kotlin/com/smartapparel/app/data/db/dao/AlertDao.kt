package com.smartapparel.app.data.db.dao

import androidx.room.Dao // version: 2.6.0
import androidx.room.Query // version: 2.6.0
import androidx.room.Insert // version: 2.6.0
import androidx.room.Update // version: 2.6.0
import androidx.room.Delete // version: 2.6.0
import androidx.room.Transaction // version: 2.6.0
import androidx.room.OnConflictStrategy // version: 2.6.0
import kotlinx.coroutines.flow.Flow // version: 1.7.0
import com.smartapparel.app.data.db.entities.AlertEntity

/**
 * Data Access Object interface for alert-related database operations.
 * Provides comprehensive CRUD operations with support for:
 * - Real-time monitoring through Kotlin Flow
 * - Data retention management
 * - Performance optimization through proper indexing
 * - Transaction safety
 */
@Dao
interface AlertDao {

    /**
     * Retrieves all alerts with pagination support.
     * Results are ordered by timestamp for efficient data presentation.
     *
     * @param limit Maximum number of alerts to retrieve
     * @param offset Number of alerts to skip for pagination
     * @return Flow of paginated alerts
     */
    @Query("""
        SELECT * FROM alerts 
        ORDER BY timestamp DESC 
        LIMIT :limit OFFSET :offset
    """)
    fun getAllAlerts(limit: Int, offset: Int): Flow<List<AlertEntity>>

    /**
     * Retrieves a specific alert by its unique identifier.
     *
     * @param alertId Unique identifier of the alert
     * @return The alert entity if found, null otherwise
     */
    @Query("SELECT * FROM alerts WHERE id = :alertId")
    suspend fun getAlertById(alertId: String): AlertEntity?

    /**
     * Retrieves all alerts for a specific training session.
     * Results are ordered by timestamp for chronological analysis.
     *
     * @param sessionId Unique identifier of the training session
     * @return Flow of session-specific alerts
     */
    @Query("""
        SELECT * FROM alerts 
        WHERE sessionId = :sessionId 
        ORDER BY timestamp DESC
    """)
    fun getAlertsBySession(sessionId: String): Flow<List<AlertEntity>>

    /**
     * Retrieves all active alerts ordered by severity and timestamp.
     * Critical alerts appear first for immediate attention.
     *
     * @return Flow of active alerts
     */
    @Query("""
        SELECT * FROM alerts 
        WHERE status = 'ACTIVE' 
        ORDER BY severity DESC, timestamp DESC
    """)
    fun getActiveAlerts(): Flow<List<AlertEntity>>

    /**
     * Inserts a new alert with conflict resolution.
     * Uses REPLACE strategy to handle duplicate IDs.
     *
     * @param alert The alert entity to insert
     * @return Row ID of the inserted alert
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAlert(alert: AlertEntity): Long

    /**
     * Updates an existing alert within a transaction.
     * Ensures atomic update operation.
     *
     * @param alert The alert entity to update
     * @return Number of alerts updated
     */
    @Update
    @Transaction
    suspend fun updateAlert(alert: AlertEntity): Int

    /**
     * Deletes an alert with transaction support.
     * Ensures atomic delete operation.
     *
     * @param alert The alert entity to delete
     * @return Number of alerts deleted
     */
    @Delete
    @Transaction
    suspend fun deleteAlert(alert: AlertEntity): Int

    /**
     * Deletes alerts older than the specified timestamp.
     * Used for implementing the 5-year data retention policy.
     *
     * @param timestamp Timestamp threshold for deletion
     * @return Number of alerts deleted
     */
    @Query("DELETE FROM alerts WHERE timestamp < :timestamp")
    @Transaction
    suspend fun deleteOldAlerts(timestamp: Long): Int
}