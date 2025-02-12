package com.smartapparel.app

import android.app.Application
import android.os.StrictMode
import android.os.Build
import android.security.NetworkSecurityPolicy
import androidx.lifecycle.ProcessLifecycleOwner
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.jakewharton.timber.Timber // version: 5.0.1
import com.squareup.leakcanary.LeakCanary // version: 2.12
import dagger.hilt.android.HiltAndroidApp // version: 2.48
import kotlinx.coroutines.* // version: 1.7.3
import kotlinx.coroutines.flow.catch
import javax.inject.Inject
import com.smartapparel.app.services.BluetoothService
import com.smartapparel.app.services.SensorService
import com.smartapparel.app.utils.SENSOR_STATUS
import java.util.concurrent.TimeUnit

@HiltAndroidApp
class SmartApparelApplication : Application() {

    @Inject
    lateinit var bluetoothService: BluetoothService

    @Inject
    lateinit var sensorService: SensorService

    @Inject
    lateinit var applicationScope: CoroutineScope

    private var isInitialized = false

    override fun onCreate() {
        setupStrictMode()
        super.onCreate()

        initializeLogging()
        initializeCrashReporting()
        initializeLeakDetection()
        initializeSecurity()
        initializeServices()
        setupUncaughtExceptionHandler()
        
        isInitialized = true
    }

    private fun setupStrictMode() {
        if (BuildConfig.DEBUG) {
            StrictMode.setThreadPolicy(
                StrictMode.ThreadPolicy.Builder()
                    .detectDiskReads()
                    .detectDiskWrites()
                    .detectNetwork()
                    .detectCustomSlowCalls()
                    .penaltyLog()
                    .build()
            )

            StrictMode.setVmPolicy(
                StrictMode.VmPolicy.Builder()
                    .detectLeakedSqlLiteObjects()
                    .detectLeakedClosableObjects()
                    .detectActivityLeaks()
                    .detectLeakedRegistrationObjects()
                    .penaltyLog()
                    .build()
            )
        }
    }

    private fun initializeLogging() {
        if (BuildConfig.DEBUG) {
            Timber.plant(Timber.DebugTree())
        } else {
            Timber.plant(CrashReportingTree())
        }
    }

    private fun initializeCrashReporting() {
        FirebaseCrashlytics.getInstance().apply {
            setCrashlyticsCollectionEnabled(!BuildConfig.DEBUG)
            setCustomKey("app_version", BuildConfig.VERSION_NAME)
            setCustomKey("device_api", Build.VERSION.SDK_INT)
        }
    }

    private fun initializeLeakDetection() {
        if (BuildConfig.DEBUG) {
            LeakCanary.config = LeakCanary.config.copy(
                retainedVisibleThreshold = 3,
                dumpHeap = true
            )
        }
    }

    private fun initializeSecurity() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            NetworkSecurityPolicy.getInstance()
                .isCleartextTrafficPermitted = false
        }
    }

    private fun initializeServices() {
        applicationScope.launch {
            try {
                // Start services with performance monitoring
                withTimeout(TimeUnit.SECONDS.toMillis(10)) {
                    supervisorScope {
                        launch {
                            bluetoothService.getSensorData("")
                                .catch { e -> 
                                    Timber.e(e, "Bluetooth service initialization failed")
                                    FirebaseCrashlytics.getInstance().recordException(e)
                                }
                                .collect { sensorData ->
                                    if (sensorData.status == SENSOR_STATUS.ERROR) {
                                        Timber.w("Sensor error detected: ${sensorData.sensorId}")
                                    }
                                }
                        }

                        launch {
                            sensorService.startSensorMonitoring("")
                                .catch { e ->
                                    Timber.e(e, "Sensor service initialization failed")
                                    FirebaseCrashlytics.getInstance().recordException(e)
                                }
                                .collect { sensorData ->
                                    // Monitor processing latency
                                    val latency = System.currentTimeMillis() - sensorData.timestamp
                                    if (latency > 100) {
                                        Timber.w("Processing latency exceeded 100ms: $latency ms")
                                    }
                                }
                        }
                    }
                }
            } catch (e: TimeoutException) {
                Timber.e(e, "Service initialization timed out")
                FirebaseCrashlytics.getInstance().recordException(e)
            }
        }

        // Register lifecycle callbacks
        ProcessLifecycleOwner.get().lifecycle.addObserver(AppLifecycleObserver(
            applicationScope,
            bluetoothService,
            sensorService
        ))
    }

    private fun setupUncaughtExceptionHandler() {
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            Timber.e(throwable, "Uncaught exception in thread ${thread.name}")
            FirebaseCrashlytics.getInstance().recordException(throwable)
            defaultHandler?.uncaughtException(thread, throwable)
        }
    }

    override fun onTerminate() {
        if (isInitialized) {
            applicationScope.launch {
                try {
                    // Gracefully stop services
                    withTimeout(TimeUnit.SECONDS.toMillis(5)) {
                        sensorService.stopSensorMonitoring("")
                    }
                } catch (e: Exception) {
                    Timber.e(e, "Error during service shutdown")
                } finally {
                    applicationScope.cancel()
                }
            }
        }
        super.onTerminate()
    }

    private class CrashReportingTree : Timber.Tree() {
        override fun log(priority: Int, tag: String?, message: String, t: Throwable?) {
            if (priority >= android.util.Log.WARN) {
                t?.let {
                    FirebaseCrashlytics.getInstance().recordException(it)
                } ?: FirebaseCrashlytics.getInstance().log(message)
            }
        }
    }

    companion object {
        private const val TAG = "SmartApparelApplication"
    }
}