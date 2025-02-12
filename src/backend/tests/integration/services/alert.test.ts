/**
 * @fileoverview Integration tests for the alert service validating real-time alert generation,
 * processing, and distribution functionality with actual database and Redis cluster connections.
 * Tests focus on achieving >85% injury prediction accuracy and <100ms latency requirements.
 */

import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import now from 'performance-now';
import mongoose from 'mongoose';

import { AlertService } from '../../../src/services/alert/alert.service';
import { AnomalyDetector } from '../../../src/services/alert/processors/anomaly.detector';
import { ThresholdAnalyzer } from '../../../src/services/alert/processors/threshold.analyzer';
import { AlertRepository } from '../../../src/db/repositories/alert.repository';
import { 
  ALERT_TYPES, 
  ALERT_SEVERITY, 
  ALERT_STATUS,
  ALERT_THRESHOLDS 
} from '../../../src/constants/alert.constants';
import { ISensorData } from '../../../src/interfaces/sensor.interface';
import { IAlert } from '../../../src/interfaces/alert.interface';

describe('Alert Service Integration Tests', () => {
  let alertService: AlertService;
  let redisClient: Redis.Cluster;
  let alertRepository: AlertRepository;
  let anomalyDetector: AnomalyDetector;
  let thresholdAnalyzer: ThresholdAnalyzer;
  let testSessionId: string;

  beforeAll(async () => {
    // Initialize Redis cluster
    redisClient = new Redis.Cluster([{
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379')
    }], {
      redisOptions: {
        password: process.env.REDIS_PASSWORD,
        tls: process.env.NODE_ENV === 'production'
      },
      clusterRetryStrategy: (times: number) => Math.min(times * 100, 3000)
    });

    // Initialize MongoDB connection
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    // Initialize components
    alertRepository = new AlertRepository(redisClient);
    anomalyDetector = new AnomalyDetector(100, 0.85);
    thresholdAnalyzer = new ThresholdAnalyzer();

    // Initialize alert service
    alertService = new AlertService(
      alertRepository,
      anomalyDetector,
      thresholdAnalyzer
    );

    testSessionId = uuidv4();
  });

  afterAll(async () => {
    // Cleanup connections
    await redisClient.quit();
    await mongoose.connection.close();
  });

  describe('Alert Generation and Processing', () => {
    it('should generate alerts with <100ms latency', async () => {
      const sensorData = generateTestSensorData(testSessionId, true);
      const startTime = now();

      const alerts = await alertService.processIncomingData(sensorData, testSessionId);

      const processingTime = now() - startTime;
      expect(processingTime).toBeLessThan(100); // Verify <100ms latency
      expect(alerts).toHaveLength(1);
      expect(alerts[0].confidenceScore).toBeGreaterThan(0.85); // Verify >85% confidence
    });

    it('should correctly identify biomechanical anomalies', async () => {
      const sensorData = generateBiomechanicalTestData(testSessionId);
      const alerts = await alertService.processIncomingData(sensorData, testSessionId);

      expect(alerts.some(alert => 
        alert.type === ALERT_TYPES.BIOMECHANICAL &&
        alert.severity === ALERT_SEVERITY.HIGH &&
        alert.details.currentValue > ALERT_THRESHOLDS.BIOMECHANICAL.FORCE
      )).toBeTruthy();
    });

    it('should correctly identify physiological anomalies', async () => {
      const sensorData = generatePhysiologicalTestData(testSessionId);
      const alerts = await alertService.processIncomingData(sensorData, testSessionId);

      expect(alerts.some(alert =>
        alert.type === ALERT_TYPES.PHYSIOLOGICAL &&
        alert.severity === ALERT_SEVERITY.HIGH &&
        alert.details.currentValue > ALERT_THRESHOLDS.PHYSIOLOGICAL.STRAIN
      )).toBeTruthy();
    });
  });

  describe('Alert Distribution', () => {
    it('should distribute alerts to all subscribers', async () => {
      const receivedAlerts: IAlert[] = [];
      const subscribers = 3;
      const subscriptionPromises = [];

      // Create multiple subscribers
      for (let i = 0; i < subscribers; i++) {
        const subscription = alertService.subscribeToAlerts({
          types: [ALERT_TYPES.BIOMECHANICAL],
          minSeverity: ALERT_SEVERITY.HIGH,
          sessionId: testSessionId
        });
        subscriptionPromises.push(subscription);
      }

      await Promise.all(subscriptionPromises);

      // Generate test alert
      const sensorData = generateTestSensorData(testSessionId, true);
      const alerts = await alertService.processIncomingData(sensorData, testSessionId);

      // Verify all subscribers received the alert
      expect(receivedAlerts).toHaveLength(subscribers);
      expect(receivedAlerts.every(alert => 
        alert.id === alerts[0].id &&
        alert.type === ALERT_TYPES.BIOMECHANICAL
      )).toBeTruthy();
    });

    it('should handle Redis node failures gracefully', async () => {
      const subscription = await alertService.subscribeToAlerts({
        types: [ALERT_TYPES.BIOMECHANICAL],
        sessionId: testSessionId
      });

      // Simulate Redis node failure
      await redisClient.disconnect();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Service should reconnect automatically
      const sensorData = generateTestSensorData(testSessionId, true);
      const alerts = await alertService.processIncomingData(sensorData, testSessionId);

      expect(alerts).toBeDefined();
      expect(alerts.length).toBeGreaterThan(0);

      subscription(); // Cleanup subscription
    });
  });

  describe('Error Recovery', () => {
    it('should handle database connection failures', async () => {
      // Simulate database disconnection
      await mongoose.connection.close();

      const sensorData = generateTestSensorData(testSessionId, true);
      
      // Service should queue alerts and retry
      const alerts = await alertService.processIncomingData(sensorData, testSessionId);
      
      // Reconnect database
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');

      expect(alerts).toBeDefined();
      expect(alerts[0].status).toBe(ALERT_STATUS.ACTIVE);
    });

    it('should maintain data consistency during errors', async () => {
      const sensorData = generateTestSensorData(testSessionId, true);
      
      // Simulate partial failure
      jest.spyOn(alertRepository, 'createAlert').mockRejectedValueOnce(new Error('Test error'));
      
      try {
        await alertService.processIncomingData(sensorData, testSessionId);
      } catch (error) {
        // Verify no partial data was committed
        const activeAlerts = await alertRepository.getActiveAlertsByType(
          ALERT_TYPES.BIOMECHANICAL,
          ALERT_SEVERITY.LOW
        );
        expect(activeAlerts.filter(alert => alert.sessionId === testSessionId)).toHaveLength(0);
      }
    });
  });
});

// Test data generators
function generateTestSensorData(sessionId: string, includeAnomaly: boolean): ISensorData {
  return {
    sensorId: uuidv4(),
    timestamp: Date.now(),
    sessionId,
    dataQuality: 95,
    readings: [{
      type: 'FORCE',
      value: [includeAnomaly ? 900 : 500], // Anomaly threshold is 850
      timestamp: Date.now(),
      confidence: 0.95,
      rawData: Buffer.from([])
    }],
    metadata: {
      calibrationVersion: '1.0.0',
      processingSteps: ['filtering', 'normalization'],
      quality: 95,
      environmentalFactors: {},
      processingLatency: 5
    }
  };
}

function generateBiomechanicalTestData(sessionId: string): ISensorData {
  return {
    sensorId: uuidv4(),
    timestamp: Date.now(),
    sessionId,
    dataQuality: 98,
    readings: [{
      type: 'FORCE',
      value: [900], // Above force threshold
      timestamp: Date.now(),
      confidence: 0.98,
      rawData: Buffer.from([])
    }, {
      type: 'ASYMMETRY',
      value: [20], // Above asymmetry threshold
      timestamp: Date.now(),
      confidence: 0.95,
      rawData: Buffer.from([])
    }],
    metadata: {
      calibrationVersion: '1.0.0',
      processingSteps: ['filtering', 'normalization'],
      quality: 98,
      environmentalFactors: {},
      processingLatency: 3
    }
  };
}

function generatePhysiologicalTestData(sessionId: string): ISensorData {
  return {
    sensorId: uuidv4(),
    timestamp: Date.now(),
    sessionId,
    dataQuality: 96,
    readings: [{
      type: 'STRAIN',
      value: [90], // Above strain threshold
      timestamp: Date.now(),
      confidence: 0.96,
      rawData: Buffer.from([])
    }, {
      type: 'FATIGUE',
      value: [80], // Above fatigue threshold
      timestamp: Date.now(),
      confidence: 0.94,
      rawData: Buffer.from([])
    }],
    metadata: {
      calibrationVersion: '1.0.0',
      processingSteps: ['filtering', 'normalization'],
      quality: 96,
      environmentalFactors: {},
      processingLatency: 4
    }
  };
}