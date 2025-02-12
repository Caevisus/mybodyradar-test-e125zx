package com.smartapparel.app.services

import android.app.Service // version: API 29+
import android.content.Intent
import android.os.IBinder
import android.os.PowerManager
import androidx.annotation.VisibleForTesting
import dagger.hilt.android.AndroidEntryPoint // version: 2.44
import javax.inject.Inject // version: 1
import kotlinx.coroutines.* // version: 1.7.3
import kotlinx.coroutines.flow.*
import com.smartapparel.app.data.repository.SensorRepository
import com.smartapparel.app.domain.models.SensorData
import com.smartapparel.app.domain.models.IMUData
import com.smartapparel.app.domain.models.ToFData
import com.smartapparel.app.utils.SAMPLING_RATES
import com.smartapparel.app.utils.SENSOR_STATUS
import com.smartapparel.app.utils.DATA_CONFIG
import com.smartapparel.app.utils.CALIBRATION_PARAMS
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.abs

@AndroidEntryPoint
class SensorService @Inject constructor(
    private val bluetoothService: BluetoothService,
    private val sensorRepository: SensorRepository
) : Service() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val activeSensors = ConcurrentHashMap<String, Job>()
    private val isProcessing = AtomicBoolean(false)
    
    private val _sensorDataFlow = MutableStateFlow<Map<String, SensorData>>(emptyMap())
    val sensorDataFlow: StateFlow<Map<String, SensorData>> = _sensorDataFlow.asStateFlow()
    
    private lateinit var powerManager: PowerManager
    private lateinit var wakeLock: PowerManager.WakeLock
    
    private val samplingController = AdaptiveSamplingController(
        baseImuRate = SAMPLING_RATES.IMU_HZ,
        baseTofRate = SAMPLING_RATES.TOF_HZ
    )
    
    private val dataProcessor = DataProcessor(
        compressionRatio = DATA_CONFIG.COMPRESSION_RATIO,
        bufferSize = DATA_CONFIG.BUFFER_SIZE,
        processingWindow = SAMPLING_RATES.PROCESSING_WINDOW_MS
    )

    override fun onCreate() {
        super.onCreate()
        powerManager = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "SmartApparel::SensorServiceWakeLock"
        )
        wakeLock.acquire(10*60*1000L) // 10 minutes timeout
    }

    override fun onBind(intent: Intent?): IBinder? = null

    suspend fun startSensorMonitoring(sensorId: String): Flow<SensorData> = flow {
        if (activeSensors.containsKey(sensorId)) {
            throw IllegalStateException("Sensor $sensorId is already being monitored")
        }

        val monitoringJob = serviceScope.launch {
            try {
                // Initialize sensor connection with retry mechanism
                var retryCount = 0
                var connected = false
                while (retryCount < 3 && !connected) {
                    connected = bluetoothService.connectToDevice(sensorId)
                    if (!connected) {
                        delay(1000)
                        retryCount++
                    }
                }
                if (!connected) throw IllegalStateException("Failed to connect to sensor $sensorId")

                // Configure sensor with optimal parameters
                configureSensor(sensorId)

                // Start data collection with adaptive sampling
                bluetoothService.getSensorData(sensorId)
                    .buffer(Channel.BUFFERED)
                    .collect { rawData ->
                        if (isProcessing.compareAndSet(false, true)) {
                            try {
                                val processedData = processSensorData(rawData)
                                updateSensorData(sensorId, processedData)
                                emit(processedData)
                                
                                // Store processed data
                                sensorRepository.insertSensorDataBatch(listOf(processedData))
                            } finally {
                                isProcessing.set(false)
                            }
                        }
                    }
            } catch (e: Exception) {
                updateSensorStatus(sensorId, SENSOR_STATUS.ERROR)
                throw e
            }
        }
        
        activeSensors[sensorId] = monitoringJob
        monitoringJob.join()
    }.catch { e ->
        stopSensorMonitoring(sensorId)
        throw e
    }

    suspend fun stopSensorMonitoring(sensorId: String) {
        activeSensors[sensorId]?.let { job ->
            job.cancelAndJoin()
            activeSensors.remove(sensorId)
            updateSensorStatus(sensorId, SENSOR_STATUS.DISCONNECTED)
        }
    }

    suspend fun calibrateSensor(sensorId: String): Boolean {
        return withTimeoutOrNull(CALIBRATION_PARAMS.CALIBRATION_TIMEOUT_MS) {
            try {
                updateSensorStatus(sensorId, SENSOR_STATUS.CALIBRATING)
                
                // Collect calibration samples
                val samples = mutableListOf<SensorData>()
                bluetoothService.getSensorData(sensorId)
                    .take(CALIBRATION_PARAMS.CALIBRATION_SAMPLES)
                    .collect { samples.add(it) }

                // Process calibration data
                val imuCalibration = calibrateIMU(samples)
                val tofCalibration = calibrateTOF(samples)

                // Apply calibration parameters
                bluetoothService.configureSensor(sensorId, mapOf(
                    "imu_drift" to imuCalibration.driftCorrection,
                    "tof_gain" to tofCalibration.gain
                ))

                updateSensorStatus(sensorId, SENSOR_STATUS.ACTIVE)
                true
            } catch (e: Exception) {
                updateSensorStatus(sensorId, SENSOR_STATUS.ERROR)
                false
            }
        } ?: false
    }

    private fun processSensorData(rawData: SensorData): SensorData {
        return dataProcessor.process(rawData) { data ->
            // Apply noise reduction and filtering
            val filteredImu = data.imuData?.let { imu ->
                IMUData(
                    accelerometer = applyKalmanFilter(imu.accelerometer),
                    gyroscope = applyKalmanFilter(imu.gyroscope),
                    magnetometer = applyKalmanFilter(imu.magnetometer),
                    temperature = imu.temperature
                )
            }

            val filteredTof = data.tofData?.let { tof ->
                ToFData(
                    distances = applyMedianFilter(tof.distances),
                    gain = tof.gain,
                    ambientLight = tof.ambientLight
                )
            }

            // Update sampling rates based on activity
            samplingController.adjustSamplingRates(filteredImu, filteredTof)

            data.copy(
                imuData = filteredImu,
                tofData = filteredTof
            )
        }
    }

    private fun updateSensorData(sensorId: String, data: SensorData) {
        _sensorDataFlow.update { currentMap ->
            currentMap + (sensorId to data)
        }
    }

    private fun updateSensorStatus(sensorId: String, status: SENSOR_STATUS) {
        _sensorDataFlow.update { currentMap ->
            currentMap[sensorId]?.let { data ->
                currentMap + (sensorId to data.copy(status = status))
            } ?: currentMap
        }
    }

    @VisibleForTesting
    internal fun applyKalmanFilter(values: FloatArray): FloatArray {
        // Kalman filter implementation for noise reduction
        val result = FloatArray(values.size)
        var estimate = values[0]
        var errorEstimate = 1.0f
        val measurementNoise = 0.1f
        val processNoise = 0.1f

        for (i in values.indices) {
            val kalmanGain = errorEstimate / (errorEstimate + measurementNoise)
            estimate += kalmanGain * (values[i] - estimate)
            errorEstimate = (1 - kalmanGain) * errorEstimate + abs(processNoise)
            result[i] = estimate
        }
        return result
    }

    @VisibleForTesting
    internal fun applyMedianFilter(values: FloatArray, windowSize: Int = 5): FloatArray {
        val result = FloatArray(values.size)
        val window = FloatArray(windowSize)
        val halfWindow = windowSize / 2

        for (i in values.indices) {
            for (j in 0 until windowSize) {
                val idx = i - halfWindow + j
                window[j] = when {
                    idx < 0 -> values[0]
                    idx >= values.size -> values[values.size - 1]
                    else -> values[idx]
                }
            }
            window.sort()
            result[i] = window[halfWindow]
        }
        return result
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
        if (wakeLock.isHeld) wakeLock.release()
    }

    private inner class AdaptiveSamplingController(
        private val baseImuRate: Int,
        private val baseTofRate: Int
    ) {
        private var currentImuRate = baseImuRate
        private var currentTofRate = baseTofRate

        fun adjustSamplingRates(imuData: IMUData?, tofData: ToFData?) {
            // Implement adaptive sampling based on activity level and sensor data
            imuData?.let { imu ->
                val activityLevel = calculateActivityLevel(imu)
                currentImuRate = when {
                    activityLevel > 0.8f -> (baseImuRate * 1.5f).toInt()
                    activityLevel < 0.2f -> (baseImuRate * 0.5f).toInt()
                    else -> baseImuRate
                }
            }

            tofData?.let { tof ->
                val variability = calculateDistanceVariability(tof)
                currentTofRate = when {
                    variability > 0.8f -> (baseTofRate * 1.5f).toInt()
                    variability < 0.2f -> (baseTofRate * 0.5f).toInt()
                    else -> baseTofRate
                }
            }
        }

        private fun calculateActivityLevel(imuData: IMUData): Float {
            val accelMagnitude = imuData.accelerometer.map { abs(it) }.average().toFloat()
            val gyroMagnitude = imuData.gyroscope.map { abs(it) }.average().toFloat()
            return (accelMagnitude + gyroMagnitude) / 2
        }

        private fun calculateDistanceVariability(tofData: ToFData): Float {
            val mean = tofData.distances.average()
            val variance = tofData.distances.map { (it - mean) * (it - mean) }.average()
            return (variance / mean).toFloat()
        }
    }

    private inner class DataProcessor(
        private val compressionRatio: Float,
        private val bufferSize: Int,
        private val processingWindow: Int
    ) {
        private val buffer = CircularBuffer<SensorData>(bufferSize)

        fun process(data: SensorData, processor: (SensorData) -> SensorData): SensorData {
            buffer.add(data)
            
            return if (buffer.size >= processingWindow) {
                val windowData = buffer.getWindow(processingWindow)
                val processedData = processor(data)
                
                // Validate processing latency
                val processingTime = System.currentTimeMillis() - data.timestamp
                require(processingTime <= 100) { 
                    "Processing latency exceeded 100ms: $processingTime ms" 
                }
                
                processedData
            } else {
                data
            }
        }
    }

    private class CircularBuffer<T>(private val maxSize: Int) {
        private val buffer = ArrayDeque<T>(maxSize)

        @Synchronized
        fun add(item: T) {
            if (buffer.size >= maxSize) {
                buffer.removeFirst()
            }
            buffer.addLast(item)
        }

        @Synchronized
        fun getWindow(size: Int): List<T> {
            return buffer.takeLast(size)
        }

        val size: Int get() = buffer.size
    }

    companion object {
        private const val TAG = "SensorService"
    }
}