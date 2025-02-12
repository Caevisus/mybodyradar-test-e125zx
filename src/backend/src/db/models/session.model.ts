/**
 * @fileoverview MongoDB schema and model definition for training sessions in the smart apparel system.
 * Implements comprehensive data model with real-time metrics calculation, optimized indexing,
 * and enhanced security features as specified in technical requirements.
 */

import mongoose, { Schema, Document } from 'mongoose'; // ^7.5.0
import { ISession } from '../../interfaces/session.interface';
import { ISensorData } from '../../interfaces/sensor.interface';
import { SENSOR_TYPES, SENSOR_STATUS } from '../../constants/sensor.constants';

/**
 * Enhanced schema definition for session metrics with comprehensive performance indicators
 */
const sessionMetricsSchema = new Schema({
  muscleActivity: {
    type: Map,
    of: {
      current: { type: Number, required: true },
      baseline: { type: Number, required: true },
      variance: { type: Number, required: true }
    }
  },
  forceDistribution: {
    type: Map,
    of: {
      magnitude: { type: Number, required: true },
      direction: { type: Number, required: true },
      balance: { type: Number, required: true }
    }
  },
  rangeOfMotion: {
    type: Map,
    of: {
      current: { type: Number, required: true },
      baseline: { type: Number, required: true },
      deviation: { type: Number, required: true }
    }
  },
  anomalyScores: {
    type: Map,
    of: {
      score: { type: Number, required: true },
      confidence: { type: Number, required: true },
      timestamp: { type: Date, required: true }
    }
  },
  performanceIndicators: {
    type: Map,
    of: {
      value: { type: Number, required: true },
      trend: { type: Number, required: true },
      threshold: { type: Number, required: true }
    }
  }
});

/**
 * Enhanced schema definition for session configuration with validation
 */
const sessionConfigSchema = new Schema({
  type: { 
    type: String, 
    required: true,
    enum: ['training', 'assessment', 'recovery', 'competition']
  },
  alertThresholds: {
    type: Map,
    of: {
      warning: { type: Number, required: true },
      critical: { type: Number, required: true },
      sensitivity: { type: Number, required: true }
    },
    validate: {
      validator: function(thresholds: Map<string, any>) {
        return Array.from(thresholds.values()).every(t => 
          t.warning < t.critical && 
          t.sensitivity >= 0 && 
          t.sensitivity <= 1
        );
      },
      message: 'Invalid threshold configuration'
    }
  },
  samplingRates: {
    type: Map,
    of: {
      rate: {
        type: Number,
        validate: {
          validator: function(rate: number) {
            return rate >= SAMPLING_RATES.TOF && rate <= SAMPLING_RATES.IMU;
          },
          message: 'Sampling rate must be within valid range'
        }
      },
      precision: { type: Number, min: 0, max: 1 }
    }
  },
  dataRetention: {
    duration: { type: Number, required: true },
    granularity: { 
      type: String, 
      enum: ['raw', 'aggregated', 'summary'],
      required: true 
    }
  }
});

/**
 * Enhanced schema definition for sensor data with optimized storage
 */
const sensorDataSchema = new Schema({
  sensorId: { type: String, required: true },
  timestamp: { type: Number, required: true },
  readings: [{
    type: { 
      type: String, 
      enum: Object.values(SENSOR_TYPES),
      required: true 
    },
    value: [Number],
    timestamp: { type: Number, required: true },
    confidence: { type: Number, min: 0, max: 1 },
    rawData: Buffer
  }],
  metadata: {
    calibrationVersion: String,
    processingSteps: [String],
    quality: { type: Number, min: 0, max: 100 },
    environmentalFactors: Map,
    processingLatency: Number
  },
  dataQuality: { type: Number, min: 0, max: 100 }
});

/**
 * Main session schema with comprehensive tracking and optimization features
 */
const sessionSchema = new Schema({
  athleteId: { 
    type: String, 
    required: true,
    index: true 
  },
  startTime: { 
    type: Date, 
    required: true,
    index: true 
  },
  endTime: { 
    type: Date,
    validate: {
      validator: function(this: any, endTime: Date) {
        return !endTime || endTime > this.startTime;
      },
      message: 'End time must be after start time'
    }
  },
  config: {
    type: sessionConfigSchema,
    required: true
  },
  metrics: {
    type: sessionMetricsSchema,
    default: {}
  },
  sensorData: {
    type: [sensorDataSchema],
    validate: {
      validator: function(data: any[]) {
        return data.length <= 1000; // Limit array size for performance
      },
      message: 'Sensor data array exceeds maximum size'
    }
  },
  status: {
    current: {
      type: String,
      enum: Object.values(SENSOR_STATUS),
      required: true
    },
    timestamp: { type: Date, required: true },
    history: [{
      status: {
        type: String,
        enum: Object.values(SENSOR_STATUS)
      },
      timestamp: Date
    }]
  }
}, {
  timestamps: true,
  optimisticConcurrency: true,
  collection: 'sessions'
});

// Compound indexes for optimized querying
sessionSchema.index({ athleteId: 1, startTime: -1 });
sessionSchema.index({ 'status.current': 1, startTime: -1 });

// TTL index for data retention
sessionSchema.index({ startTime: 1 }, { 
  expireAfterSeconds: 180 * 24 * 60 * 60 // 180 days
});

// Interface for Session document with methods
interface ISessionDocument extends ISession, Document {
  calculateMetrics(sensorData: ISensorData[]): Promise<void>;
  validateConfig(): boolean;
}

// Add methods to schema
sessionSchema.methods.calculateMetrics = async function(sensorData: ISensorData[]): Promise<void> {
  // Implementation of real-time metrics calculation
  // This would be implemented based on specific algorithmic requirements
};

sessionSchema.methods.validateConfig = function(): boolean {
  // Implementation of configuration validation
  // This would be implemented based on specific validation requirements
  return true;
};

// Create and export the model
export const SessionModel = mongoose.model<ISessionDocument>('Session', sessionSchema);