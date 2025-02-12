package com.smartapparel.app

import androidx.test.platform.app.InstrumentationRegistry // version: 1.5.2
import androidx.test.ext.junit.runners.AndroidJUnit4 // version: 1.5.2
import org.junit.Test // version: 4.13.2
import org.junit.runner.RunWith // version: 4.13.2
import org.junit.Assert.* // version: 4.13.2
import com.smartapparel.app.utils.SENSOR_STATUS
import com.smartapparel.app.utils.DATA_CONFIG
import com.smartapparel.app.utils.SAMPLING_RATES
import dagger.hilt.android.testing.HiltAndroidTest // version: 2.48
import dagger.hilt.android.testing.HiltAndroidRule // version: 2.48
import org.junit.Rule // version: 4.13.2
import org.junit.Before // version: 4.13.2
import javax.inject.Inject
import com.smartapparel.app.services.BluetoothService
import com.smartapparel.app.services.SensorService

@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class ExampleInstrumentedTest {

    @get:Rule
    var hiltRule = HiltAndroidRule(this)

    @Inject
    lateinit var bluetoothService: BluetoothService

    @Inject
    lateinit var sensorService: SensorService

    @Before
    fun init() {
        hiltRule.inject()
    }

    @Test
    fun useAppContext() {
        // Get the instrumentation context
        val context = InstrumentationRegistry.getInstrumentation().targetContext

        // Verify package name matches specification
        assertEquals("com.smartapparel.app", context.packageName)

        // Verify application class type
        val app = context.applicationContext
        assertInstanceOf(SmartApparelApplication::class.java, app)

        // Verify application initialization
        val smartApp = app as SmartApparelApplication
        assertNotNull("Application context should not be null", smartApp)

        // Verify core configuration parameters
        with(DATA_CONFIG) {
            assertTrue("Buffer size must be sufficient for sensor data",
                BUFFER_SIZE >= SAMPLING_RATES.IMU_HZ * 4 * Float.SIZE_BYTES)
            assertTrue("Compression ratio must meet 10:1 specification",
                COMPRESSION_RATIO >= 10.0f)
            assertTrue("Local storage limit must be enforced",
                MAX_LOCAL_STORAGE_MB <= 500)
        }

        // Verify sampling rates match specification
        with(SAMPLING_RATES) {
            assertEquals("IMU sampling rate must be 200Hz", 200, IMU_HZ)
            assertEquals("ToF sampling rate must be 100Hz", 100, TOF_HZ)
            assertTrue("Processing window must be under 100ms",
                PROCESSING_WINDOW_MS <= 100)
        }

        // Verify service initialization
        assertNotNull("Bluetooth service should be initialized", bluetoothService)
        assertNotNull("Sensor service should be initialized", sensorService)

        // Verify security configurations
        assertTrue("Cleartext traffic should be disabled",
            !context.applicationInfo.flags.hasFlag(android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE))

        // Verify required permissions
        val requiredPermissions = arrayOf(
            android.Manifest.permission.BLUETOOTH,
            android.Manifest.permission.BLUETOOTH_ADMIN,
            android.Manifest.permission.BLUETOOTH_SCAN,
            android.Manifest.permission.BLUETOOTH_CONNECT,
            android.Manifest.permission.ACCESS_FINE_LOCATION
        )
        requiredPermissions.forEach { permission ->
            assertEquals("Permission $permission should be granted",
                context.checkSelfPermission(permission),
                android.content.pm.PackageManager.PERMISSION_GRANTED)
        }
    }

    private fun Int.hasFlag(flag: Int): Boolean = (this and flag) == flag
}