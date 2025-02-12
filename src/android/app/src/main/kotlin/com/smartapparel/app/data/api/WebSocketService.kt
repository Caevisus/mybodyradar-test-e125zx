package com.smartapparel.app.data.api

import android.util.Log
import com.google.gson.Gson // version: 2.10.1
import com.squareup.okhttp3.* // version: 4.11.0
import kotlinx.coroutines.* // version: 1.7.3
import kotlinx.coroutines.flow.*
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.zip.Deflater
import javax.inject.Inject
import javax.inject.Singleton
import com.smartapparel.app.domain.models.SensorData
import com.smartapparel.app.services.SensorService
import com.smartapparel.app.utils.API_CONFIG
import com.smartapparel.app.utils.DATA_CONFIG
import com.smartapparel.app.utils.SENSOR_STATUS

@Singleton
class WebSocketService @Inject constructor(
    private val sensorService: SensorService,
    private val metricsCollector: MetricsCollector,
    private val gson: Gson
) {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val isConnected = AtomicBoolean(false)
    private val deflater = Deflater(Deflater.BEST_COMPRESSION)
    
    private val _connectionStatus = MutableStateFlow(false)
    val connectionStatus: StateFlow<Boolean> = _connectionStatus.asStateFlow()
    
    private val _sensorDataFlow = MutableSharedFlow<SensorData>(
        replay = 0,
        extraBufferCapacity = DATA_CONFIG.BUFFER_SIZE
    )
    val sensorDataFlow: SharedFlow<SensorData> = _sensorDataFlow.asSharedFlow()

    private val client = OkHttpClient.Builder()
        .connectTimeout(API_CONFIG.TIMEOUT_MS, TimeUnit.MILLISECONDS)
        .readTimeout(API_CONFIG.TIMEOUT_MS, TimeUnit.MILLISECONDS)
        .writeTimeout(API_CONFIG.TIMEOUT_MS, TimeUnit.MILLISECONDS)
        .pingInterval(30, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private var webSocket: WebSocket? = null
    private var reconnectJob: Job? = null
    private val activeSensors = mutableSetOf<String>()
    private var retryCount = 0
    private val maxRetries = API_CONFIG.RETRY_ATTEMPTS

    suspend fun connect(serverUrl: String): Flow<Boolean> = flow {
        if (isConnected.get()) {
            throw IllegalStateException("WebSocket is already connected")
        }

        val request = Request.Builder()
            .url(serverUrl)
            .header("User-Agent", "SmartApparel-Android")
            .build()

        try {
            webSocket = client.newWebSocket(request, createWebSocketListener())
            isConnected.set(true)
            _connectionStatus.value = true
            emit(true)

            // Start heartbeat
            startHeartbeat()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to connect to WebSocket", e)
            handleConnectionError(e)
            emit(false)
        }
    }.catch { e ->
        Log.e(TAG, "Error in connect flow", e)
        handleConnectionError(e)
        emit(false)
    }

    suspend fun startDataStream(sensorId: String): Flow<SensorData> = flow {
        if (!isConnected.get()) {
            throw IllegalStateException("WebSocket is not connected")
        }

        activeSensors.add(sensorId)
        try {
            sensorService.startSensorMonitoring(sensorId)
                .buffer(Channel.BUFFERED)
                .collect { sensorData ->
                    val startTime = System.nanoTime()
                    
                    // Compress and send data
                    val compressedData = compressSensorData(sensorData)
                    webSocket?.send(compressedData)
                    
                    // Emit to flow and measure latency
                    _sensorDataFlow.emit(sensorData)
                    
                    val latency = (System.nanoTime() - startTime) / 1_000_000 // Convert to ms
                    require(latency <= 100) { 
                        "Data streaming latency exceeded 100ms: $latency ms" 
                    }
                    
                    metricsCollector.recordMetric("streaming_latency", latency)
                    emit(sensorData)
                }
        } catch (e: Exception) {
            Log.e(TAG, "Error in data stream for sensor $sensorId", e)
            handleStreamError(sensorId, e)
            throw e
        }
    }.catch { e ->
        activeSensors.remove(sensorId)
        stopDataStream(sensorId)
        throw e
    }

    suspend fun stopDataStream(sensorId: String) {
        if (activeSensors.remove(sensorId)) {
            try {
                sensorService.stopSensorMonitoring(sensorId)
                webSocket?.send(createStopStreamMessage(sensorId))
            } catch (e: Exception) {
                Log.e(TAG, "Error stopping data stream for sensor $sensorId", e)
                metricsCollector.recordError("stop_stream", e)
            }
        }
    }

    fun disconnect() {
        serviceScope.launch {
            try {
                activeSensors.toList().forEach { sensorId ->
                    stopDataStream(sensorId)
                }
                
                webSocket?.close(1000, "Client disconnecting")
                webSocket = null
                isConnected.set(false)
                _connectionStatus.value = false
                
                reconnectJob?.cancel()
                reconnectJob = null
                retryCount = 0
                
                deflater.end()
            } catch (e: Exception) {
                Log.e(TAG, "Error during disconnect", e)
                metricsCollector.recordError("disconnect", e)
            }
        }
    }

    private fun createWebSocketListener() = object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            Log.d(TAG, "WebSocket connected")
            retryCount = 0
            _connectionStatus.value = true
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            serviceScope.launch {
                try {
                    handleServerMessage(text)
                } catch (e: Exception) {
                    Log.e(TAG, "Error handling server message", e)
                    metricsCollector.recordError("message_handling", e)
                }
            }
        }

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
            Log.d(TAG, "WebSocket closing: $code - $reason")
            serviceScope.launch {
                handleClosing(code, reason)
            }
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            Log.e(TAG, "WebSocket failure", t)
            serviceScope.launch {
                handleConnectionError(t)
            }
        }
    }

    private fun startHeartbeat() {
        serviceScope.launch {
            while (isConnected.get()) {
                try {
                    webSocket?.send("ping")
                    delay(30000) // 30 seconds
                } catch (e: Exception) {
                    Log.e(TAG, "Heartbeat failed", e)
                    handleConnectionError(e)
                }
            }
        }
    }

    private suspend fun handleConnectionError(error: Throwable) {
        metricsCollector.recordError("connection", error)
        _connectionStatus.value = false
        
        if (retryCount < maxRetries) {
            retryCount++
            val delayMs = calculateRetryDelay(retryCount)
            delay(delayMs)
            
            reconnectJob = serviceScope.launch {
                webSocket?.close(1001, "Reconnecting")
                connect(webSocket?.request()?.url.toString())
            }
        } else {
            Log.e(TAG, "Max retry attempts reached", error)
            disconnect()
        }
    }

    private suspend fun handleStreamError(sensorId: String, error: Throwable) {
        metricsCollector.recordError("stream", error)
        stopDataStream(sensorId)
    }

    private suspend fun handleServerMessage(message: String) {
        val serverMessage = gson.fromJson(message, ServerMessage::class.java)
        when (serverMessage.type) {
            "status" -> handleStatusUpdate(serverMessage)
            "error" -> handleErrorMessage(serverMessage)
            else -> Log.d(TAG, "Unknown message type: ${serverMessage.type}")
        }
    }

    private suspend fun handleClosing(code: Int, reason: String) {
        _connectionStatus.value = false
        if (code != 1000) { // Normal closure
            handleConnectionError(Exception("WebSocket closing: $code - $reason"))
        }
    }

    private fun compressSensorData(sensorData: SensorData): String {
        val json = gson.toJson(sensorData)
        val input = json.toByteArray()
        val output = ByteArray((input.size * 0.1).toInt()) // 10:1 compression ratio
        
        deflater.setInput(input)
        deflater.finish()
        val compressedSize = deflater.deflate(output)
        deflater.reset()
        
        return output.copyOf(compressedSize).toBase64()
    }

    private fun calculateRetryDelay(retryCount: Int): Long {
        return minOf(
            API_CONFIG.RETRY_DELAY_MS * (1 shl (retryCount - 1)).toLong(),
            30000 // Max 30 seconds
        )
    }

    private fun createStopStreamMessage(sensorId: String): String {
        return gson.toJson(mapOf(
            "type" to "stop_stream",
            "sensorId" to sensorId
        ))
    }

    private data class ServerMessage(
        val type: String,
        val data: Map<String, Any>
    )

    companion object {
        private const val TAG = "WebSocketService"
    }
}