package com.smartapparel.app.data.repository

import com.smartapparel.app.data.db.dao.AlertDao // version: 2.6.0
import com.smartapparel.app.data.db.entities.AlertEntity
import com.smartapparel.app.domain.models.Alert
import kotlinx.coroutines.CoroutineDispatcher // version: 1.7.0
import kotlinx.coroutines.flow.Flow // version: 1.7.0
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import javax.inject.Inject // version: 1
import androidx.room.Transaction // version: 2.6.0
import java.util.concurrent.TimeUnit

/**
 * Repository implementation for managing alert data in the smart apparel system.
 * Provides comprehensive alert management with support for:
 * - Real-time alert monitoring
 * - 5-year data retention policy
 * - Optimized query performance
 * - Transaction management
 */
class AlertRepository @Inject constructor(
    private val alertDao: AlertDao,
    private val ioDispatcher: CoroutineDispatcher
) {
    companion object {
        private const val RETENTION_PERIOD_YEARS = 5L
        private const val DEFAULT_PAGE_SIZE = 50
    }

    /**
     * Retrieves all alerts with pagination support.
     * Results are ordered by timestamp for efficient data presentation.
     *
     * @param pageSize Number of alerts per page
     * @param offset Starting position for pagination
     * @return Flow of paginated alerts as domain models
     */
    @Transaction
    fun getAllAlerts(
        pageSize: Int = DEFAULT_PAGE_SIZE,
        offset: Int = 0
    ): Flow<List<Alert>> = alertDao
        .getAllAlerts(pageSize, offset)
        .map { entities -> entities.map { it.toDomainModel() } }
        .flowOn(ioDispatcher)

    /**
     * Retrieves a specific alert by its unique identifier.
     *
     * @param alertId Unique identifier of the alert
     * @return The alert domain model if found, null otherwise
     */
    @Transaction
    suspend fun getAlertById(alertId: String): Alert? = withContext(ioDispatcher) {
        alertDao.getAlertById(alertId)?.toDomainModel()
    }

    /**
     * Retrieves all active alerts ordered by severity and timestamp.
     * Critical alerts appear first for immediate attention.
     *
     * @return Flow of active alerts as domain models
     */
    @Transaction
    fun getActiveAlerts(): Flow<List<Alert>> = alertDao
        .getActiveAlerts()
        .map { entities -> entities.map { it.toDomainModel() } }
        .flowOn(ioDispatcher)

    /**
     * Creates a new alert in the system.
     *
     * @param alert Alert domain model to be created
     * @return ID of the created alert
     */
    @Transaction
    suspend fun createAlert(alert: Alert): Long = withContext(ioDispatcher) {
        alertDao.insertAlert(AlertEntity.fromDomainModel(alert))
    }

    /**
     * Updates an existing alert's information.
     *
     * @param alert Alert domain model with updated information
     * @return Number of alerts updated (0 or 1)
     */
    @Transaction
    suspend fun updateAlert(alert: Alert): Int = withContext(ioDispatcher) {
        alertDao.updateAlert(AlertEntity.fromDomainModel(alert))
    }

    /**
     * Deletes a specific alert from the system.
     *
     * @param alert Alert domain model to be deleted
     * @return Number of alerts deleted (0 or 1)
     */
    @Transaction
    suspend fun deleteAlert(alert: Alert): Int = withContext(ioDispatcher) {
        alertDao.deleteAlert(AlertEntity.fromDomainModel(alert))
    }

    /**
     * Removes alerts older than 5 years to maintain data retention policy.
     * This operation is performed within a transaction for data consistency.
     *
     * @return Number of alerts deleted
     */
    @Transaction
    suspend fun deleteOldAlerts(): Int = withContext(ioDispatcher) {
        val cutoffTimestamp = System.currentTimeMillis() - TimeUnit.DAYS.toMillis(RETENTION_PERIOD_YEARS * 365)
        alertDao.deleteOldAlerts(cutoffTimestamp)
    }

    /**
     * Retrieves alerts for a specific training session.
     *
     * @param sessionId Unique identifier of the training session
     * @return Flow of session-specific alerts as domain models
     */
    @Transaction
    fun getAlertsBySession(sessionId: String): Flow<List<Alert>> = alertDao
        .getAlertsBySession(sessionId)
        .map { entities -> entities.map { it.toDomainModel() } }
        .flowOn(ioDispatcher)

    /**
     * Acknowledges an alert by updating its status and acknowledgment details.
     *
     * @param alert Alert to be acknowledged
     * @param acknowledgedBy ID of the user acknowledging the alert
     * @return Number of alerts updated (0 or 1)
     */
    @Transaction
    suspend fun acknowledgeAlert(alert: Alert, acknowledgedBy: String): Int = withContext(ioDispatcher) {
        val updatedAlert = alert.copy(
            status = Alert.STATUS_RESOLVED,
            acknowledged = true,
            acknowledgedBy = acknowledgedBy,
            acknowledgedAt = System.currentTimeMillis()
        )
        updateAlert(updatedAlert)
    }
}