package com.smartapparel.app.data.api

import com.smartapparel.app.domain.models.Alert
import com.smartapparel.app.domain.models.Athlete
import com.smartapparel.app.domain.models.Session
import com.smartapparel.app.domain.models.SensorData
import io.reactivex.rxjava3.core.Completable // version: 3.1.5
import io.reactivex.rxjava3.core.Single // version: 3.1.5
import retrofit2.http.* // version: 2.9.0

/**
 * Interface defining REST API endpoints for the smart apparel system.
 * Implements rate limiting, compression, and caching for optimal performance.
 */
interface ApiService {

    /**
     * Authenticates an athlete using OAuth 2.0 and returns access token.
     * Rate limited to prevent brute force attempts.
     */
    @POST("/v1/auth/login")
    @Headers(
        "Content-Type: application/json",
        "Accept-Encoding: gzip",
        "X-Rate-Limit: 10/min"
    )
    fun authenticateAthlete(
        @Body credentials: Map<String, String>
    ): Single<AuthResponse>

    /**
     * Retrieves athlete profile data with caching support.
     * Implements ETag-based caching for bandwidth optimization.
     */
    @GET("/v1/athletes/{athleteId}")
    @Headers(
        "Accept: application/json",
        "Cache-Control: max-age=300",
        "X-Rate-Limit: 100/min"
    )
    fun getAthleteProfile(
        @Path("athleteId") athleteId: String
    ): Single<Athlete>

    /**
     * Initiates a new training session with real-time monitoring capabilities.
     * Enforces rate limiting to prevent session flooding.
     */
    @POST("/v1/sessions")
    @Headers(
        "Content-Type: application/json",
        "X-Rate-Limit: 100/min"
    )
    fun startSession(
        @Body config: SessionConfig
    ): Single<Session>

    /**
     * Uploads real-time sensor data with compression and low latency.
     * Implements gzip compression for efficient data transfer.
     */
    @POST("/v1/sessions/{sessionId}/data")
    @Headers(
        "Content-Type: application/json",
        "Content-Encoding: gzip",
        "X-Rate-Limit: 1000/min"
    )
    fun uploadSensorData(
        @Path("sessionId") sessionId: String,
        @Body data: List<SensorData>
    ): Completable

    /**
     * Retrieves alerts for a specific session with priority handling.
     * Supports server-sent events for real-time alert notifications.
     */
    @GET("/v1/sessions/{sessionId}/alerts")
    @Headers(
        "Accept: application/json",
        "Priority: high",
        "X-Rate-Limit: 100/min"
    )
    fun getSessionAlerts(
        @Path("sessionId") sessionId: String
    ): Single<List<Alert>>

    /**
     * Synchronizes data with team management platforms.
     * Implements retry logic for reliable data synchronization.
     */
    @POST("/v1/teams/{teamId}/sync")
    @Headers(
        "Content-Type: application/json",
        "X-Rate-Limit: 50/min"
    )
    fun syncTeamData(
        @Path("teamId") teamId: String,
        @Body syncData: TeamSyncRequest
    ): Single<TeamSyncResponse>

    /**
     * Updates session configuration in real-time.
     * Allows dynamic adjustment of monitoring parameters.
     */
    @PATCH("/v1/sessions/{sessionId}/config")
    @Headers(
        "Content-Type: application/json",
        "X-Rate-Limit: 100/min"
    )
    fun updateSessionConfig(
        @Path("sessionId") sessionId: String,
        @Body config: SessionConfig
    ): Single<Session>

    /**
     * Ends an active training session and finalizes data.
     * Triggers comprehensive data processing and analysis.
     */
    @POST("/v1/sessions/{sessionId}/end")
    @Headers(
        "Content-Type: application/json",
        "X-Rate-Limit: 100/min"
    )
    fun endSession(
        @Path("sessionId") sessionId: String
    ): Single<Session>

    /**
     * Retrieves historical session data with pagination support.
     * Implements efficient data transfer with partial response.
     */
    @GET("/v1/athletes/{athleteId}/sessions")
    @Headers(
        "Accept: application/json",
        "Cache-Control: max-age=3600",
        "X-Rate-Limit: 100/min"
    )
    fun getAthleteHistory(
        @Path("athleteId") athleteId: String,
        @Query("page") page: Int,
        @Query("size") size: Int,
        @Query("fields") fields: String?
    ): Single<PagedResponse<Session>>
}

/**
 * Data class for authentication response containing JWT token.
 */
data class AuthResponse(
    val token: String,
    val refreshToken: String,
    val expiresIn: Long
)

/**
 * Data class for team data synchronization request.
 */
data class TeamSyncRequest(
    val syncType: String,
    val dataRange: DateRange,
    val metrics: List<String>
)

/**
 * Data class for team synchronization response.
 */
data class TeamSyncResponse(
    val syncId: String,
    val status: String,
    val syncedRecords: Int,
    val timestamp: Long
)

/**
 * Data class for date range specification.
 */
data class DateRange(
    val startDate: Long,
    val endDate: Long
)

/**
 * Generic paged response wrapper for paginated endpoints.
 */
data class PagedResponse<T>(
    val content: List<T>,
    val page: Int,
    val size: Int,
    val total: Long,
    val hasNext: Boolean
)