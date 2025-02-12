import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'jest';
import supertest from 'supertest';
import now from 'performance-now';
import { SensorController } from '../../../../src/api/rest/controllers/sensor.controller';
import { 
    SENSOR_TYPES, 
    SAMPLING_RATES, 
    CALIBRATION_PARAMS 
} from '../../../../src/constants/sensor.constants';
import { 
    ISensorConfig, 
    ISensorData, 
    ISensorCalibrationParams 
} from '../../../../src/interfaces/sensor.interface';

describe('Sensor API Integration Tests', () => {
    let app: any;
    let request: supertest.SuperTest<supertest.Test>;
    let sensorController: SensorController;
    const testSensorId = 'test-sensor-001';

    // Test data setup
    const mockSensorConfig: ISensorConfig = {
        id: testSensorId,
        type: SENSOR_TYPES.IMU,
        samplingRate: SAMPLING_RATES.IMU,
        calibrationParams: {
            tofGain: CALIBRATION_PARAMS.tofGainRange.default,
            imuDriftCorrection: CALIBRATION_PARAMS.imuDriftCorrection.default,
            pressureThreshold: CALIBRATION_PARAMS.pressureThreshold.default,
            sampleWindow: CALIBRATION_PARAMS.sampleWindow.default,
            filterCutoff: CALIBRATION_PARAMS.filterCutoff.default,
            calibrationMatrix: [[1, 0], [0, 1]],
            temperatureCompensation: 1.0
        },
        lastCalibration: new Date(),
        batteryLevel: 100,
        status: 3, // ACTIVE
        firmwareVersion: '1.0.0',
        location: 'right_leg'
    };

    beforeAll(async () => {
        // Initialize test application and dependencies
        app = await initializeTestApp();
        request = supertest(app);
        sensorController = app.get(SensorController);
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        // Reset test data before each test
        await clearTestData();
        await initializeMockSensor(testSensorId, mockSensorConfig);
    });

    describe('Sensor Configuration Tests', () => {
        it('should retrieve sensor configuration successfully', async () => {
            const response = await request
                .get(`/api/sensors/${testSensorId}/config`)
                .expect(200);

            expect(response.body).toMatchObject({
                id: testSensorId,
                type: SENSOR_TYPES.IMU,
                samplingRate: SAMPLING_RATES.IMU
            });
        });

        it('should update sensor configuration with validation', async () => {
            const updatedConfig: Partial<ISensorConfig> = {
                calibrationParams: {
                    ...mockSensorConfig.calibrationParams,
                    tofGain: 12,
                    filterCutoff: 5
                }
            };

            const response = await request
                .put(`/api/sensors/${testSensorId}/config`)
                .send(updatedConfig)
                .expect(200);

            expect(response.body.calibrationParams.tofGain).toBe(12);
            expect(response.body.calibrationParams.filterCutoff).toBe(5);
        });

        it('should reject invalid configuration parameters', async () => {
            const invalidConfig: Partial<ISensorConfig> = {
                calibrationParams: {
                    ...mockSensorConfig.calibrationParams,
                    tofGain: 20 // Invalid: exceeds max range of 16
                }
            };

            await request
                .put(`/api/sensors/${testSensorId}/config`)
                .send(invalidConfig)
                .expect(400);
        });
    });

    describe('Sensor Calibration Tests', () => {
        it('should perform complete sensor calibration process', async () => {
            const calibrationData: ISensorCalibrationParams = {
                tofGain: 8,
                imuDriftCorrection: 0.5,
                pressureThreshold: 1.0,
                sampleWindow: 100,
                filterCutoff: 2.0,
                calibrationMatrix: [[1, 0], [0, 1]],
                temperatureCompensation: 1.0
            };

            const response = await request
                .post(`/api/sensors/${testSensorId}/calibrate`)
                .send(calibrationData)
                .expect(200);

            expect(response.body.status).toBe(3); // ACTIVE
            expect(response.body.lastCalibration).toBeDefined();
            expect(response.body.calibrationParams).toMatchObject(calibrationData);
        });

        it('should validate calibration parameter ranges', async () => {
            // Test each calibration parameter range
            const testRanges = [
                { param: 'tofGain', min: 1, max: 16 },
                { param: 'imuDriftCorrection', min: 0.1, max: 2.0 },
                { param: 'pressureThreshold', min: 0.1, max: 5.0 },
                { param: 'sampleWindow', min: 50, max: 500 },
                { param: 'filterCutoff', min: 0.5, max: 10 }
            ];

            for (const range of testRanges) {
                const invalidData = { ...mockSensorConfig.calibrationParams };
                invalidData[range.param] = range.max + 1;

                await request
                    .post(`/api/sensors/${testSensorId}/calibrate`)
                    .send(invalidData)
                    .expect(400);

                invalidData[range.param] = range.min - 0.1;
                
                await request
                    .post(`/api/sensors/${testSensorId}/calibrate`)
                    .send(invalidData)
                    .expect(400);
            }
        });
    });

    describe('Real-time Data Processing Tests', () => {
        it('should process sensor data within latency requirements', async () => {
            const sensorData: ISensorData = generateTestSensorData(testSensorId);
            
            const startTime = now();
            const response = await request
                .post(`/api/sensors/${testSensorId}/data`)
                .send(sensorData)
                .expect(200);
            const processingTime = now() - startTime;

            expect(processingTime).toBeLessThan(100); // 100ms latency requirement
            expect(response.body.quality).toBeGreaterThan(0.8); // 80% quality threshold
        });

        it('should validate sensor measurement precision', async () => {
            const referenceData = generateReferenceData();
            const testData = generateTestSensorData(testSensorId, referenceData);

            const response = await request
                .post(`/api/sensors/${testSensorId}/data`)
                .send(testData)
                .expect(200);

            const deviation = calculateDeviation(response.body.readings, referenceData);
            expect(deviation).toBeLessThan(0.01); // ±1% deviation requirement
        });

        it('should handle concurrent data processing requests', async () => {
            const concurrentRequests = 10;
            const requests = Array(concurrentRequests).fill(null).map(() => 
                request
                    .post(`/api/sensors/${testSensorId}/data`)
                    .send(generateTestSensorData(testSensorId))
            );

            const responses = await Promise.all(requests);
            
            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body.quality).toBeGreaterThan(0.8);
            });
        });
    });
});

// Helper functions
function initializeTestApp() {
    // Implementation for test app initialization
}

function clearTestData() {
    // Implementation for clearing test data
}

function initializeMockSensor(sensorId: string, config: ISensorConfig) {
    // Implementation for initializing mock sensor
}

function generateTestSensorData(sensorId: string, referenceData?: number[]): ISensorData {
    // Implementation for generating test sensor data
}

function generateReferenceData(): number[] {
    // Implementation for generating reference data
}

function calculateDeviation(readings: any[], referenceData: number[]): number {
    // Implementation for calculating deviation
}