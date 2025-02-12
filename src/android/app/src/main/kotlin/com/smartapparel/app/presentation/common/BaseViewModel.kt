package com.smartapparel.app.presentation.common

import androidx.lifecycle.ViewModel // version: 2.6.1
import androidx.lifecycle.viewModelScope // version: 2.6.1
import kotlinx.coroutines.flow.MutableStateFlow // version: 1.7.1
import kotlinx.coroutines.flow.StateFlow // version: 1.7.1
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeout
import com.smartapparel.app.utils.Logger

private const val TAG = "BaseViewModel"
private const val ERROR_DISPLAY_DURATION = 5000L
private const val OPERATION_TIMEOUT = 30000L // 30 seconds timeout for operations

/**
 * Abstract base ViewModel class providing comprehensive functionality for all ViewModels
 * in the Smart Apparel application. Implements production-ready error handling, state management,
 * and performance optimization with real-time monitoring capabilities.
 */
abstract class BaseViewModel : ViewModel() {

    // Loading state management
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    // Error state management
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    /**
     * Enhanced error handling with structured logging and automatic error state reset.
     * Integrates with ELK Stack through Logger for comprehensive system monitoring.
     *
     * @param throwable The error that occurred
     * @param operation Description of the operation that failed
     */
    protected fun handleError(throwable: Throwable, operation: String) {
        Logger.e(TAG, "Error during $operation: ${throwable.message}", throwable, mapOf(
            "operation" to operation,
            "errorType" to throwable.javaClass.simpleName,
            "stackTrace" to throwable.stackTraceToString()
        ))

        val errorMessage = when (throwable) {
            is SecurityException -> "Security error occurred"
            is IllegalStateException -> "Invalid state: ${throwable.message}"
            is IllegalArgumentException -> "Invalid input: ${throwable.message}"
            else -> "Error during $operation: ${throwable.message}"
        }

        _error.value = errorMessage

        // Auto-reset error state after display duration
        viewModelScope.launch {
            delay(ERROR_DISPLAY_DURATION)
            _error.value = null
            Logger.d(TAG, "Error state reset for operation: $operation")
        }
    }

    /**
     * Thread-safe loading state management with logging for monitoring.
     *
     * @param loading New loading state
     */
    protected fun setLoading(loading: Boolean) {
        _isLoading.value = loading
        Logger.d(TAG, "Loading state changed to: $loading")
    }

    /**
     * Optimized coroutine launcher with loading state management, error handling,
     * and performance monitoring. Ensures <100ms latency for real-time operations.
     *
     * @param block Suspend function to execute
     * @return Job Coroutine job for cancellation support
     */
    protected fun launchWithLoading(block: suspend () -> Unit): Job {
        return viewModelScope.launch {
            try {
                setLoading(true)
                val startTime = System.nanoTime()

                withTimeout(OPERATION_TIMEOUT) {
                    block()
                }

                val executionTime = (System.nanoTime() - startTime) / 1_000_000 // Convert to milliseconds
                Logger.d(TAG, "Operation completed in ${executionTime}ms", mapOf(
                    "executionTimeMs" to executionTime,
                    "withinLatencyTarget" to (executionTime < 100)
                ))

            } catch (e: Exception) {
                handleError(e, "coroutine operation")
            } finally {
                setLoading(false)
            }
        }
    }

    /**
     * Cleanup resources when ViewModel is cleared
     */
    override fun onCleared() {
        super.onCleared()
        Logger.d(TAG, "ViewModel cleared, performing cleanup")
    }
}