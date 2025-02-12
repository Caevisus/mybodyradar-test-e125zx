import { TestScheduler } from 'rxjs/testing'; // v7.8.0
import { of, throwError } from 'rxjs'; // v7.8.0
import { AnalyticsService } from '../../services/analytics.service';
import { ApiService } from '../../services/api.service';
import { ISensorData } from '../../interfaces/sensor.interface';
import { ISessionMetrics } from '../../interfaces/session.interface';
import { SENSOR_TYPES } from '../../constants/sensor.constants';

// Mock ApiService
jest.mock('../../services/api.service');

describe('AnalyticsService', () => {
  let testScheduler: TestScheduler;
  let analyticsService: AnalyticsService;
  let mockApiService: jest.Mocked<ApiService>;

  // Test data fixtures
  const testSensorData: ISensorData = {
    sensorId: '123',
    timestamp: Date.now(),
    readings: [
      {
        type: SENSOR_TYPES.IMU,
        value: [0.5, 0.3, 0.2],
        timestamp: Date.now()
      },
      {
        type: SENSOR_TYPES.TOF,
        value: [0.8],
        timestamp: Date.now()
      }
    ],
    metadata: {
      calibrationVersion: '1.0.0',
      processingSteps: [],
      quality: 95
    }
  };

  const testMetrics: ISessionMetrics = {
    muscleActivity: {
      'muscle_quadriceps': 0.75,
      'muscle_hamstring': 0.65
    },
    forceDistribution: {
      'left': 48,
      'right': 52
    },
    rangeOfMotion: {
      'knee': {
        current: 85,
        baseline: 90,
        deviation: -5
      }
    },
    anomalyScores: {},
    alertTriggers: {}
  };

  beforeEach(() => {
    testScheduler = new TestScheduler((actual, expected) => {
      expect(actual).toEqual(expected);
    });

    mockApiService = {
      post: jest.fn(),
      get: jest.fn()
    } as any;

    analyticsService = new AnalyticsService(mockApiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processDataStream', () => {
    it('should process valid sensor data within 100ms latency requirement', () => {
      testScheduler.run(({ cold, expectObservable }) => {
        const startTime = performance.now();
        analyticsService.processDataStream(testSensorData);
        const processingTime = performance.now() - startTime;
        
        expect(processingTime).toBeLessThan(100);
      });
    });

    it('should handle empty data streams gracefully', () => {
      const emptySensorData: ISensorData = {
        ...testSensorData,
        readings: []
      };

      expect(() => {
        analyticsService.processDataStream(emptySensorData);
      }).not.toThrow();
    });

    it('should throw error for invalid sensor data format', () => {
      const invalidData = { invalid: 'data' } as any;
      
      expect(() => {
        analyticsService.processDataStream(invalidData);
      }).toThrow('Invalid sensor data format');
    });

    it('should warn on low quality sensor data', () => {
      const consoleSpy = jest.spyOn(console, 'warn');
      const lowQualityData: ISensorData = {
        ...testSensorData,
        metadata: { ...testSensorData.metadata, quality: 45 }
      };

      analyticsService.processDataStream(lowQualityData);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Low quality sensor data detected'));
    });
  });

  describe('generateHeatMap', () => {
    it('should generate heat map with correct intensity values', async () => {
      const heatMapData = await analyticsService.generateHeatMap(testSensorData);
      
      expect(heatMapData).toBeDefined();
      expect(Object.values(heatMapData).every(value => 
        typeof value === 'number' && value >= 0 && value <= 1
      )).toBeTruthy();
    });

    it('should maintain performance under large datasets', async () => {
      const largeDataset: ISensorData = {
        ...testSensorData,
        readings: Array(1000).fill(testSensorData.readings[0])
      };

      const startTime = performance.now();
      await analyticsService.generateHeatMap(largeDataset);
      const processingTime = performance.now() - startTime;

      expect(processingTime).toBeLessThan(100);
    });

    it('should handle WebGL context initialization failure', async () => {
      // Simulate WebGL context failure
      const mockCanvas = {
        getContext: () => null
      };
      jest.spyOn(document, 'createElement').mockReturnValue(mockCanvas as any);

      await expect(analyticsService.generateHeatMap(testSensorData))
        .rejects.toThrow();
    });
  });

  describe('detectAnomalies', () => {
    it('should detect muscle activity anomalies', async () => {
      const anomalousMetrics: ISessionMetrics = {
        ...testMetrics,
        muscleActivity: {
          'muscle_quadriceps': 2.5, // Significant deviation
          'muscle_hamstring': 0.65
        }
      };

      const anomalies = await analyticsService.detectAnomalies(anomalousMetrics);
      
      expect(anomalies).toHaveProperty('muscle_quadriceps');
      expect(Object.keys(anomalies).length).toBeGreaterThan(0);
    });

    it('should detect force distribution anomalies', async () => {
      const anomalousMetrics: ISessionMetrics = {
        ...testMetrics,
        forceDistribution: {
          'left': 30,  // Significant imbalance
          'right': 70
        }
      };

      const anomalies = await analyticsService.detectAnomalies(anomalousMetrics);
      
      expect(anomalies).toHaveProperty('force_left');
      expect(anomalies).toHaveProperty('force_right');
    });

    it('should handle multiple concurrent anomalies', async () => {
      mockApiService.post.mockResolvedValue({ success: true });

      const anomalousMetrics: ISessionMetrics = {
        ...testMetrics,
        muscleActivity: { 'muscle_quadriceps': 2.5 },
        forceDistribution: { 'left': 30, 'right': 70 }
      };

      const anomalies = await analyticsService.detectAnomalies(anomalousMetrics);
      
      expect(Object.keys(anomalies).length).toBeGreaterThan(1);
      expect(mockApiService.post).toHaveBeenCalled();
    });
  });

  describe('getMetricsStream', () => {
    it('should emit metrics updates in real-time', () => {
      testScheduler.run(({ cold, expectObservable }) => {
        const metrics$ = analyticsService.getMetricsStream();
        const expected = '(a|)';
        
        expectObservable(metrics$).toBe(expected, { a: expect.any(Object) });
      });
    });

    it('should handle subscription cleanup properly', () => {
      const subscription = analyticsService.getMetricsStream().subscribe();
      
      subscription.unsubscribe();
      expect(subscription.closed).toBeTruthy();
    });

    it('should maintain consistent stream under high frequency updates', () => {
      testScheduler.run(({ cold, expectObservable }) => {
        const highFrequencyData = Array(100).fill(testSensorData);
        
        highFrequencyData.forEach(data => {
          analyticsService.processDataStream(data);
        });

        const metrics$ = analyticsService.getMetricsStream();
        expectObservable(metrics$).toBe('(a|)', { a: expect.any(Object) });
      });
    });
  });
});