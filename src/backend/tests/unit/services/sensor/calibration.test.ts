import { CalibrationService } from '../../../../src/services/sensor/calibration.service';
import { SensorDataProcessor } from '../../../../src/services/sensor/data.processor';
import { CALIBRATION_PARAMS } from '../../../../src/constants/sensor.constants';
import { ISensorConfig } from '../../../../src/interfaces/sensor.interface';
import { SENSOR_TYPES } from '../../../../src/constants/sensor.constants';

// Mock SensorDataProcessor
jest.mock('../../../../src/services/sensor/data.processor');

describe('CalibrationService', () => {
    let calibrationService: CalibrationService;
    let mockDataProcessor: jest.Mocked<SensorDataProcessor>;

    // Test data setup
    const validIMUConfig: ISensorConfig = {
        id: 'test-imu-sensor',
        type: SENSOR_TYPES.IMU,
        samplingRate: 200,
        calibrationParams: {
            tofGain: 8,
            imuDriftCorrection: 0.5,
            pressureThreshold: 1.0,
            sampleWindow: 100,
            filterCutoff: 2.0,
            calibrationMatrix: [[1, 0], [0, 1]],
            temperatureCompensation: 1.0
        },
        lastCalibration: new Date(),
        batteryLevel: 100,
        status: 0,
        firmwareVersion: '1.0.0',
        location: 'right_leg'
    };

    const validToFConfig: ISensorConfig = {
        ...validIMUConfig,
        id: 'test-tof-sensor',
        type: SENSOR_TYPES.TOF,
        samplingRate: 100
    };

    beforeEach(() => {
        mockDataProcessor = new SensorDataProcessor() as jest.Mocked<SensorDataProcessor>;
        mockDataProcessor.processData = jest.fn().mockResolvedValue({
            sensorId: 'test-sensor',
            timestamp: Date.now(),
            processedReadings: [],
            quality: 0.9
        });
        calibrationService = new CalibrationService(mockDataProcessor);
    });

    describe('calibrateSensor', () => {
        test('should successfully calibrate IMU sensor with valid configuration', async () => {
            const result = await calibrationService.calibrateSensor(
                validIMUConfig.id,
                validIMUConfig
            );

            expect(result).toBeDefined();
            expect(result.imuDriftCorrection).toBe(validIMUConfig.calibrationParams.imuDriftCorrection);
            expect(result.sampleWindow).toBe(validIMUConfig.calibrationParams.sampleWindow);
            expect(mockDataProcessor.processData).toHaveBeenCalled();
        });

        test('should successfully calibrate ToF sensor with valid configuration', async () => {
            const result = await calibrationService.calibrateSensor(
                validToFConfig.id,
                validToFConfig
            );

            expect(result).toBeDefined();
            expect(result.tofGain).toBe(validToFConfig.calibrationParams.tofGain);
            expect(result.filterCutoff).toBe(validToFConfig.calibrationParams.filterCutoff);
            expect(mockDataProcessor.processData).toHaveBeenCalled();
        });

        test('should throw error for invalid sensor configuration', async () => {
            const invalidConfig = {
                ...validIMUConfig,
                calibrationParams: {
                    ...validIMUConfig.calibrationParams,
                    tofGain: 20 // Invalid value
                }
            };

            await expect(
                calibrationService.calibrateSensor(invalidConfig.id, invalidConfig)
            ).rejects.toThrow('Invalid calibration parameters');
        });

        test('should handle concurrent calibration requests', async () => {
            const promises = [
                calibrationService.calibrateSensor(validIMUConfig.id, validIMUConfig),
                calibrationService.calibrateSensor(validToFConfig.id, validToFConfig)
            ];

            const results = await Promise.all(promises);
            expect(results).toHaveLength(2);
            expect(results[0]).toBeDefined();
            expect(results[1]).toBeDefined();
        });
    });

    describe('validateCalibrationParams', () => {
        test('should validate all parameters within range', () => {
            const validParams = validIMUConfig.calibrationParams;
            expect(calibrationService.validateCalibrationParams(validParams)).toBe(true);
        });

        test('should reject ToF gain below minimum', () => {
            const invalidParams = {
                ...validIMUConfig.calibrationParams,
                tofGain: CALIBRATION_PARAMS.tofGainRange.min - 1
            };
            expect(calibrationService.validateCalibrationParams(invalidParams)).toBe(false);
        });

        test('should reject ToF gain above maximum', () => {
            const invalidParams = {
                ...validIMUConfig.calibrationParams,
                tofGain: CALIBRATION_PARAMS.tofGainRange.max + 1
            };
            expect(calibrationService.validateCalibrationParams(invalidParams)).toBe(false);
        });

        test('should validate IMU drift correction range', () => {
            const invalidParams = {
                ...validIMUConfig.calibrationParams,
                imuDriftCorrection: CALIBRATION_PARAMS.imuDriftCorrection.max + 0.1
            };
            expect(calibrationService.validateCalibrationParams(invalidParams)).toBe(false);
        });

        test('should validate pressure threshold range', () => {
            const invalidParams = {
                ...validIMUConfig.calibrationParams,
                pressureThreshold: CALIBRATION_PARAMS.pressureThreshold.min - 0.01
            };
            expect(calibrationService.validateCalibrationParams(invalidParams)).toBe(false);
        });

        test('should validate sample window range', () => {
            const invalidParams = {
                ...validIMUConfig.calibrationParams,
                sampleWindow: CALIBRATION_PARAMS.sampleWindow.max + 1
            };
            expect(calibrationService.validateCalibrationParams(invalidParams)).toBe(false);
        });

        test('should validate filter cutoff range', () => {
            const invalidParams = {
                ...validIMUConfig.calibrationParams,
                filterCutoff: CALIBRATION_PARAMS.filterCutoff.min - 0.1
            };
            expect(calibrationService.validateCalibrationParams(invalidParams)).toBe(false);
        });
    });

    describe('adjustCalibration', () => {
        test('should successfully adjust calibration parameters', async () => {
            // First calibrate the sensor
            await calibrationService.calibrateSensor(validIMUConfig.id, validIMUConfig);

            const adjustments = {
                tofGain: 10,
                imuDriftCorrection: 0.8
            };

            const result = await calibrationService.adjustCalibration(
                validIMUConfig.id,
                adjustments
            );

            expect(result.tofGain).toBe(adjustments.tofGain);
            expect(result.imuDriftCorrection).toBe(adjustments.imuDriftCorrection);
            expect(mockDataProcessor.processData).toHaveBeenCalled();
        });

        test('should throw error when adjusting uncalibrated sensor', async () => {
            const adjustments = {
                tofGain: 10
            };

            await expect(
                calibrationService.adjustCalibration('uncalibrated-sensor', adjustments)
            ).rejects.toThrow('Sensor not calibrated');
        });

        test('should reject invalid adjustment values', async () => {
            await calibrationService.calibrateSensor(validIMUConfig.id, validIMUConfig);

            const invalidAdjustments = {
                tofGain: CALIBRATION_PARAMS.tofGainRange.max + 1
            };

            await expect(
                calibrationService.adjustCalibration(validIMUConfig.id, invalidAdjustments)
            ).rejects.toThrow('Invalid calibration adjustments');
        });
    });

    describe('getCalibrationStatus', () => {
        test('should return current calibration status for calibrated sensor', async () => {
            await calibrationService.calibrateSensor(validIMUConfig.id, validIMUConfig);
            const status = await calibrationService.getCalibrationStatus(validIMUConfig.id);

            expect(status).toBeDefined();
            expect(status.calibrationParams).toEqual(validIMUConfig.calibrationParams);
        });

        test('should throw error for uncalibrated sensor', async () => {
            await expect(
                calibrationService.getCalibrationStatus('uncalibrated-sensor')
            ).rejects.toThrow('Sensor calibration not found');
        });

        test('should reflect recent calibration adjustments', async () => {
            await calibrationService.calibrateSensor(validIMUConfig.id, validIMUConfig);
            
            const adjustments = {
                tofGain: 10
            };
            
            await calibrationService.adjustCalibration(validIMUConfig.id, adjustments);
            const status = await calibrationService.getCalibrationStatus(validIMUConfig.id);

            expect(status.calibrationParams.tofGain).toBe(adjustments.tofGain);
        });
    });

    describe('Cache Management', () => {
        test('should handle cache expiration', async () => {
            // Mock Date.now for cache expiration testing
            const realDateNow = Date.now.bind(global.Date);
            const dateNowStub = jest.fn(() => 1635724800000); // Fixed timestamp
            global.Date.now = dateNowStub;

            await calibrationService.calibrateSensor(validIMUConfig.id, validIMUConfig);
            
            // Advance time beyond cache timeout
            dateNowStub.mockReturnValue(1635724800000 + 3600001); // 1 hour + 1ms
            
            await expect(
                calibrationService.getCalibrationStatus(validIMUConfig.id)
            ).rejects.toThrow('Sensor calibration not found');

            // Restore original Date.now
            global.Date.now = realDateNow;
        });

        test('should maintain separate cache entries for different sensors', async () => {
            await calibrationService.calibrateSensor(validIMUConfig.id, validIMUConfig);
            await calibrationService.calibrateSensor(validToFConfig.id, validToFConfig);

            const imuStatus = await calibrationService.getCalibrationStatus(validIMUConfig.id);
            const tofStatus = await calibrationService.getCalibrationStatus(validToFConfig.id);

            expect(imuStatus.calibrationParams).toEqual(validIMUConfig.calibrationParams);
            expect(tofStatus.calibrationParams).toEqual(validToFConfig.calibrationParams);
        });
    });
});