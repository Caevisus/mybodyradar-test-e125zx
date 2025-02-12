import { BiomechanicsAnalyzer } from '../../../../src/services/analytics/biomechanics.analyzer';
import { ISensorData, ISensorCalibrationParams } from '../../../../src/interfaces/sensor.interface';
import { SENSOR_TYPES } from '../../../../src/constants/sensor.constants';
import * as winston from 'winston'; // v3.10.0

describe('BiomechanicsAnalyzer', () => {
    let biomechanicsAnalyzer: BiomechanicsAnalyzer;
    let mockLogger: winston.Logger;
    let mockCalibrationParams: ISensorCalibrationParams;
    let mockSensorData: ISensorData[];
    
    // Performance measurement
    const measurePerformance = async (operation: () => Promise<any>): Promise<number> => {
        const start = process.hrtime();
        await operation();
        const [seconds, nanoseconds] = process.hrtime(start);
        return seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds
    };

    beforeEach(() => {
        // Initialize mock logger
        mockLogger = winston.createLogger({
            transports: [new winston.transports.Console({ level: 'error' })]
        });

        // Initialize mock calibration parameters
        mockCalibrationParams = {
            tofGain: 8,
            imuDriftCorrection: 0.5,
            pressureThreshold: 1.0,
            sampleWindow: 100,
            filterCutoff: 2.0,
            calibrationMatrix: [[1, 0], [0, 1]],
            temperatureCompensation: 1.0
        };

        // Initialize analyzer instance
        biomechanicsAnalyzer = new BiomechanicsAnalyzer(
            mockCalibrationParams,
            100, // sampling window
            mockLogger
        );

        // Initialize mock sensor data
        mockSensorData = [
            {
                sensorId: 'sensor1',
                timestamp: Date.now(),
                readings: [
                    {
                        type: SENSOR_TYPES.TOF,
                        value: [1.0, 2.0, 3.0],
                        timestamp: Date.now(),
                        confidence: 0.95,
                        rawData: Buffer.from([1, 2, 3])
                    }
                ],
                metadata: {
                    calibrationVersion: '1.0.0',
                    processingSteps: ['filtering', 'normalization'],
                    quality: 95,
                    environmentalFactors: { temperature: 25 },
                    processingLatency: 50
                },
                sessionId: 'session1',
                dataQuality: 95
            }
        ];
    });

    describe('analyzeMuscleActivity', () => {
        it('should analyze muscle activity within performance requirements', async () => {
            const processingTime = await measurePerformance(async () => {
                await biomechanicsAnalyzer.analyzeMuscleActivity(mockSensorData);
            });
            
            expect(processingTime).toBeLessThan(100); // Verify <100ms latency requirement
        });

        it('should maintain measurement precision within ±1%', async () => {
            const knownValue = 100;
            mockSensorData[0].readings[0].value = [knownValue];
            
            const result = await biomechanicsAnalyzer.analyzeMuscleActivity(mockSensorData);
            const analyzedValue = (result as any).intensity[0];
            
            const percentageDeviation = Math.abs((analyzedValue - knownValue) / knownValue * 100);
            expect(percentageDeviation).toBeLessThanOrEqual(1); // Verify ±1% deviation requirement
        });

        it('should handle invalid sensor data gracefully', async () => {
            await expect(biomechanicsAnalyzer.analyzeMuscleActivity([])).rejects.toThrow('Invalid ToF data input');
        });

        it('should process multiple sensors concurrently', async () => {
            const multiSensorData = Array(5).fill(mockSensorData[0]);
            const result = await biomechanicsAnalyzer.analyzeMuscleActivity(multiSensorData);
            expect(result).toBeDefined();
        });
    });

    describe('analyzeMovementKinematics', () => {
        it('should analyze movement patterns within performance requirements', async () => {
            const processingTime = await measurePerformance(async () => {
                await biomechanicsAnalyzer.analyzeMovementKinematics(mockSensorData);
            });
            
            expect(processingTime).toBeLessThan(100); // Verify <100ms latency requirement
        });

        it('should detect movement pattern variations accurately', async () => {
            // Setup baseline movement pattern
            const baselineData = [...mockSensorData];
            const result = await biomechanicsAnalyzer.analyzeMovementKinematics(baselineData);
            
            expect(result).toHaveProperty('patterns');
            expect(result).toHaveProperty('velocity');
            expect(result).toHaveProperty('acceleration');
        });

        it('should handle sensor drift correctly', async () => {
            // Simulate sensor drift
            const driftedData = mockSensorData.map(data => ({
                ...data,
                readings: data.readings.map(reading => ({
                    ...reading,
                    value: reading.value.map(v => v + mockCalibrationParams.imuDriftCorrection)
                }))
            }));

            const result = await biomechanicsAnalyzer.analyzeMovementKinematics(driftedData);
            expect(result).toBeDefined();
        });

        it('should validate data quality thresholds', async () => {
            mockSensorData[0].dataQuality = 50; // Below acceptable threshold
            await expect(biomechanicsAnalyzer.analyzeMovementKinematics(mockSensorData))
                .resolves.toHaveProperty('quality');
        });
    });

    describe('calculateLoadDistribution', () => {
        it('should calculate load distribution accurately', async () => {
            const result = await biomechanicsAnalyzer.calculateLoadDistribution(mockSensorData);
            
            expect(result).toHaveProperty('pressurePoints');
            expect(result).toHaveProperty('forceVectors');
            expect(result).toHaveProperty('distribution');
        });

        it('should identify pressure points within tolerance', async () => {
            const result = await biomechanicsAnalyzer.calculateLoadDistribution(mockSensorData);
            const pressurePoints = (result as any).pressurePoints;
            
            expect(Array.isArray(pressurePoints)).toBeTruthy();
            pressurePoints.forEach(point => {
                expect(point.pressure).toBeGreaterThanOrEqual(mockCalibrationParams.pressureThreshold);
            });
        });
    });

    describe('detectMovementAnomalies', () => {
        it('should detect movement anomalies accurately', async () => {
            // Setup baseline pattern
            const baselinePattern = {
                velocityProfile: [1, 2, 3],
                accelerationProfile: [0.1, 0.2, 0.3],
                movementRange: { min: 0, max: 5 }
            };

            const result = await biomechanicsAnalyzer.detectMovementAnomalies(
                mockSensorData,
                baselinePattern
            );

            expect(result).toHaveProperty('deviationScores');
            expect(result).toHaveProperty('significantAnomalies');
            expect(result).toHaveProperty('confidence');
        });

        it('should maintain false positive rate below threshold', async () => {
            // Generate normal movement pattern
            const normalPattern = {
                velocityProfile: [1, 2, 3],
                accelerationProfile: [0.1, 0.2, 0.3],
                movementRange: { min: 0, max: 5 }
            };

            const result = await biomechanicsAnalyzer.detectMovementAnomalies(
                mockSensorData,
                normalPattern
            );

            const falsePositives = (result as any).significantAnomalies.length;
            expect(falsePositives).toBeLessThanOrEqual(mockSensorData.length * 0.1); // Max 10% false positive rate
        });
    });

    describe('error handling', () => {
        it('should handle initialization with invalid calibration parameters', () => {
            const invalidParams = { ...mockCalibrationParams, tofGain: 20 }; // Invalid gain value
            expect(() => new BiomechanicsAnalyzer(invalidParams, 100, mockLogger))
                .toThrow('Invalid calibration parameters');
        });

        it('should handle sensor data gaps gracefully', async () => {
            const gappedData = [...mockSensorData];
            gappedData[0].readings = [];
            
            await expect(biomechanicsAnalyzer.analyzeMuscleActivity(gappedData))
                .rejects.toThrow('Invalid ToF data input');
        });
    });
});