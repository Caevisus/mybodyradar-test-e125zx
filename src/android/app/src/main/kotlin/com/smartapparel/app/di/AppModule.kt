package com.smartapparel.app.di

import android.app.Application
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.asCoroutineDispatcher
import javax.inject.Singleton
import java.util.concurrent.Executors
import com.smartapparel.app.utils.SAMPLING_RATES
import com.smartapparel.app.utils.DATA_CONFIG
import com.smartapparel.app.services.SensorService
import com.smartapparel.app.domain.models.SensorData
import com.smartapparel.app.data.repository.SensorRepository
import com.smartapparel.app.data.api.ApiService
import com.smartapparel.app.data.api.GraphQLService
import com.smartapparel.app.data.api.WebSocketService

/**
 * Primary Dagger Hilt module providing application-level dependencies with optimized configurations
 * for real-time sensor data processing and analytics.
 *
 * Key features:
 * - Optimized thread pool for real-time processing (<100ms latency)
 * - Configurable buffer sizes for sensor data (IMU: 200Hz, ToF: 100Hz)
 * - Memory-efficient coroutine scope management
 * - Performance monitoring and error handling
 */
@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    /**
     * Provides singleton Application instance with validation and error handling configuration.
     */
    @Provides
    @Singleton
    fun provideApplication(@ApplicationContext application: Application): Application {
        // Configure global exception handler
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            // Log crash analytics
            application.reportCrash(throwable)
        }

        // Initialize performance monitoring
        initializePerformanceMonitoring(application)

        return application
    }

    /**
     * Provides optimized CoroutineScope for real-time sensor data processing.
     * Configured for <100ms processing latency with proper error handling.
     */
    @Provides
    @Singleton
    fun provideApplicationScope(): CoroutineScope {
        // Create optimized thread pool for real-time processing
        val threadPool = Executors.newFixedThreadPool(
            Runtime.getRuntime().availableProcessors() * 2
        ) { runnable ->
            Thread(runnable).apply {
                priority = Thread.MAX_PRIORITY
                name = "RealTimeProcessor-${hashCode()}"
            }
        }

        // Configure dispatcher with optimized thread pool
        val dispatcher = threadPool.asCoroutineDispatcher()

        return CoroutineScope(
            SupervisorJob() + 
            dispatcher + 
            CoroutineExceptionHandler { _, throwable ->
                // Handle coroutine errors
                logProcessingError(throwable)
            }
        )
    }

    /**
     * Provides singleton AnalyticsProcessor configured for real-time sensor data processing
     * with optimized performance and error handling.
     */
    @Provides
    @Singleton
    fun provideAnalyticsProcessor(
        sensorService: SensorService,
        scope: CoroutineScope
    ): AnalyticsProcessor {
        return AnalyticsProcessor(
            sensorService = sensorService,
            processingScope = scope,
            config = AnalyticsConfig(
                // Configure for real-time processing (<100ms latency)
                processingWindow = SAMPLING_RATES.PROCESSING_WINDOW_MS,
                bufferSize = DATA_CONFIG.BUFFER_SIZE,
                
                // Configure sampling rates
                imuSamplingRate = SAMPLING_RATES.IMU_HZ, // 200Hz
                tofSamplingRate = SAMPLING_RATES.TOF_HZ, // 100Hz
                
                // Configure data compression
                compressionRatio = DATA_CONFIG.COMPRESSION_RATIO, // 10:1 ratio
                
                // Configure performance monitoring
                performanceTracking = true,
                latencyThresholdMs = 100L
            )
        ).apply {
            // Initialize performance monitoring
            initializeMetrics()
            
            // Configure error handling
            setErrorHandler { error ->
                when (error) {
                    is ProcessingLatencyException -> handleLatencyViolation(error)
                    is SensorDataException -> handleSensorError(error)
                    else -> handleGeneralError(error)
                }
            }
        }
    }

    private fun Application.reportCrash(throwable: Throwable) {
        // Implementation for crash reporting
    }

    private fun initializePerformanceMonitoring(application: Application) {
        // Implementation for performance monitoring initialization
    }

    private fun logProcessingError(throwable: Throwable) {
        // Implementation for error logging
    }

    private fun handleLatencyViolation(error: ProcessingLatencyException) {
        // Implementation for latency violation handling
    }

    private fun handleSensorError(error: SensorDataException) {
        // Implementation for sensor error handling
    }

    private fun handleGeneralError(error: Throwable) {
        // Implementation for general error handling
    }
}

/**
 * Configuration class for analytics processing
 */
private data class AnalyticsConfig(
    val processingWindow: Int,
    val bufferSize: Int,
    val imuSamplingRate: Int,
    val tofSamplingRate: Int,
    val compressionRatio: Float,
    val performanceTracking: Boolean,
    val latencyThresholdMs: Long
)

/**
 * Custom exceptions for error handling
 */
private class ProcessingLatencyException(message: String) : Exception(message)
private class SensorDataException(message: String) : Exception(message)