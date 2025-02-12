package com.smartapparel.app.data.db

import android.content.Context
import androidx.room.Room // version: 2.6.0
import androidx.room.testing.MigrationTestHelper // version: 2.6.0
import androidx.sqlite.db.framework.FrameworkSQLiteOpenHelperFactory
import androidx.test.core.app.ApplicationProvider // version: 1.5.0
import androidx.test.platform.app.InstrumentationRegistry
import com.smartapparel.app.data.db.entities.AlertEntity
import com.smartapparel.app.utils.Constants.ALERT_TYPES
import com.smartapparel.app.utils.Constants.ALERT_SEVERITY
import com.smartapparel.app.utils.DATA_CONFIG
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking // version: 1.7.0
import org.junit.After // version: 4.13.2
import org.junit.Before // version: 4.13.2
import org.junit.Rule // version: 4.13.2
import org.junit.Test // version: 4.13.2
import org.junit.Assert.* // version: 4.13.2
import java.io.IOException
import java.util.UUID
import java.util.concurrent.TimeUnit

/**
 * Comprehensive instrumented test class for verifying Room database operations,
 * migrations, and data retention policies in the Smart Apparel Android application.
 */
class AppDatabaseTest {
    private lateinit var db: AppDatabase
    private lateinit var context: Context

    @get:Rule
    val migrationTestHelper = MigrationTestHelper(
        InstrumentationRegistry.getInstrumentation(),
        AppDatabase::class.java.canonicalName,
        FrameworkSQLiteOpenHelperFactory()
    )

    @Before
    fun setup() {
        context = ApplicationProvider.getApplicationContext()
        db = Room.inMemoryDatabaseBuilder(
            context,
            AppDatabase::class.java
        ).apply {
            // Configure for testing
            allowMainThreadQueries()
            setJournalMode(RoomDatabase.JournalMode.TRUNCATE)
            setQueryExecutor { it.run() }
        }.build()
    }

    @After
    fun cleanup() {
        db.close()
        migrationTestHelper.closeWhenFinished()
    }

    @Test
    fun testDatabaseCreation() = runBlocking {
        // Verify database instance
        assertNotNull("Database should be initialized", db)
        
        // Verify DAOs are accessible
        assertNotNull("AlertDao should be accessible", db.alertDao())
        assertNotNull("SensorDataDao should be accessible", db.sensorDataDao())
        
        // Verify database configuration
        val dbFile = context.getDatabasePath("smart_apparel_db")
        assertTrue("Database file should be created", dbFile.exists())
        
        // Verify storage constraints
        val maxSize = DATA_CONFIG.MAX_LOCAL_STORAGE_MB * 1024 * 1024L
        assertTrue("Database size should be within limits", dbFile.length() <= maxSize)
    }

    @Test
    fun testDataRetentionPolicy() = runBlocking {
        val alertDao = db.alertDao()
        
        // Insert test alerts with different timestamps
        val currentTime = System.currentTimeMillis()
        val oldAlert = createTestAlert(
            timestamp = currentTime - TimeUnit.DAYS.toMillis(180), // 6 months old
            type = ALERT_TYPES.BIOMECHANICAL,
            severity = ALERT_SEVERITY.HIGH
        )
        val recentAlert = createTestAlert(
            timestamp = currentTime - TimeUnit.DAYS.toMillis(1), // 1 day old
            type = ALERT_TYPES.PHYSIOLOGICAL,
            severity = ALERT_SEVERITY.MEDIUM
        )
        
        alertDao.insertAlert(oldAlert)
        alertDao.insertAlert(recentAlert)
        
        // Verify initial insertion
        val allAlerts = alertDao.getAllAlerts(10, 0).first()
        assertEquals("Should have inserted 2 alerts", 2, allAlerts.size)
        
        // Execute retention policy (5-year retention)
        val retentionThreshold = currentTime - TimeUnit.DAYS.toMillis(5 * 365)
        val deletedCount = alertDao.deleteOldAlerts(retentionThreshold)
        assertEquals("No alerts should be deleted within 5-year window", 0, deletedCount)
        
        // Verify data after retention policy execution
        val remainingAlerts = alertDao.getAllAlerts(10, 0).first()
        assertEquals("All alerts within retention period should remain", 2, remainingAlerts.size)
    }

    @Test
    fun testDatabasePerformance() = runBlocking {
        val alertDao = db.alertDao()
        val alerts = List(100) { createTestAlert() }
        
        // Measure batch insert performance
        val insertStart = System.nanoTime()
        alerts.forEach { alertDao.insertAlert(it) }
        val insertDuration = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - insertStart)
        assertTrue("Batch insert should complete within 1000ms", insertDuration < 1000)
        
        // Measure query performance
        val queryStart = System.nanoTime()
        val queriedAlerts = alertDao.getAllAlerts(50, 0).first()
        val queryDuration = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - queryStart)
        assertTrue("Query should complete within 100ms", queryDuration < 100)
        assertEquals("Should retrieve correct number of alerts", 50, queriedAlerts.size)
    }

    @Test
    fun testDataCompression() = runBlocking {
        val alertDao = db.alertDao()
        
        // Create test alert with large details payload
        val largeAlert = createTestAlert(
            details = generateLargeDetailsJson(1000) // 1000 data points
        )
        
        // Insert and retrieve alert
        alertDao.insertAlert(largeAlert)
        val retrievedAlert = alertDao.getAlertById(largeAlert.id)
        
        // Verify compression ratio
        val originalSize = largeAlert.details.length
        val storedSize = retrievedAlert?.details?.length ?: 0
        val compressionRatio = originalSize.toFloat() / storedSize
        assertTrue(
            "Compression ratio should be at least 10:1",
            compressionRatio >= DATA_CONFIG.COMPRESSION_RATIO
        )
    }

    @Test
    fun testConcurrentAccess() = runBlocking {
        val alertDao = db.alertDao()
        val alerts = List(50) { createTestAlert() }
        
        // Simulate concurrent writes
        val jobs = alerts.map { alert ->
            kotlinx.coroutines.GlobalScope.async {
                alertDao.insertAlert(alert)
            }
        }
        jobs.forEach { it.await() }
        
        // Verify data integrity
        val storedAlerts = alertDao.getAllAlerts(100, 0).first()
        assertEquals("All alerts should be stored correctly", alerts.size, storedAlerts.size)
        assertTrue("No duplicate alerts should exist",
            storedAlerts.map { it.id }.distinct().size == storedAlerts.size)
    }

    private fun createTestAlert(
        id: String = UUID.randomUUID().toString(),
        timestamp: Long = System.currentTimeMillis(),
        type: ALERT_TYPES = ALERT_TYPES.BIOMECHANICAL,
        severity: ALERT_SEVERITY = ALERT_SEVERITY.MEDIUM,
        details: String = "{\"threshold\":100.0,\"currentValue\":150.0,\"location\":\"right_knee\"}"
    ) = AlertEntity(
        id = id,
        type = type,
        severity = severity,
        status = "ACTIVE",
        timestamp = timestamp,
        sessionId = "test_session",
        athleteId = "test_athlete",
        message = "Test alert message",
        details = details,
        acknowledged = false
    )

    private fun generateLargeDetailsJson(dataPoints: Int): String {
        val readings = (1..dataPoints).joinToString(",") { 
            "\"reading_$it\":${Math.random() * 100}"
        }
        return "{\"threshold\":100.0,\"currentValue\":150.0,\"location\":\"right_knee\"," +
               "\"historicalData\":{$readings}}"
    }
}