package com.smartapparel.app.data.db.entities

import androidx.room.Entity // v2.5.0
import androidx.room.PrimaryKey // v2.5.0
import androidx.room.ColumnInfo // v2.5.0
import androidx.room.TypeConverters // v2.5.0
import androidx.room.Index
import com.smartapparel.app.domain.models.Athlete
import com.smartapparel.app.domain.models.BaselineData
import com.smartapparel.app.domain.models.AthletePreferences
import com.smartapparel.app.utils.SecurityUtils
import com.google.gson.Gson
import java.util.concurrent.TimeUnit

/**
 * Room database entity representing an athlete with secure field storage.
 * Implements field-level encryption for sensitive data and supports offline synchronization.
 */
@Entity(
    tableName = "athletes",
    indices = [
        Index(value = ["email"], unique = true),
        Index(value = ["teamId"])
    ]
)
@TypeConverters(AthleteConverters::class)
data class AthleteEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,

    @ColumnInfo(name = "encrypted_name")
    val encryptedName: String,

    @ColumnInfo(name = "encrypted_email")
    val encryptedEmail: String,

    @ColumnInfo(name = "team_id")
    val teamId: String,

    @ColumnInfo(name = "baseline_data_json")
    val baselineDataJson: String,

    @ColumnInfo(name = "preferences_json")
    val preferencesJson: String,

    @ColumnInfo(name = "created_at")
    val createdAt: Long,

    @ColumnInfo(name = "updated_at")
    val updatedAt: Long,

    @ColumnInfo(name = "last_sync_timestamp")
    val lastSyncTimestamp: Long = System.currentTimeMillis(),

    @ColumnInfo(name = "sync_version")
    val syncVersion: Int = 1
) {
    companion object {
        private const val SYNC_THRESHOLD_MS = TimeUnit.HOURS.toMillis(1)
        private val gson = Gson()

        /**
         * Creates an AthleteEntity from a domain model with encrypted sensitive fields.
         */
        fun fromDomainModel(athlete: Athlete): AthleteEntity {
            return AthleteEntity(
                id = athlete.id,
                encryptedName = SecurityUtils.encryptData(athlete.name.toByteArray()).let { 
                    gson.toJson(it)
                },
                encryptedEmail = SecurityUtils.encryptData(athlete.email.toByteArray()).let {
                    gson.toJson(it)
                },
                teamId = athlete.teamId,
                baselineDataJson = gson.toJson(athlete.baselineData),
                preferencesJson = gson.toJson(athlete.preferences),
                createdAt = athlete.createdAt,
                updatedAt = athlete.updatedAt
            )
        }
    }

    /**
     * Converts database entity to domain model with decrypted fields.
     * @throws SecurityException if decryption fails
     * @throws IllegalStateException if JSON parsing fails
     */
    fun toDomainModel(): Athlete {
        val decryptedName = SecurityUtils.decryptData(
            gson.fromJson(encryptedName, EncryptedData::class.java)
        ).toString(Charsets.UTF_8)

        val decryptedEmail = SecurityUtils.decryptData(
            gson.fromJson(encryptedEmail, EncryptedData::class.java)
        ).toString(Charsets.UTF_8)

        return Athlete(
            id = id,
            name = decryptedName,
            email = decryptedEmail,
            teamId = teamId,
            baselineData = gson.fromJson(baselineDataJson, BaselineData::class.java),
            preferences = gson.fromJson(preferencesJson, AthletePreferences::class.java),
            createdAt = createdAt,
            updatedAt = updatedAt
        ).also {
            require(it.validate().isValid) {
                "Invalid athlete data after conversion"
            }
        }
    }

    /**
     * Determines if entity needs synchronization with server.
     * @return true if sync is needed based on timestamp and version
     */
    fun needsSync(): Boolean {
        val currentTime = System.currentTimeMillis()
        return (currentTime - lastSyncTimestamp > SYNC_THRESHOLD_MS) ||
                syncVersion > 1
    }

    /**
     * Validates the encrypted data integrity.
     * @return true if all encrypted fields are valid
     */
    fun validateEncryption(): Boolean {
        return try {
            // Attempt to decrypt and validate fields
            val nameData = gson.fromJson(encryptedName, EncryptedData::class.java)
            val emailData = gson.fromJson(encryptedEmail, EncryptedData::class.java)

            SecurityUtils.decryptData(nameData)
            SecurityUtils.decryptData(emailData)
            true
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Creates a copy with updated sync information.
     * @param syncTimestamp the new sync timestamp
     * @return updated entity copy
     */
    fun withUpdatedSync(syncTimestamp: Long = System.currentTimeMillis()): AthleteEntity {
        return copy(
            lastSyncTimestamp = syncTimestamp,
            syncVersion = 1
        )
    }
}

/**
 * Room type converters for complex object serialization.
 */
class AthleteConverters {
    private val gson = Gson()

    @androidx.room.TypeConverter
    fun fromEncryptedData(value: String): EncryptedData? {
        return try {
            gson.fromJson(value, EncryptedData::class.java)
        } catch (e: Exception) {
            null
        }
    }

    @androidx.room.TypeConverter
    fun toEncryptedData(encryptedData: EncryptedData?): String {
        return gson.toJson(encryptedData)
    }
}