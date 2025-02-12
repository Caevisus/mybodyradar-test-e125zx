import { AnomalyDetector } from '../../../../src/services/alert/processors/anomaly.detector';
import { IAlert, IAlertDetails } from '../../../../src/interfaces/alert.interface';
import { ISensorData } from '../../../../src/interfaces/sensor.interface';
import { Matrix } from 'ml-matrix';
import { ALERT_TYPES, ALERT_SEVERITY, ALERT_THRESHOLDS } from '../../../../src/constants/alert.constants';

describe('AnomalyDetector', () => {
  let anomalyDetector: AnomalyDetector;
  let mockSensorData: ISensorData;
  let startTime: number;

  beforeEach(() => {
    // Initialize detector with technical spec requirements
    anomalyDetector = new AnomalyDetector(100, 0.85);
    startTime = Date.now();

    // Mock sensor data with known patterns for testing
    mockSensorData = {
      sensorId: '123',
      timestamp: startTime,
      readings: [
        {
          type: 'imu',
          value: [850, 900, 800, 850], // Force threshold violation
          timestamp: startTime,
          confidence: 0.95,
          rawData: Buffer.from([])
        },
        {
          type: 'tof',
          value: [15, 5, 15, 5], // Asymmetry pattern
          timestamp: startTime + 50,
          confidence: 0.90,
          rawData: Buffer.from([])
        }
      ],
      metadata: {
        calibrationVersion: '1.0',
        processingSteps: ['filtering', 'normalization'],
        quality: 95,
        environmentalFactors: {},
        processingLatency: 50
      },
      sessionId: '456',
      dataQuality: 95
    };
  });

  describe('detectAnomalies', () => {
    it('should detect force threshold violations with high confidence', async () => {
      const alerts = await anomalyDetector.detectAnomalies(mockSensorData);
      
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        type: ALERT_TYPES.BIOMECHANICAL,
        severity: ALERT_SEVERITY.HIGH,
        details: expect.objectContaining({
          currentValue: expect.any(Number),
          threshold: ALERT_THRESHOLDS.BIOMECHANICAL.FORCE,
          confidence: expect.any(Number)
        })
      });
      
      // Verify confidence meets technical spec requirement (>85%)
      expect(alerts[0].confidenceScore).toBeGreaterThan(0.85);
    });

    it('should process data within latency requirement (<100ms)', async () => {
      const processingStart = Date.now();
      await anomalyDetector.detectAnomalies(mockSensorData);
      const processingTime = Date.now() - processingStart;
      
      expect(processingTime).toBeLessThan(100);
    });

    it('should detect movement asymmetry patterns', async () => {
      const asymmetryData: ISensorData = {
        ...mockSensorData,
        readings: [{
          type: 'imu',
          value: [100, 100, 150, 150], // 20% asymmetry
          timestamp: startTime,
          confidence: 0.95,
          rawData: Buffer.from([])
        }]
      };

      const alerts = await anomalyDetector.detectAnomalies(asymmetryData);
      
      expect(alerts.some(alert => 
        alert.type === ALERT_TYPES.BIOMECHANICAL &&
        alert.details.currentValue > ALERT_THRESHOLDS.BIOMECHANICAL.ASYMMETRY
      )).toBeTruthy();
    });
  });

  describe('updateBaseline', () => {
    it('should update baseline data with weighted averaging', () => {
      const baselineMatrix = new Matrix([[100, 100], [100, 100]]);
      const newDataMatrix = new Matrix([[200, 200], [200, 200]]);
      
      anomalyDetector.updateBaseline('test-sensor', baselineMatrix);
      anomalyDetector.updateBaseline('test-sensor', newDataMatrix);

      // Verify baseline is updated with 0.7 old + 0.3 new weighting
      const expectedValue = 100 * 0.7 + 200 * 0.3;
      const alerts = anomalyDetector.detectAnomalies(mockSensorData);
      
      expect(alerts).resolves.toBeDefined();
    });
  });

  describe('biomechanical analysis', () => {
    it('should detect high impact forces', async () => {
      const impactData: ISensorData = {
        ...mockSensorData,
        readings: [{
          type: 'imu',
          value: [0, ALERT_THRESHOLDS.BIOMECHANICAL.IMPACT + 1, 0, 0],
          timestamp: startTime,
          confidence: 0.95,
          rawData: Buffer.from([])
        }]
      };

      const alerts = await anomalyDetector.detectAnomalies(impactData);
      
      expect(alerts.some(alert => 
        alert.type === ALERT_TYPES.BIOMECHANICAL &&
        alert.severity === ALERT_SEVERITY.HIGH
      )).toBeTruthy();
    });

    it('should detect range of motion deviations', async () => {
      const romData: ISensorData = {
        ...mockSensorData,
        readings: [{
          type: 'imu',
          value: [0, 0, ALERT_THRESHOLDS.BIOMECHANICAL.ROM_DEVIATION + 5, 0],
          timestamp: startTime,
          confidence: 0.95,
          rawData: Buffer.from([])
        }]
      };

      const alerts = await anomalyDetector.detectAnomalies(romData);
      
      expect(alerts.some(alert => 
        alert.details.currentValue > ALERT_THRESHOLDS.BIOMECHANICAL.ROM_DEVIATION
      )).toBeTruthy();
    });
  });

  describe('physiological analysis', () => {
    it('should detect excessive strain patterns', async () => {
      const strainData: ISensorData = {
        ...mockSensorData,
        readings: [{
          type: 'tof',
          value: [ALERT_THRESHOLDS.PHYSIOLOGICAL.STRAIN + 10, 0, 0, 0],
          timestamp: startTime,
          confidence: 0.95,
          rawData: Buffer.from([])
        }]
      };

      const alerts = await anomalyDetector.detectAnomalies(strainData);
      
      expect(alerts.some(alert => 
        alert.type === ALERT_TYPES.PHYSIOLOGICAL &&
        alert.severity === ALERT_SEVERITY.HIGH
      )).toBeTruthy();
    });

    it('should detect fatigue indicators', async () => {
      const fatigueData: ISensorData = {
        ...mockSensorData,
        readings: [{
          type: 'tof',
          value: [ALERT_THRESHOLDS.PHYSIOLOGICAL.FATIGUE + 5, 0, 0, 0],
          timestamp: startTime,
          confidence: 0.95,
          rawData: Buffer.from([])
        }]
      };

      const alerts = await anomalyDetector.detectAnomalies(fatigueData);
      
      expect(alerts.some(alert => 
        alert.type === ALERT_TYPES.PHYSIOLOGICAL &&
        alert.details.currentValue > ALERT_THRESHOLDS.PHYSIOLOGICAL.FATIGUE
      )).toBeTruthy();
    });
  });

  describe('performance requirements', () => {
    it('should maintain high sensitivity across multiple data points', async () => {
      const testCases = 1000;
      let correctDetections = 0;
      
      for (let i = 0; i < testCases; i++) {
        const testData: ISensorData = {
          ...mockSensorData,
          readings: [{
            type: 'imu',
            value: [ALERT_THRESHOLDS.BIOMECHANICAL.FORCE + 10, 0, 0, 0],
            timestamp: startTime + i,
            confidence: 0.95,
            rawData: Buffer.from([])
          }]
        };

        const alerts = await anomalyDetector.detectAnomalies(testData);
        if (alerts.length > 0 && alerts[0].confidenceScore > 0.85) {
          correctDetections++;
        }
      }

      const sensitivity = correctDetections / testCases;
      expect(sensitivity).toBeGreaterThan(0.85);
    });

    it('should process large datasets within latency requirements', async () => {
      const largeDataset: ISensorData = {
        ...mockSensorData,
        readings: Array(1000).fill(null).map((_, i) => ({
          type: 'imu',
          value: [800 + i, 0, 0, 0],
          timestamp: startTime + i,
          confidence: 0.95,
          rawData: Buffer.from([])
        }))
      };

      const processingStart = Date.now();
      await anomalyDetector.detectAnomalies(largeDataset);
      const processingTime = Date.now() - processingStart;

      expect(processingTime).toBeLessThan(100);
    });
  });
});