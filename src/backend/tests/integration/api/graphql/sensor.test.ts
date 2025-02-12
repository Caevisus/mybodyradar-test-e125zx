import { jest } from '@jest/globals';
import supertest from 'supertest'; // v6.3.3
import gql from 'graphql-tag'; // v2.12.6
import { ISensorConfig, ISensorData, ISensorCalibrationParams } from '../../../../src/interfaces/sensor.interface';
import { SENSOR_TYPES, SAMPLING_RATES, CALIBRATION_PARAMS } from '../../../../src/constants/sensor.constants';

/**
 * Test context class for managing test environment and utilities
 */
class TestContext {
  private testServer: any;
  private testDb: any;
  private mockSensors: Map<string, ISensorConfig>;
  private performanceMetrics: Map<string, number[]>;

  constructor() {
    this.mockSensors = new Map();
    this.performanceMetrics = new Map();
  }

  async init() {
    // Initialize test server and database
    this.testServer = await supertest(process.env.TEST_API_URL);
    await this.setupTestData();
  }

  async setupTestData() {
    // Configure mock sensors with specified parameters
    const imuConfig: ISensorConfig = {
      id: 'test-imu-001',
      type: SENSOR_TYPES.IMU,
      samplingRate: SAMPLING_RATES.IMU,
      calibrationParams: {
        imuDriftCorrection: CALIBRATION_PARAMS.imuDriftCorrection.default,
        sampleWindow: CALIBRATION_PARAMS.sampleWindow.default,
        filterCutoff: CALIBRATION_PARAMS.filterCutoff.default
      } as ISensorCalibrationParams
    };

    const tofConfig: ISensorConfig = {
      id: 'test-tof-001',
      type: SENSOR_TYPES.TOF,
      samplingRate: SAMPLING_RATES.TOF,
      calibrationParams: {
        tofGain: CALIBRATION_PARAMS.tofGainRange.default,
        pressureThreshold: CALIBRATION_PARAMS.pressureThreshold.default,
        sampleWindow: CALIBRATION_PARAMS.sampleWindow.default
      } as ISensorCalibrationParams
    };

    this.mockSensors.set(imuConfig.id, imuConfig);
    this.mockSensors.set(tofConfig.id, tofConfig);
  }

  async cleanup() {
    this.mockSensors.clear();
    this.performanceMetrics.clear();
  }
}

describe('Sensor GraphQL API', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = new TestContext();
    await context.init();
  });

  afterAll(async () => {
    await context.cleanup();
  });

  describe('Query getSensorConfig', () => {
    const GET_SENSOR_CONFIG = gql`
      query GetSensorConfig($id: ID!) {
        getSensorConfig(id: $id) {
          id
          type
          samplingRate
          calibrationParams {
            tofGain
            imuDriftCorrection
            pressureThreshold
            sampleWindow
            filterCutoff
          }
        }
      }
    `;

    it('should retrieve IMU sensor configuration with correct sampling rate', async () => {
      const response = await context.testServer
        .post('/graphql')
        .send({
          query: GET_SENSOR_CONFIG,
          variables: { id: 'test-imu-001' }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.getSensorConfig).toMatchObject({
        type: SENSOR_TYPES.IMU,
        samplingRate: SAMPLING_RATES.IMU
      });
    });

    it('should retrieve ToF sensor configuration with correct sampling rate', async () => {
      const response = await context.testServer
        .post('/graphql')
        .send({
          query: GET_SENSOR_CONFIG,
          variables: { id: 'test-tof-001' }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.getSensorConfig).toMatchObject({
        type: SENSOR_TYPES.TOF,
        samplingRate: SAMPLING_RATES.TOF
      });
    });
  });

  describe('Mutation configureSensor', () => {
    const CONFIGURE_SENSOR = gql`
      mutation ConfigureSensor($input: SensorConfigInput!) {
        configureSensor(input: $input) {
          id
          type
          samplingRate
          calibrationParams {
            tofGain
            imuDriftCorrection
            pressureThreshold
            sampleWindow
            filterCutoff
          }
        }
      }
    `;

    it('should validate IMU sampling rate constraints', async () => {
      const response = await context.testServer
        .post('/graphql')
        .send({
          query: CONFIGURE_SENSOR,
          variables: {
            input: {
              id: 'test-imu-001',
              samplingRate: 150 // Invalid rate, should be 200Hz
            }
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.errors[0].message).toContain('IMU sampling rate must be 200Hz');
    });

    it('should enforce data compression ratio', async () => {
      const response = await context.testServer
        .post('/graphql')
        .send({
          query: CONFIGURE_SENSOR,
          variables: {
            input: {
              id: 'test-imu-001',
              compressionRatio: 5 // Invalid ratio, should be 10:1
            }
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.errors[0].message).toContain('Compression ratio must be 10:1');
    });
  });

  describe('Mutation calibrateSensor', () => {
    const CALIBRATE_SENSOR = gql`
      mutation CalibrateSensor($input: SensorCalibrationInput!) {
        calibrateSensor(input: $input) {
          id
          calibrationParams {
            tofGain
            imuDriftCorrection
            pressureThreshold
            sampleWindow
            filterCutoff
          }
          lastCalibration
        }
      }
    `;

    it('should validate ToF gain range', async () => {
      const response = await context.testServer
        .post('/graphql')
        .send({
          query: CALIBRATE_SENSOR,
          variables: {
            input: {
              id: 'test-tof-001',
              calibrationParams: {
                tofGain: 20 // Invalid: outside 1-16 range
              }
            }
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.errors[0].message).toContain('ToF gain must be between 1 and 16');
    });

    it('should validate IMU drift correction range', async () => {
      const response = await context.testServer
        .post('/graphql')
        .send({
          query: CALIBRATE_SENSOR,
          variables: {
            input: {
              id: 'test-imu-001',
              calibrationParams: {
                imuDriftCorrection: 2.5 // Invalid: outside 0.1-2.0° range
              }
            }
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.errors[0].message).toContain('IMU drift correction must be between 0.1° and 2.0°');
    });
  });

  describe('Subscription onSensorData', () => {
    const SENSOR_DATA_SUBSCRIPTION = gql`
      subscription OnSensorData($sensorId: ID!) {
        onSensorData(sensorId: $sensorId) {
          sensorId
          timestamp
          readings {
            type
            value
            timestamp
            confidence
          }
          latency
        }
      }
    `;

    it('should maintain data streaming latency under 100ms', async () => {
      const latencies: number[] = [];
      
      const subscription = context.testServer
        .post('/graphql')
        .send({
          query: SENSOR_DATA_SUBSCRIPTION,
          variables: { sensorId: 'test-imu-001' }
        });

      // Collect latency measurements for 5 seconds
      await new Promise(resolve => {
        subscription.on('data', (data: ISensorData) => {
          latencies.push(data.latency);
        });
        setTimeout(resolve, 5000);
      });

      const averageLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      expect(averageLatency).toBeLessThan(100); // Validate <100ms requirement
    });

    it('should handle multiple concurrent subscriptions', async () => {
      const subscriptions = await Promise.all([
        context.testServer
          .post('/graphql')
          .send({
            query: SENSOR_DATA_SUBSCRIPTION,
            variables: { sensorId: 'test-imu-001' }
          }),
        context.testServer
          .post('/graphql')
          .send({
            query: SENSOR_DATA_SUBSCRIPTION,
            variables: { sensorId: 'test-tof-001' }
          })
      ]);

      subscriptions.forEach(subscription => {
        expect(subscription.status).toBe(200);
      });
    });
  });
});