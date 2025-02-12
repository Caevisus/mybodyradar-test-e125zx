package com.smartapparel.app.data.db.dao

import androidx.room.Dao // v2.6.0
import androidx.room.Query // v2.6.0
import androidx.room.Insert // v2.6.0
import androidx.room.Update // v2.6.0
import androidx.room.Delete // v2.6.0
import androidx.room.Transaction // v2.6.0
import androidx.room.OnConflictStrategy // v2.6.0
import kotlinx.coroutines.flow.Flow // v1.7.0
import com.smartapparel.app.data.db.entities.AthleteEntity

/**
 * Room Database Data Access Object (DAO) interface for athlete-related operations.
 * Implements secure CRUD operations with field-level encryption and transaction support.
 * All sensitive data is automatically encrypted/decrypted using the SecurityUtils service.
 */
@Dao
interface AthleteDao {

    /**
     * Retrieves all athletes from the database ordered by creation date.
     * Sensitive fields are automatically decrypted when mapping to domain model.
     * @return Flow of list containing all athlete entities
     */
    @Query("""
        SELECT * FROM athletes 
        ORDER BY created_at DESC
    """)
    fun getAllAthletes(): Flow<List<AthleteEntity>>

    /**
     * Retrieves a specific athlete by their ID.
     * @param id Unique identifier of the athlete
     * @return Flow of athlete entity with decrypted data
     */
    @Query("""
        SELECT * FROM athletes 
        WHERE id = :id
    """)
    fun getAthleteById(id: String): Flow<AthleteEntity>

    /**
     * Retrieves all athletes belonging to a specific team.
     * @param teamId Unique identifier of the team
     * @return Flow of list containing team's athletes
     */
    @Query("""
        SELECT * FROM athletes 
        WHERE team_id = :teamId 
        ORDER BY encrypted_name ASC
    """)
    fun getAthletesByTeam(teamId: String): Flow<List<AthleteEntity>>

    /**
     * Inserts a new athlete with encrypted sensitive data.
     * @param athlete AthleteEntity with pre-encrypted sensitive fields
     * @return Row ID of inserted athlete
     * @throws SQLiteConstraintException if unique constraints are violated
     */
    @Insert(onConflict = OnConflictStrategy.ABORT)
    @Transaction
    suspend fun insertAthlete(athlete: AthleteEntity): Long

    /**
     * Updates an existing athlete with encrypted data.
     * @param athlete AthleteEntity with updated and encrypted data
     * @return Number of rows updated (should be 1)
     */
    @Update
    @Transaction
    suspend fun updateAthlete(athlete: AthleteEntity): Int

    /**
     * Deletes an athlete and associated data.
     * @param athlete AthleteEntity to be deleted
     * @return Number of rows deleted (should be 1)
     */
    @Delete
    @Transaction
    suspend fun deleteAthlete(athlete: AthleteEntity): Int

    /**
     * Inserts or updates an athlete with encrypted data.
     * Used for synchronization and conflict resolution.
     * @param athlete AthleteEntity to be upserted
     * @return Row ID of upserted athlete
     */
    @Transaction
    @Query("""
        INSERT OR REPLACE INTO athletes (
            id, 
            encrypted_name,
            encrypted_email,
            team_id,
            baseline_data_json,
            preferences_json,
            created_at,
            updated_at,
            last_sync_timestamp,
            sync_version
        ) VALUES (
            :id,
            :encryptedName,
            :encryptedEmail,
            :teamId,
            :baselineDataJson,
            :preferencesJson,
            :createdAt,
            :updatedAt,
            :lastSyncTimestamp,
            :syncVersion
        )
    """)
    suspend fun upsertAthlete(
        id: String,
        encryptedName: String,
        encryptedEmail: String,
        teamId: String,
        baselineDataJson: String,
        preferencesJson: String,
        createdAt: Long,
        updatedAt: Long,
        lastSyncTimestamp: Long,
        syncVersion: Int
    ): Long

    /**
     * Retrieves athletes that need synchronization with the server.
     * @return Flow of list containing unsynchronized athletes
     */
    @Query("""
        SELECT * FROM athletes 
        WHERE (strftime('%s','now') * 1000 - last_sync_timestamp) > 3600000 
        OR sync_version > 1
        ORDER BY last_sync_timestamp ASC
    """)
    fun getUnsyncedAthletes(): Flow<List<AthleteEntity>>

    /**
     * Retrieves athletes with stale baseline data that needs updating.
     * @param thresholdMs Maximum age of baseline data in milliseconds
     * @return Flow of list containing athletes needing baseline update
     */
    @Query("""
        SELECT * FROM athletes 
        WHERE json_extract(baseline_data_json, '$.lastUpdated') < :thresholdMs
        ORDER BY json_extract(baseline_data_json, '$.lastUpdated') ASC
    """)
    fun getAthletesNeedingBaselineUpdate(thresholdMs: Long): Flow<List<AthleteEntity>>
}