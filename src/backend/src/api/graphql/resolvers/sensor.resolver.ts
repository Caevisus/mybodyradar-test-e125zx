/**
 * @fileoverview GraphQL resolver implementation for sensor operations with comprehensive
 * error handling, performance optimization, and real-time data subscriptions.
 * Implements sensor layer specifications from technical requirements.
 */

import { Resolver, Query, Mutation, Subscription, Args } from '@nestjs/graphql';
import { PubSub, withFilter } from 'graphql-subscriptions';
import { performance } from 'perf_hooks';
import pino from 'pino';

import { ISensorConfig, ISensorData, ISensorCalibrationParams } from '../../../interfaces/sensor.interface';
import { SensorRepository } from '../../../db/repositories/sensor.repository';
import { SENSOR_STATUS, SENSOR_STATUS_CODES, SAMPLING_RATES } from '../../../constants/sensor.constants';

// Subscription event names
const EVENTS = {
  SENSOR_DATA: 'SENSOR_DATA',
  CALIBRATION_PROGRESS: 'CALIBRATION_PROGRESS',
  SENSOR_STATUS: 'SENSOR_STATUS'
} as const;

@Resolver('Sensor')
export class SensorResolver {
  private readonly logger: pino.Logger;
  private readonly maxSubscriptionBacklog = 1000;
  private readonly performanceMetrics = new Map<string, number>();

  constructor(
    private readonly sensorRepository: SensorRepository,
    private readonly pubsub: PubSub
  ) {
    this.logger = pino({ name: 'SensorResolver' });
  }

  /**
   * Retrieves sensor configuration with caching and performance monitoring
   */
  @Query(() => ISensorConfig)
  async getSensor(
    @Args('id') id: string
  ): Promise<ISensorConfig> {
    const startTime = performance.now();

    try {
      const sensor = await this.sensorRepository.getSensor(id);
      if (!sensor) {
        throw new Error(`Sensor not found: ${id}`);
      }

      // Record query performance
      const duration = performance.now() - startTime;
      this.performanceMetrics.set(`getSensor:${id}`, duration);

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
   * Initiates and manages sensor calibration process with staged validation
   */
  @Mutation(() => Boolean)
  async calibrateSensor(
    @Args('id') id: string,
    @Args('params') params: ISensorCalibrationParams
  ): Promise<boolean> {
    const startTime = performance.now();

    try {
      // Validate sensor exists and is in valid state
      const sensor = await this.sensorRepository.getSensor(id);
      if (!sensor) {
        throw new Error(`Sensor not found: ${id}`);
      }

      if (sensor.status === SENSOR_STATUS.CALIBRATING) {
        throw new Error('Sensor is already being calibrated');
      }

      // Update sensor status to calibrating
      await this.sensorRepository.updateSensorStatus(id, SENSOR_STATUS.CALIBRATING);

      // Validate calibration parameters
      await this.sensorRepository.validateCalibrationParams(params);

      // Perform staged calibration
      const stages = ['INIT', 'BASELINE', 'ADJUSTMENT', 'VERIFICATION'];
      for (const stage of stages) {
        await this.pubsub.publish(EVENTS.CALIBRATION_PROGRESS, {
          sensorId: id,
          stage,
          progress: stages.indexOf(stage) * 25
        });

        // Simulate stage processing time
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Update calibration parameters
      await this.sensorRepository.updateSensorCalibration(id, params, sensor.__v);

      // Update sensor status to active
      await this.sensorRepository.updateSensorStatus(id, SENSOR_STATUS.ACTIVE);

      // Publish calibration completion
      await this.pubsub.publish(EVENTS.SENSOR_STATUS, {
        sensorId: id,
        status: SENSOR_STATUS.ACTIVE,
        statusCode: SENSOR_STATUS_CODES.CALIBRATION_SUCCESS
      });

      const duration = performance.now() - startTime;
      this.performanceMetrics.set(`calibrateSensor:${id}`, duration);

      return true;
    } catch (error) {
      // Handle calibration failure
      await this.sensorRepository.updateSensorStatus(id, SENSOR_STATUS.ERROR);
      await this.pubsub.publish(EVENTS.SENSOR_STATUS, {
        sensorId: id,
        status: SENSOR_STATUS.ERROR,
        statusCode: SENSOR_STATUS_CODES.CALIBRATION_FAILURE,
        error: error.message
      });

      this.logger.error({
        op: 'calibrateSensor',
        error: error.message,
        sensorId: id
      });
      throw error;
    }
  }

  /**
   * Subscription for real-time sensor data with backpressure handling
   * and performance optimization
   */
  @Subscription(() => ISensorData, {
    filter: (payload, variables) => {
      return payload.sensorId === variables.id;
    },
    resolve: payload => {
      // Add processing latency to payload
      return {
        ...payload,
        processingLatency: performance.now() - payload.timestamp
      };
    }
  })
  async onSensorData(
    @Args('id') id: string,
    @Args('dataType') dataType: string
  ) {
    // Validate sensor exists and is active
    const sensor = await this.sensorRepository.getSensor(id);
    if (!sensor || sensor.status !== SENSOR_STATUS.ACTIVE) {
      throw new Error(`Sensor ${id} is not active`);
    }

    // Configure sampling rate based on sensor type
    const samplingRate = sensor.type === 'IMU' ? 
      SAMPLING_RATES.IMU : SAMPLING_RATES.TOF;

    return withFilter(
      () => this.pubsub.asyncIterator(EVENTS.SENSOR_DATA),
      async (payload, variables) => {
        // Implement backpressure handling
        if (this.pubsub.subscriptionCount(EVENTS.SENSOR_DATA) > this.maxSubscriptionBacklog) {
          this.logger.warn({
            op: 'onSensorData',
            message: 'Subscription backlog limit reached',
            sensorId: id
          });
          return false;
        }

        // Validate payload matches subscription parameters
        return payload.sensorId === variables.id && 
               payload.type === variables.dataType &&
               payload.samplingRate === samplingRate;
      }
    )();
  }

  /**
   * Subscription for sensor status updates
   */
  @Subscription(() => String)
  async onSensorStatus(
    @Args('id') id: string
  ) {
    return this.pubsub.asyncIterator(`${EVENTS.SENSOR_STATUS}.${id}`);
  }
}