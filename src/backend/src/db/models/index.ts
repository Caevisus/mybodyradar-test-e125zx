/**
 * @fileoverview Central export file for MongoDB/Mongoose models in the smart apparel system.
 * Implements unified model access with comprehensive type safety, field-level security,
 * and real-time processing support.
 * @version 2.0.0
 */

import mongoose from 'mongoose'; // ^7.5.0
import { mongodb-field-encryption } from 'mongodb-field-encryption'; // ^2.3.0

// Import models with their interfaces and types
import { AlertModel } from './alert.model';
import { AthleteModel } from './athlete.model';
import { SensorModel } from './sensor.model';
import { SessionModel } from './session.model';
import { TeamModel } from './team.model';

// Import interfaces for type safety
import { IAlert } from '../../interfaces/alert.interface';
import { IAthlete } from '../../interfaces/athlete.interface';
import { ISensorConfig } from '../../interfaces/sensor.interface';
import { ISession } from '../../interfaces/session.interface';
import { ITeam } from '../../interfaces/team.interface';

/**
 * Global encryption configuration for field-level security
 * Implements AES-256-GCM encryption with 90-day key rotation
 */
const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyRotation: 90 // days
};

/**
 * Model version for tracking schema changes and migrations
 */
const MODEL_VERSION = '2.0.0';

/**
 * Namespace containing all model interfaces for type safety
 */
export namespace ModelTypes {
  export type IAlert = IAlert;
  export type IAthlete = IAthlete;
  export type ISensor = ISensorConfig;
  export type ISession = ISession;
  export type ITeam = ITeam;
}

/**
 * Configure mongoose for production environment
 */
mongoose.set('debug', process.env.NODE_ENV !== 'production');
mongoose.set('strictQuery', true);
mongoose.set('autoIndex', false); // Disable in production

/**
 * Export all models with their configurations
 * Implements comprehensive model access with security features
 */
export const models = {
  AlertModel: AlertModel.plugin(mongodb-field-encryption, {
    fields: ['details.sensorData'],
    ...ENCRYPTION_CONFIG
  }),

  AthleteModel: AthleteModel.plugin(mongodb-field-encryption, {
    fields: ['name', 'email', 'baselineData'],
    ...ENCRYPTION_CONFIG
  }),

  SensorModel: SensorModel.plugin(mongodb-field-encryption, {
    fields: ['calibrationParams'],
    ...ENCRYPTION_CONFIG
  }),

  SessionModel: SessionModel.plugin(mongodb-field-encryption, {
    fields: ['metrics', 'sensorData'],
    ...ENCRYPTION_CONFIG
  }),

  TeamModel: TeamModel.plugin(mongodb-field-encryption, {
    fields: ['settings.alertThresholds'],
    ...ENCRYPTION_CONFIG
  })
};

/**
 * Export model version and configuration
 */
export {
  MODEL_VERSION,
  ENCRYPTION_CONFIG
};

/**
 * Validate model configuration on module load
 */
(() => {
  // Validate encryption configuration
  if (!ENCRYPTION_CONFIG.algorithm.includes('256')) {
    throw new Error('Insufficient encryption strength. AES-256 required.');
  }

  // Validate model version format
  if (!/^\d+\.\d+\.\d+$/.test(MODEL_VERSION)) {
    throw new Error('Invalid model version format');
  }

  // Validate mongoose connection options
  if (!mongoose.connection.getClient().options.ssl && process.env.NODE_ENV === 'production') {
    throw new Error('SSL required for database connections in production');
  }
})();