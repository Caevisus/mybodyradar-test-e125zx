package com.smartapparel.app.domain.usecases

import com.smartapparel.app.data.repository.AlertRepository
import com.smartapparel.app.domain.models.Alert
import kotlinx.coroutines.flow.Flow // version: 1.7.0
import javax.inject.Inject // version: 1
import androidx.room.Transaction // version: 2.5.0
import javax.cache.Cache // version: 1.1.1

/**
 * Use case for retrieving all alerts with pagination and memory optimization.
 * Implements caching strategy for improved performance.
 */
class GetAllAlertsUseCase @Inject constructor(
    private val alertRepository: AlertRepository,
    private val alertCache: Cache<String, List<Alert>>
) {
    companion object {
        private const val CACHE_KEY_PREFIX = "alerts_page_"
        private const val CACHE_DURATION_MS = 5 * 60 * 1000L // 5 minutes
    }

    @Transaction
    suspend operator fun invoke(page: Int, pageSize: Int): Flow<List<Alert>> {
        val cacheKey = "$CACHE_KEY_PREFIX${page}_$pageSize"
        val cachedData = alertCache.get(cacheKey)
        
        if (cachedData != null) {
            return kotlinx.coroutines.flow.flowOf(cachedData)
        }

        val offset = page * pageSize
        return alertRepository.getAllAlerts(pageSize, offset).also { flow ->
            flow.collect { alerts ->
                alertCache.put(cacheKey, alerts)
            }
        }
    }
}

/**
 * Use case for retrieving currently active alerts with real-time updates.
 * Supports immediate notification requirements for critical alerts.
 */
class GetActiveAlertsUseCase @Inject constructor(
    private val alertRepository: AlertRepository,
    private val activeAlertCache: Cache<String, List<Alert>>
) {
    companion object {
        private const val ACTIVE_ALERTS_CACHE_KEY = "active_alerts"
        private const val CACHE_DURATION_MS = 30 * 1000L // 30 seconds
    }

    @Transaction
    operator fun invoke(): Flow<List<Alert>> {
        val cachedData = activeAlertCache.get(ACTIVE_ALERTS_CACHE_KEY)
        if (cachedData != null && System.currentTimeMillis() - (activeAlertCache.get("last_update") as Long? ?: 0) < CACHE_DURATION_MS) {
            return kotlinx.coroutines.flow.flowOf(cachedData)
        }

        return alertRepository.getActiveAlerts().also { flow ->
            flow.collect { alerts ->
                activeAlertCache.put(ACTIVE_ALERTS_CACHE_KEY, alerts)
                activeAlertCache.put("last_update", System.currentTimeMillis())
            }
        }
    }
}

/**
 * Use case for creating new alerts with validation and error handling.
 * Ensures data integrity and proper alert classification.
 */
class CreateAlertUseCase @Inject constructor(
    private val alertRepository: AlertRepository
) {
    @Transaction
    suspend operator fun invoke(alert: Alert): Result<Long> = try {
        validateAlert(alert)
        val result = alertRepository.createAlert(alert)
        Result.success(result)
    } catch (e: Exception) {
        Result.failure(e)
    }

    private fun validateAlert(alert: Alert) {
        require(alert.id.isNotBlank()) { "Alert ID cannot be empty" }
        require(alert.message.isNotBlank()) { "Alert message cannot be empty" }
        require(alert.details.confidenceScore in 0.0..1.0) { "Confidence score must be between 0 and 1" }
        require(alert.timestamp <= System.currentTimeMillis()) { "Alert timestamp cannot be in the future" }
        
        when (alert.severity) {
            Alert.ALERT_SEVERITY.CRITICAL -> require(alert.details.exceedsThreshold()) {
                "Critical alerts must exceed defined thresholds"
            }
            else -> { /* Other severity levels don't require threshold validation */ }
        }
    }
}

/**
 * Use case for updating existing alerts with validation and transaction support.
 * Handles alert status transitions and acknowledgment.
 */
class UpdateAlertUseCase @Inject constructor(
    private val alertRepository: AlertRepository
) {
    @Transaction
    suspend operator fun invoke(alert: Alert): Result<Boolean> = try {
        validateUpdateRequest(alert)
        val result = alertRepository.updateAlert(alert)
        Result.success(result > 0)
    } catch (e: Exception) {
        Result.failure(e)
    }

    private suspend fun validateUpdateRequest(alert: Alert) {
        val existingAlert = alertRepository.getAlertById(alert.id)
        requireNotNull(existingAlert) { "Alert not found" }

        when (alert.status) {
            Alert.STATUS_RESOLVED -> require(alert.acknowledged) {
                "Alert must be acknowledged before marking as resolved"
            }
            Alert.STATUS_DISMISSED -> require(alert.acknowledgedBy != null) {
                "Alert must have an acknowledging user when dismissed"
            }
            Alert.STATUS_ACTIVE -> require(!existingAlert.acknowledged) {
                "Cannot reactivate an acknowledged alert"
            }
        }

        require(alert.timestamp >= existingAlert.timestamp) {
            "Cannot backdate alert timestamps"
        }
    }
}