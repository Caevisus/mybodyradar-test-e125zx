import { BiomechanicsAnalyzer } from '../../src/services/analytics/biomechanics.analyzer';
import { PerformanceAnalyzer } from '../../src/services/analytics/performance.analyzer';
import { HeatMapGenerator } from '../../src/services/analytics/heatmap.generator';
import { ISensorData, ISensorCalibrationParams } from '../../src/interfaces/sensor.interface';
import { ISessionMetrics } from '../../src/interfaces/session.interface';
import { validateSensorData } from '../../src/utils/validation.util';
import { SENSOR_TYPES, CALIBRATION_PARAMS } from '../../src/constants/sensor.constants';
import * as performance from 'performance-now'; // v2.1.0
import * as winston from 'winston'; // v3.10.0

// Test configuration
const TEST_CONFIG = {
  samplingWindow: 100, // ms
  anomalyThreshold: 0.85,
  resolution: 64,
  workerCount: 2
};

// Initialize test data and analyzers
let biomechanicsAnalyzer: BiomechanicsAnalyzer;
let performanceAnalyzer: PerformanceAnalyzer;
let heatMapGenerator: HeatMapGenerator;
let mockSensorData: ISensorData[];
let mockBaselineData: number[];

describe('BiomechanicsAnalyzer Integration Tests', () => {
  beforeAll(() => {
    // Initialize logger
    const logger = winston.createLogger({
      level: 'info',
      transports: [new winston.transports.Console()]
    });

    // Initialize calibration parameters
    const calibrationParams: ISensorCalibrationParams = {
      tofGain: CALIBRATION_PARAMS.tofGainRange.default,
      imuDriftCorrection: CALIBRATION_PARAMS.imuDriftCorrection.default,
      pressureThreshold: CALIBRATION_PARAMS.pressureThreshold.default,
      sampleWindow: CALIBRATION_PARAMS.sampleWindow.default,
      filterCutoff: CALIBRATION_PARAMS.filterCutoff.default,
      calibrationMatrix: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
      temperatureCompensation: 1.0
    };

    biomechanicsAnalyzer = new BiomechanicsAnalyzer(
      calibrationParams,
      TEST_CONFIG.samplingWindow,
      logger
    );
  });

  beforeEach(() => {
    // Generate mock sensor data
    mockSensorData = generateMockSensorData(100); // 100 data points
  });

  test('should analyze muscle activity within latency requirement', async () => {
    const startTime = performance();
    
    const result = await biomechanicsAnalyzer.analyzeMuscleActivity(mockSensorData);
    
    const processingTime = performance() - startTime;
    
    // Verify processing latency requirement (<100ms)
    expect(processingTime).toBeLessThan(100);
    
    // Validate result structure
    expect(result).toHaveProperty('intensity');
    expect(result).toHaveProperty('peakActivity');
    expect(result).toHaveProperty('temporalPattern');
    
    // Validate data quality
    expect(result.intensity).toBeInstanceOf(Array);
    expect(result.intensity.length).toBeGreaterThan(0);
    expect(Math.max(...result.peakActivity)).toBeLessThanOrEqual(1);
  });

  test('should analyze movement kinematics with accurate results', async () => {
    const result = await biomechanicsAnalyzer.analyzeMovementKinematics(mockSensorData);
    
    // Validate kinematic analysis
    expect(result).toHaveProperty('velocity');
    expect(result).toHaveProperty('acceleration');
    expect(result).toHaveProperty('patterns');
    expect(result).toHaveProperty('quality');
    
    // Verify data consistency
    expect(result.quality).toBeGreaterThanOrEqual(0);
    expect(result.quality).toBeLessThanOrEqual(1);
    expect(result.patterns).toHaveProperty('symmetry');
  });

  test('should calculate load distribution with proper force analysis', async () => {
    const result = await biomechanicsAnalyzer.calculateLoadDistribution(mockSensorData);
    
    // Validate force distribution analysis
    expect(result).toHaveProperty('pressurePoints');
    expect(result).toHaveProperty('forceVectors');
    expect(result).toHaveProperty('distribution');
    expect(result).toHaveProperty('peakLoads');
    
    // Verify pressure point detection
    expect(result.pressurePoints.length).toBeGreaterThan(0);
    expect(result.distribution).toBeInstanceOf(Array);
  });
});

describe('PerformanceAnalyzer Integration Tests', () => {
  beforeAll(() => {
    performanceAnalyzer = new PerformanceAnalyzer(
      TEST_CONFIG.anomalyThreshold,
      TEST_CONFIG.samplingWindow
    );
    mockBaselineData = generateMockBaselineData();
  });

  test('should analyze sensor data with comprehensive metrics', async () => {
    const result = await performanceAnalyzer.analyzeSensorData(mockSensorData[0]);
    
    // Validate metrics structure
    expect(result).toHaveProperty('muscleActivity');
    expect(result).toHaveProperty('forceDistribution');
    expect(result).toHaveProperty('rangeOfMotion');
    expect(result).toHaveProperty('anomalyScores');
    
    // Verify performance indicators
    expect(result.performanceIndicators).toHaveProperty('efficiency');
    expect(result.performanceIndicators).toHaveProperty('symmetry');
    expect(result.performanceIndicators).toHaveProperty('technique');
  });

  test('should detect anomalies with high accuracy', async () => {
    const measurements = mockSensorData.map(data => data.readings[0].value[0]);
    const anomalyScores = await performanceAnalyzer['detectAnomalies'](
      measurements,
      mockBaselineData
    );
    
    // Validate anomaly detection
    expect(anomalyScores).toBeInstanceOf(Array);
    expect(anomalyScores.length).toBe(measurements.length);
    expect(Math.max(...anomalyScores)).toBeLessThanOrEqual(1);
    
    // Verify confidence scores
    const confidenceScore = performanceAnalyzer['calculateConfidenceScore'](anomalyScores);
    expect(confidenceScore).toBeGreaterThanOrEqual(0);
    expect(confidenceScore).toBeLessThanOrEqual(1);
  });
});

describe('HeatMapGenerator Integration Tests', () => {
  beforeAll(() => {
    heatMapGenerator = new HeatMapGenerator(
      biomechanicsAnalyzer,
      performanceAnalyzer,
      TEST_CONFIG.resolution,
      TEST_CONFIG.workerCount
    );
  });

  test('should generate muscle activity heat map with real-time updates', async () => {
    const options = {
      resolution: TEST_CONFIG.resolution,
      colorScale: ['blue', 'red'],
      smoothing: true,
      interpolation: 'linear' as const,
      opacity: 0.8,
      showLabels: true
    };

    const startTime = performance();
    const result = await heatMapGenerator.generateMuscleActivityHeatMap(
      mockSensorData,
      options
    );
    const processingTime = performance() - startTime;

    // Verify processing latency
    expect(processingTime).toBeLessThan(100);
    
    // Validate heat map structure
    expect(result).toHaveProperty('z');
    expect(result).toHaveProperty('type', 'heatmap');
    expect(result.z.length).toBe(TEST_CONFIG.resolution);
  });

  test('should generate force distribution heat map with vectors', async () => {
    const options = {
      resolution: TEST_CONFIG.resolution,
      colorScale: ['green', 'yellow', 'red'],
      smoothing: true,
      interpolation: 'cubic' as const,
      opacity: 0.9,
      showLabels: true,
      pressureThreshold: 1.0,
      vectorDisplay: true,
      forceScale: 1.0
    };

    const result = await heatMapGenerator.generateForceDistributionHeatMap(
      mockSensorData,
      options
    );
    
    // Validate force visualization
    expect(result).toHaveProperty('z');
    expect(result).toHaveProperty('quiver');
    expect(result.z.length).toBe(TEST_CONFIG.resolution);
  });

  test('should update heat map in real-time with proper transitions', async () => {
    const updateOptions = {
      transitionDuration: 50,
      preserveScale: true,
      updateInterval: 100
    };

    const startTime = performance();
    const result = await heatMapGenerator.updateRealTimeHeatMap(
      mockSensorData[0],
      updateOptions
    );
    const updateTime = performance() - startTime;

    // Verify update latency
    expect(updateTime).toBeLessThan(100);
    
    // Validate update structure
    expect(result).toHaveProperty('transition');
    expect(result.transition.duration).toBe(updateOptions.transitionDuration);
  });
});

// Helper functions for generating test data
function generateMockSensorData(count: number): ISensorData[] {
  return Array.from({ length: count }, (_, i) => ({
    sensorId: `sensor-${i}`,
    timestamp: Date.now() + i * 100,
    readings: [
      {
        type: SENSOR_TYPES.IMU,
        value: [Math.random(), Math.random(), Math.random()],
        timestamp: Date.now() + i * 100,
        confidence: 0.95,
        rawData: Buffer.from([])
      },
      {
        type: SENSOR_TYPES.TOF,
        value: [Math.random(), Math.random(), Math.random()],
        timestamp: Date.now() + i * 100,
        confidence: 0.92,
        rawData: Buffer.from([])
      }
    ],
    metadata: {
      calibrationVersion: '1.0.0',
      processingSteps: ['filtering', 'normalization'],
      quality: 95,
      environmentalFactors: { temperature: 25, humidity: 60 },
      processingLatency: 50
    },
    sessionId: 'test-session',
    dataQuality: 95
  }));
}

function generateMockBaselineData(): number[] {
  return Array.from({ length: 100 }, () => Math.random());
}