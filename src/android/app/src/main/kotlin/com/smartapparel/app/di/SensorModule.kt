package com.smartapparel.app.di

import dagger.Module // version: 2.48
import dagger.Provides // version: 2.48
import dagger.hilt.InstallIn // version: 2.48
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton // version: 1
import com.smartapparel.app.services.SensorService
import com.smartapparel.app.services.BluetoothService
import com.smartapparel.app.data.repository.SensorRepository
import com.smartapparel.app.data.db.dao.SensorDataDao
import com.smartapparel.app.utils.SAMPLING_RATES
import com.smartapparel.app.utils.DATA_CONFIG
import com.smartapparel.app.utils.BLUETOOTH_CONFIG

/**
 * Dagger Hilt module providing dependency injection bindings for sensor-related components.
 * Configures sensor services with optimized sampling rates, power management, and data compression.
 *
 * Key configurations:
 * - IMU Sampling Rate: 200Hz
 * - ToF Sampling Rate: 100Hz
 * - Data Compression: 10:1 ratio
 * - Processing Latency: <100ms
 * - Local Buffer Size: 1GB
 */
@Module
@InstallIn(SingletonComponent::class)
class SensorModule {

    /**
     * Provides singleton instance of SensorService configured with optimal sampling rates
     * and data processing parameters.
     *
     * @param bluetoothService Injected BluetoothService for sensor communication
     * @param sensorRepository Injected SensorRepository for data persistence
     * @return Configured SensorService instance
     */
    @Provides
    @Singleton
    fun provideSensorService(
        bluetoothService: BluetoothService,
        sensorRepository: SensorRepository
    ): SensorService {
        return SensorService(
            bluetoothService = bluetoothService,
            sensorRepository = sensorRepository
        ).apply {
            // Configure sampling rates based on technical specifications
            configureSensorSampling(
                imuRate = SAMPLING_RATES.IMU_HZ, // 200Hz
                tofRate = SAMPLING_RATES.TOF_HZ   // 100Hz
            )
            
            // Initialize local buffering with compression
            initializeBuffering(
                bufferSize = DATA_CONFIG.BUFFER_SIZE,
                compressionRatio = DATA_CONFIG.COMPRESSION_RATIO
            )
        }
    }

    /**
     * Provides singleton instance of BluetoothService with power optimization
     * and real-time data transfer configuration.
     *
     * @return Configured BluetoothService instance
     */
    @Provides
    @Singleton
    fun provideBluetoothService(): BluetoothService {
        return BluetoothService().apply {
            // Configure Bluetooth parameters for optimal performance
            setMtuSize(BLUETOOTH_CONFIG.MTU_SIZE)
            configurePowerMode(
                scanInterval = BLUETOOTH_CONFIG.SCAN_PERIOD_MS,
                connectionTimeout = BLUETOOTH_CONFIG.CONNECTION_TIMEOUT_MS
            )
        }
    }

    /**
     * Provides singleton instance of SensorRepository with optimized storage
     * and data compression capabilities.
     *
     * @param sensorDataDao Injected DAO for database operations
     * @return Configured SensorRepository instance
     */
    @Provides
    @Singleton
    fun provideSensorRepository(sensorDataDao: SensorDataDao): SensorRepository {
        return SensorRepository(
            sensorDataDao = sensorDataDao,
            storageManager = StorageManager(
                maxStorageMb = DATA_CONFIG.MAX_LOCAL_STORAGE_MB,
                compressionRatio = DATA_CONFIG.COMPRESSION_RATIO
            ),
            metricsCollector = MetricsCollector()
        ).apply {
            // Configure data compression and validation
            configureCompression(
                targetRatio = DATA_CONFIG.COMPRESSION_RATIO,
                validateIntegrity = true
            )
        }
    }
}