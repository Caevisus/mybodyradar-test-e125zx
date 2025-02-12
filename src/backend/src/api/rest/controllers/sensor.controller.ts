/**
 * @fileoverview Enhanced REST API controller for sensor management with optimized performance
 * and comprehensive error handling. Implements sensor data acquisition, calibration, and
 * real-time monitoring requirements.
 * 
 * @version 1.0.0
 */

import { 
    Controller, 
    Get, 
    Post, 
    Put, 
    Delete, 
    Body, 
    Param, 
    UseGuards, 
    UseInterceptors,
    ValidationPipe,
    HttpException,
    HttpStatus,
    Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RateLimit } from '@nestjs/throttler';

import { ISensorConfig, ISensorData } from '../../../interfaces/sensor.interface';
import { CalibrationService } from '../../../services/sensor/calibration.service';
import { SensorDataProcessor } from '../../../services/sensor/data.processor';
import { SENSOR_STATUS, SAMPLING_RATES } from '../../../constants/sensor.constants';

@Controller('api/sensors')
@ApiTags('Sensors')
@UseGuards(AuthGuard)
@UseInterceptors(LoggingInterceptor, PerformanceInterceptor)
export class SensorController {
    private readonly logger = new Logger(SensorController.name);

    constructor(
        private readonly calibrationService: CalibrationService,
        private readonly dataProcessor: SensorDataProcessor
    ) {}

    /**
     * Retrieves sensor configuration with enhanced error handling
     * @param sensorId - Unique sensor identifier
     * @returns Promise resolving to sensor configuration
     */
    @Get(':sensorId/config')
    @ApiOperation({ summary: 'Get sensor configuration' })
    @ApiResponse({ status: 200, type: SensorConfigResponse })
    @UseGuards(SensorAccessGuard)
    async getSensorConfig(@Param('sensorId') sensorId: string): Promise<ISensorConfig> {
        try {
            this.logger.debug(`Retrieving configuration for sensor: ${sensorId}`);
            
            const calibrationStatus = await this.calibrationService.getCalibrationStatus(sensorId);
            
            if (!calibrationStatus) {
                throw new HttpException('Sensor configuration not found', HttpStatus.NOT_FOUND);
            }

            return {
                id: sensorId,
                type: calibrationStatus.type,
                samplingRate: SAMPLING_RATES[calibrationStatus.type],
                calibrationParams: calibrationStatus.calibrationParams,
                lastCalibration: calibrationStatus.lastCalibration,
                status: calibrationStatus.status,
                batteryLevel: calibrationStatus.batteryLevel,
                firmwareVersion: calibrationStatus.firmwareVersion,
                location: calibrationStatus.location
            };
        } catch (error) {
            this.logger.error(`Error retrieving sensor config: ${error.message}`, error.stack);
            throw new HttpException(
                error.message || 'Failed to retrieve sensor configuration',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Performs comprehensive sensor calibration with progressive validation
     * @param sensorId - Sensor identifier
     * @param calibrationData - Calibration parameters
     * @returns Promise resolving to updated sensor configuration
     */
    @Post(':sensorId/calibrate')
    @ApiOperation({ summary: 'Calibrate sensor' })
    @ApiResponse({ status: 200, type: CalibrationResponse })
    @UseGuards(CalibrationGuard)
    async calibrateSensor(
        @Param('sensorId') sensorId: string,
        @Body(new ValidationPipe()) calibrationData: CalibrationData
    ): Promise<ISensorConfig> {
        try {
            this.logger.debug(`Starting calibration for sensor: ${sensorId}`);

            // Validate current sensor status
            const currentConfig = await this.getSensorConfig(sensorId);
            if (currentConfig.status === SENSOR_STATUS.CALIBRATING) {
                throw new HttpException('Sensor is already being calibrated', HttpStatus.CONFLICT);
            }

            // Update sensor status to calibrating
            currentConfig.status = SENSOR_STATUS.CALIBRATING;

            // Perform progressive calibration
            const calibratedParams = await this.calibrationService.calibrateSensor(
                sensorId,
                {
                    ...currentConfig,
                    calibrationParams: calibrationData
                }
            );

            // Update and return new configuration
            return {
                ...currentConfig,
                calibrationParams: calibratedParams,
                lastCalibration: new Date(),
                status: SENSOR_STATUS.ACTIVE
            };
        } catch (error) {
            this.logger.error(`Calibration error: ${error.message}`, error.stack);
            throw new HttpException(
                error.message || 'Calibration failed',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Processes real-time sensor data with optimized stream handling
     * @param sensorId - Sensor identifier
     * @param sensorData - Raw sensor data
     * @returns Promise resolving to processed sensor data
     */
    @Post(':sensorId/data')
    @ApiOperation({ summary: 'Process sensor data' })
    @ApiResponse({ status: 200, type: ProcessedDataResponse })
    @UseInterceptors(StreamingInterceptor)
    @RateLimit({ ttl: 60, limit: 1000 })
    async processSensorData(
        @Param('sensorId') sensorId: string,
        @Body(new ValidationPipe()) sensorData: ISensorData
    ): Promise<ISensorData> {
        try {
            this.logger.debug(`Processing data for sensor: ${sensorId}`);

            // Validate sensor configuration
            const config = await this.getSensorConfig(sensorId);
            if (config.status !== SENSOR_STATUS.ACTIVE) {
                throw new HttpException('Sensor is not active', HttpStatus.BAD_REQUEST);
            }

            // Process sensor data with performance monitoring
            const startTime = performance.now();
            const processedData = await this.dataProcessor.processData({
                ...sensorData,
                sensorId,
                timestamp: Date.now()
            });

            // Validate processing latency
            const processingTime = performance.now() - startTime;
            if (processingTime > 100) { // 100ms latency requirement
                this.logger.warn(`High processing latency: ${processingTime}ms`);
            }

            // Validate data quality
            if (processedData.quality < 0.8) { // 80% quality threshold
                this.logger.warn(`Low data quality for sensor ${sensorId}: ${processedData.quality}`);
            }

            return processedData;
        } catch (error) {
            this.logger.error(`Data processing error: ${error.message}`, error.stack);
            throw new HttpException(
                error.message || 'Data processing failed',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Updates sensor configuration with validation
     * @param sensorId - Sensor identifier
     * @param config - Updated configuration
     * @returns Promise resolving to updated configuration
     */
    @Put(':sensorId/config')
    @ApiOperation({ summary: 'Update sensor configuration' })
    @ApiResponse({ status: 200, type: SensorConfigResponse })
    @UseGuards(SensorAccessGuard)
    async updateSensorConfig(
        @Param('sensorId') sensorId: string,
        @Body(new ValidationPipe()) config: Partial<ISensorConfig>
    ): Promise<ISensorConfig> {
        try {
            this.logger.debug(`Updating configuration for sensor: ${sensorId}`);

            const currentConfig = await this.getSensorConfig(sensorId);
            
            // Validate configuration changes
            if (config.calibrationParams) {
                const isValid = this.calibrationService.validateCalibrationParams(config.calibrationParams);
                if (!isValid) {
                    throw new HttpException('Invalid calibration parameters', HttpStatus.BAD_REQUEST);
                }
            }

            // Update configuration
            const updatedConfig = {
                ...currentConfig,
                ...config,
                id: sensorId // Ensure ID remains unchanged
            };

            // Apply and validate changes
            await this.calibrationService.adjustCalibration(sensorId, updatedConfig.calibrationParams);

            return updatedConfig;
        } catch (error) {
            this.logger.error(`Configuration update error: ${error.message}`, error.stack);
            throw new HttpException(
                error.message || 'Failed to update configuration',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}