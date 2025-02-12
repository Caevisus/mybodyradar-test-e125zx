/**
 * @fileoverview TypeScript interface definitions for athlete data structures in the smart apparel system
 * Implements comprehensive data models for biomechanical monitoring, athlete management,
 * and enhanced security/privacy controls as specified in technical requirements.
 */

import { SENSOR_TYPES } from '../constants/sensor.constants';
import { UUID } from 'crypto'; // v1.0.0
import { EncryptedField } from '@types/security-utils'; // ^1.0.0

/**
 * Interface defining comprehensive baseline biomechanical measurements
 * Maps to technical specifications for advanced biomechanical monitoring
 */
export interface IBaselineData {
  muscleProfiles: Record<string, {
    value: number;
    timestamp: Date;
    confidence: number;
  }>;
  rangeOfMotion: Record<string, {
    min: number;
    max: number;
    optimal: number;
    lastMeasured: Date;
  }>;
  forceDistribution: Record<string, {
    distribution: number;
    symmetry: number;
    timestamp: Date;
  }>;
  sensorCalibration: Record<SENSOR_TYPES, {
    calibration: number;
    lastCalibrated: Date;
  }>;
  lastUpdated: Date;
}

/**
 * Interface for athlete preferences with enhanced privacy controls
 * Implements granular data sharing and notification settings
 */
export interface IAthletePreferences {
  alertThresholds: Record<string, {
    value: number;
    enabled: boolean;
  }>;
  notificationSettings: {
    email: boolean;
    push: boolean;
    sms: boolean;
    allowedHours: string[];
  };
  dataSharing: {
    medical: {
      enabled: boolean;
      authorizedProviders: UUID[];
      sharedMetrics: string[];
    };
    coach: {
      enabled: boolean;
      authorizedCoaches: UUID[];
      sharedMetrics: string[];
    };
    team: {
      enabled: boolean;
      sharedMetrics: string[];
    };
  };
}

/**
 * Interface for training session data with enhanced metrics
 * Captures comprehensive performance and biomechanical data
 */
export interface IAthleteSession {
  id: UUID;
  startTime: Date;
  endTime: Date;
  type: string;
  activeSensors: Record<SENSOR_TYPES, boolean>;
  metrics: {
    intensityScore: number;
    fatigueIndex: number;
    technicalScore: number;
  };
}

/**
 * Interface for team association data
 * Manages athlete team relationships and roles
 */
export interface IAthleteTeam {
  id: UUID;
  name: string;
  role: string;
  joinedAt: Date;
}

/**
 * Main athlete interface with enhanced security and monitoring capabilities
 * Implements core data model with field-level encryption for PII
 */
export interface IAthlete {
  id: UUID;
  name: string;
  email: EncryptedField<string>;
  team: IAthleteTeam;
  baselineData: IBaselineData;
  preferences: IAthletePreferences;
  sessions: IAthleteSession[];
  privacySettings: {
    dataEncrypted: boolean;
    lastConsent: Date;
    consentedPurposes: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}