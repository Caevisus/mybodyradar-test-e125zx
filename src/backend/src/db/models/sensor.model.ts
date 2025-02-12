/**
 * @fileoverview MongoDB schema and model for sensor configuration, calibration parameters,
 * and data management in the smart apparel system. Implements comprehensive data modeling
 * for sensor layer specifications with optimized indexing and validation.
 */

import mongoose, { Schema, Document } from 'mongoose';
import { ISensorConfig } from '../../interfaces/sensor.interface';
import { SENSOR_TYPES, SENSOR_STATUS, CALIBRATION_PARAMS } from '../../constants/sensor.constants';

/**
 * Interface extending ISensorConfig with Mongoose Document features
 */
interface ISensorDocument extends ISensorConfig, Document {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mongoose schema for sensor configuration with comprehensive validation and indexing
 */
const SensorSchema = new Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    enum: Object.values(SENSOR_TYPES),
    required: true,
    index: true
  },
  samplingRate: {
    type: Number,
    required: true,
    validate: {
      validator: function(rate: number) {
        return rate === 200 || rate === 100; // IMU: 200Hz, ToF: 100Hz
      },
      message: 'Sampling rate must be either 100Hz (ToF) or 200Hz (IMU)'
    }
  },
  calibrationParams: {
    tofGain: {
      type: Number,
      required: true,
      min: CALIBRATION_PARAMS.tofGainRange.min,
      max: CALIBRATION_PARAMS.tofGainRange.max
    },
    imuDriftCorrection: {
      type: Number,
      required: true,
      min: CALIBRATION_PARAMS.imuDriftCorrection.min,
      max: CALIBRATION_PARAMS.imuDriftCorrection.max
    },
    pressureThreshold: {
      type: Number,
      required: true,
      min: CALIBRATION_PARAMS.pressureThreshold.min,
      max: CALIBRATION_PARAMS.pressureThreshold.max
    },
    sampleWindow: {
      type: Number,
      required: true,
      min: CALIBRATION_PARAMS.sampleWindow.min,
      max: CALIBRATION_PARAMS.sampleWindow.max
    },
    filterCutoff: {
      type: Number,
      required: true,
      min: CALIBRATION_PARAMS.filterCutoff.min,
      max: CALIBRATION_PARAMS.filterCutoff.max
    },
    calibrationMatrix: {
      type: [[Number]],
      required: true,
      validate: {
        validator: function(matrix: number[][]) {
          return matrix.length === 3 && matrix.every(row => row.length === 3);
        },
        message: 'Calibration matrix must be 3x3'
      }
    },
    temperatureCompensation: {
      type: Number,
      required: true,
      min: -50,
      max: 50
    }
  },
  lastCalibration: {
    type: Date,
    required: true,
    index: true
  },
  batteryLevel: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    index: true
  },
  status: {
    type: Number,
    enum: Object.values(SENSOR_STATUS),
    required: true,
    index: true
  },
  firmwareVersion: {
    type: String,
    required: true,
    index: true
  },
  macAddress: {
    type: String,
    required: true,
    unique: true,
    match: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/
  },
  location: {
    type: String,
    required: true,
    index: true
  }
}, {
  timestamps: true,
  versionKey: true,
  collection: 'sensors'
});

// Compound indexes for optimized querying
SensorSchema.index({ type: 1, status: 1 });
SensorSchema.index({ macAddress: 1, type: 1 });
SensorSchema.index({ location: 1, type: 1 });
SensorSchema.index({ batteryLevel: 1, status: 1 });

// TTL index for data retention (auto-delete inactive sensors after 180 days)
SensorSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 15552000 });

/**
 * Custom validation for calibration parameters based on sensor type
 */
SensorSchema.pre('save', function(next) {
  const sensor = this as ISensorDocument;
  
  if (sensor.type === SENSOR_TYPES.IMU) {
    if (!sensor.calibrationParams.imuDriftCorrection) {
      next(new Error('IMU sensors require drift correction parameter'));
      return;
    }
  }
  
  if (sensor.type === SENSOR_TYPES.TOF) {
    if (!sensor.calibrationParams.tofGain) {
      next(new Error('ToF sensors require gain parameter'));
      return;
    }
  }
  
  next();
});

/**
 * Virtual getter for sensor health status
 */
SensorSchema.virtual('isHealthy').get(function(this: ISensorDocument) {
  return this.status === SENSOR_STATUS.ACTIVE && this.batteryLevel > 20;
});

/**
 * Method to validate calibration parameters
 */
SensorSchema.methods.validateCalibrationParams = function(): boolean {
  const sensor = this as ISensorDocument;
  
  // Validate based on sensor type
  if (sensor.type === SENSOR_TYPES.IMU) {
    return (
      sensor.calibrationParams.imuDriftCorrection >= CALIBRATION_PARAMS.imuDriftCorrection.min &&
      sensor.calibrationParams.imuDriftCorrection <= CALIBRATION_PARAMS.imuDriftCorrection.max
    );
  }
  
  if (sensor.type === SENSOR_TYPES.TOF) {
    return (
      sensor.calibrationParams.tofGain >= CALIBRATION_PARAMS.tofGainRange.min &&
      sensor.calibrationParams.tofGain <= CALIBRATION_PARAMS.tofGainRange.max
    );
  }
  
  return false;
};

// Create and export the Mongoose model
export const SensorModel = mongoose.model<ISensorDocument>('Sensor', SensorSchema);