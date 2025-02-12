/**
 * @fileoverview Repository class implementing optimized data access patterns for sensor management
 * with sub-100ms latency through caching and monitoring. Implements sensor layer specifications
 * from technical requirements.
 */

import mongoose from 'mongoose';
import NodeCache from 'node-cache';
import pino from 'pino';
import { SensorModel } from '../models/sensor.model';
import { ISensorConfig } from '../../interfaces/sensor.interface';
import { CALIBRATION_PARAMS, SENSOR_STATUS } from '../../constants/sensor.constants';

/**
 * Cache configuration for sensor data with TTL optimization
 */
const CACHE_CONFIG = {
  stdTTL: 300, // 5 minutes
  checkperiod: 60, // Check for expired keys every minute
  useClones: false // Optimize memory usage
};

/**
 * Repository class implementing data access patterns for sensor configuration and data
 * with optimized query patterns and caching for sub-100ms latency
 */
export class SensorRepository {
  private readonly Model: typeof SensorModel;
  private readonly cache: NodeCache;
  private readonly logger: pino.Logger;

  constructor(cache: NodeCache, logger: pino.Logger) {
    this.Model = SensorModel;
    this.cache = cache;
    this.logger = logger.child({ module: 'SensorRepository' });
  }

  /**
   * Creates a new sensor configuration with validation and caching
   * @param sensorConfig Sensor configuration object
   * @returns Created sensor configuration
   */
  async createSensor(sensorConfig: ISensorConfig): Promise<ISensorConfig> {
    const startTime = process.hrtime();

    try {
      // Validate calibration parameters
      this.validateCalibrationParams(sensorConfig.calibrationParams);

      // Create new sensor document
      const sensor = await this.Model.create({
        ...sensorConfig,
        status: SENSOR_STATUS.CALIBRATING,
        lastCalibration: new Date()
      });

      // Cache the new sensor configuration
      const cacheKey = `sensor:${sensor.id}`;
      this.cache.set(cacheKey, sensor.toObject());

      const [seconds, nanoseconds] = process.hrtime(startTime);
      this.logger.info({
        op: 'createSensor',
        latency: seconds * 1000 + nanoseconds / 1e6,
        sensorId: sensor.id
      });

      return sensor;
    } catch (error) {
      this.logger.error({
        op: 'createSensor',
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Updates sensor calibration parameters with version control
   * @param id Sensor ID
   * @param calibrationParams New calibration parameters
   * @param version Current version for optimistic locking
   * @returns Updated sensor configuration or null
   */
  async updateSensorCalibration(
    id: string,
    calibrationParams: ISensorConfig['calibrationParams'],
    version: number
  ): Promise<ISensorConfig | null> {
    const startTime = process.hrtime();

    try {
      // Validate calibration parameters
      this.validateCalibrationParams(calibrationParams);

      // Update with optimistic locking
      const sensor = await this.Model.findOneAndUpdate(
        { id, __v: version },
        {
          $set: {
            calibrationParams,
            lastCalibration: new Date(),
            status: SENSOR_STATUS.CALIBRATING
          },
          $inc: { __v: 1 }
        },
        { new: true }
      );

      if (sensor) {
        // Invalidate cache
        const cacheKey = `sensor:${id}`;
        this.cache.del(cacheKey);
      }

      const [seconds, nanoseconds] = process.hrtime(startTime);
      this.logger.info({
        op: 'updateSensorCalibration',
        latency: seconds * 1000 + nanoseconds / 1e6,
        sensorId: id,
        success: !!sensor
      });

      return sensor;
    } catch (error) {
      this.logger.error({
        op: 'updateSensorCalibration',
        error: error.message,
        sensorId: id
      });
      throw error;
    }
  }

  /**
   * Performs bulk updates on multiple sensors with optimized write operations
   * @param updates Array of sensor updates
   * @returns Bulk write results
   */
  async bulkUpdateSensors(
    updates: Array<{ id: string; updates: Partial<ISensorConfig> }>
  ): Promise<mongoose.mongo.BulkWriteResult> {
    const startTime = process.hrtime();

    try {
      // Prepare bulk operations
      const operations = updates.map(update => ({
        updateOne: {
          filter: { id: update.id },
          update: { $set: update.updates },
          upsert: false
        }
      }));

      // Execute bulk write
      const result = await this.Model.bulkWrite(operations);

      // Invalidate affected cache entries
      updates.forEach(update => {
        const cacheKey = `sensor:${update.id}`;
        this.cache.del(cacheKey);
      });

      const [seconds, nanoseconds] = process.hrtime(startTime);
      this.logger.info({
        op: 'bulkUpdateSensors',
        latency: seconds * 1000 + nanoseconds / 1e6,
        updatedCount: result.modifiedCount
      });

      return result;
    } catch (error) {
      this.logger.error({
        op: 'bulkUpdateSensors',
        error: error.message,
        updateCount: updates.length
      });
      throw error;
    }
  }

  /**
   * Retrieves a sensor configuration with caching
   * @param id Sensor ID
   * @returns Sensor configuration or null
   */
  async getSensor(id: string): Promise<ISensorConfig | null> {
    const startTime = process.hrtime();
    const cacheKey = `sensor:${id}`;

    try {
      // Check cache first
      const cached = this.cache.get<ISensorConfig>(cacheKey);
      if (cached) {
        return cached;
      }

      // Query database if not in cache
      const sensor = await this.Model.findOne({ id });
      
      if (sensor) {
        // Cache the result
        this.cache.set(cacheKey, sensor.toObject());
      }

      const [seconds, nanoseconds] = process.hrtime(startTime);
      this.logger.info({
        op: 'getSensor',
        latency: seconds * 1000 + nanoseconds / 1e6,
        sensorId: id,
        cached: !!cached
      });

      return sensor;
    } catch (error) {
      this.logger.error({
        op: 'getSensor',
        error: error.message,
        sensorId: id
      });
      throw error;
    }
  }

  /**
   * Validates sensor calibration parameters against defined ranges
   * @param params Calibration parameters to validate
   * @throws Error if parameters are invalid
   */
  private validateCalibrationParams(
    params: ISensorConfig['calibrationParams']
  ): void {
    const { tofGain, imuDriftCorrection, pressureThreshold, sampleWindow, filterCutoff } = params;

    if (
      tofGain < CALIBRATION_PARAMS.tofGainRange.min ||
      tofGain > CALIBRATION_PARAMS.tofGainRange.max ||
      imuDriftCorrection < CALIBRATION_PARAMS.imuDriftCorrection.min ||
      imuDriftCorrection > CALIBRATION_PARAMS.imuDriftCorrection.max ||
      pressureThreshold < CALIBRATION_PARAMS.pressureThreshold.min ||
      pressureThreshold > CALIBRATION_PARAMS.pressureThreshold.max ||
      sampleWindow < CALIBRATION_PARAMS.sampleWindow.min ||
      sampleWindow > CALIBRATION_PARAMS.sampleWindow.max ||
      filterCutoff < CALIBRATION_PARAMS.filterCutoff.min ||
      filterCutoff > CALIBRATION_PARAMS.filterCutoff.max
    ) {
      throw new Error('Invalid calibration parameters');
    }
  }
}