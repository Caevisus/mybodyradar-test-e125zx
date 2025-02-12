package com.smartapparel.app.data.db.entities

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.ColumnInfo
import androidx.room.TypeConverters
import com.google.gson.annotations.SerializedName
import com.google.gson.Gson
import com.smartapparel.app.domain.models.Team
import com.smartapparel.app.domain.models.TeamSettings
import com.smartapparel.security.Encryption // v1.0.0
import kotlin.jvm.Synchronized
import java.util.UUID

/**
 * Room database entity representing a team with enhanced analytics support and security features.
 * Implements field-level encryption for sensitive data using AES-256.
 */
@Entity(
    tableName = "teams",
    indices = [
        Index(value = ["organizationId"], name = "idx_team_org"),
        Index(value = ["name"], name = "idx_team_name")
    ]
)
@TypeConverters(TeamConverters::class)
data class TeamEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    @SerializedName("id")
    val id: String,

    @ColumnInfo(name = "name")
    @SerializedName("name")
    val name: String,

    @ColumnInfo(name = "athlete_ids_json", typeAffinity = ColumnInfo.TEXT)
    @SerializedName("athleteIdsJson")
    val athleteIdsJson: String,

    @ColumnInfo(name = "settings_json", typeAffinity = ColumnInfo.TEXT)
    @SerializedName("settingsJson")
    val settingsJson: String,

    @ColumnInfo(name = "organization_id")
    @SerializedName("organizationId")
    val organizationId: String,

    @ColumnInfo(name = "stats_json", typeAffinity = ColumnInfo.TEXT)
    @SerializedName("statsJson")
    val statsJson: String,

    @ColumnInfo(name = "created_at")
    @SerializedName("createdAt")
    val createdAt: Long,

    @ColumnInfo(name = "updated_at")
    @SerializedName("updatedAt")
    val updatedAt: Long,

    @ColumnInfo(name = "encrypted_data")
    @SerializedName("encryptedData")
    val encryptedData: String,

    @ColumnInfo(name = "is_active", defaultValue = "1")
    @SerializedName("isActive")
    val isActive: Boolean = true
) {
    companion object {
        private val gson = Gson()
        private const val ENCRYPTION_ALGORITHM = "AES/GCM/NoPadding"
        private const val KEY_SIZE = 256
    }

    /**
     * Creates a new TeamEntity instance with required validation and initialization.
     */
    constructor(id: String, name: String, organizationId: String) : this(
        id = validateId(id),
        name = validateName(name),
        athleteIdsJson = "[]",
        settingsJson = gson.toJson(TeamSettings()),
        organizationId = validateOrganizationId(organizationId),
        statsJson = "{}",
        createdAt = System.currentTimeMillis(),
        updatedAt = System.currentTimeMillis(),
        encryptedData = "",
        isActive = true
    )

    /**
     * Thread-safe conversion of entity to domain model with validation and decryption.
     */
    @Synchronized
    fun toTeam(): Team {
        try {
            // Decrypt sensitive data
            val decryptedData = Encryption.decrypt(
                encryptedData,
                ENCRYPTION_ALGORITHM,
                KEY_SIZE
            )

            // Parse JSON data
            val athleteIds = gson.fromJson(athleteIdsJson, Array<String>::class.java).toList()
            val settings = gson.fromJson(settingsJson, TeamSettings::class.java)

            // Create and validate domain model
            return Team(
                id = id,
                name = name,
                athleteIds = athleteIds,
                settings = settings,
                organizationId = organizationId,
                createdAt = createdAt,
                updatedAt = updatedAt
            ).also {
                require(it.validate()) { "Invalid team data during conversion" }
            }
        } catch (e: Exception) {
            throw IllegalStateException("Failed to convert TeamEntity to Team: ${e.message}")
        }
    }

    /**
     * Thread-safe creation of entity from domain model with validation and encryption.
     */
    @Synchronized
    fun fromTeam(team: Team): TeamEntity {
        try {
            require(team.validate()) { "Invalid team data" }

            // Convert collections to JSON
            val athleteIdsJson = gson.toJson(team.athleteIds)
            val settingsJson = gson.toJson(team.settings)
            val statsJson = "{}" // Initialize empty stats

            // Encrypt sensitive data
            val sensitiveData = mapOf(
                "name" to team.name,
                "athleteIds" to team.athleteIds
            )
            val encryptedData = Encryption.encrypt(
                gson.toJson(sensitiveData),
                ENCRYPTION_ALGORITHM,
                KEY_SIZE
            )

            return TeamEntity(
                id = team.id,
                name = team.name,
                athleteIdsJson = athleteIdsJson,
                settingsJson = settingsJson,
                organizationId = team.organizationId,
                statsJson = statsJson,
                createdAt = team.createdAt,
                updatedAt = team.updatedAt,
                encryptedData = encryptedData
            )
        } catch (e: Exception) {
            throw IllegalStateException("Failed to create TeamEntity from Team: ${e.message}")
        }
    }

    private companion object {
        fun validateId(id: String): String {
            require(id.isNotBlank()) { "Team ID cannot be empty" }
            try {
                UUID.fromString(id)
            } catch (e: IllegalArgumentException) {
                throw IllegalArgumentException("Invalid team ID format")
            }
            return id
        }

        fun validateName(name: String): String {
            require(name.length in Team.MIN_NAME_LENGTH..Team.MAX_NAME_LENGTH) {
                "Team name must be between ${Team.MIN_NAME_LENGTH} and ${Team.MAX_NAME_LENGTH} characters"
            }
            return name
        }

        fun validateOrganizationId(organizationId: String): String {
            require(organizationId.isNotBlank()) { "Organization ID cannot be empty" }
            try {
                UUID.fromString(organizationId)
            } catch (e: IllegalArgumentException) {
                throw IllegalArgumentException("Invalid organization ID format")
            }
            return organizationId
        }
    }
}

/**
 * Type converters for Room database with thread safety.
 */
class TeamConverters {
    private val gson = Gson()

    @TypeConverter
    @Synchronized
    fun fromTeamSettingsJson(value: String): TeamSettings {
        return gson.fromJson(value, TeamSettings::class.java)
    }

    @TypeConverter
    @Synchronized
    fun toTeamSettingsJson(settings: TeamSettings): String {
        return gson.toJson(settings)
    }
}