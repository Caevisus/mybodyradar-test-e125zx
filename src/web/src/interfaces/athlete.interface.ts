/**
 * @fileoverview TypeScript interface definitions for athlete data structures
 * Provides comprehensive type definitions for biomechanical measurements,
 * personal information, and enhanced privacy controls
 * @version 1.0.0
 */

import { UUID } from 'crypto'; // v20.0.0+
import { BaseEntity } from './common.interface';

/**
 * Interface defining comprehensive baseline biomechanical measurements for an athlete
 * Captures detailed muscle activity, movement patterns, and soft tissue characteristics
 */
export interface IBaselineData {
  // Detailed muscle activity profiles with historical tracking
  muscleProfiles: Record<string, {
    current: number;
    historical: number[];
    threshold: number;
  }>;

  // Joint mobility and flexibility measurements
  rangeOfMotion: Record<string, {
    min: number;
    max: number;
    optimal: number;
    lastMeasured: Date;
  }>;

  // Ground reaction forces and pressure distribution
  forceDistribution: Record<string, {
    value: number;
    distribution: number[];
    timestamp: Date;
  }>;

  // Bilateral symmetry measurements
  symmetryMetrics: Record<string, {
    left: number;
    right: number;
    ratio: number;
  }>;

  // Soft tissue characteristics from ToF sensors
  softTissueCharacteristics: Record<string, {
    value: number;
    unit: string;
    timestamp: Date;
  }>;

  lastUpdated: Date;
}

/**
 * Interface defining detailed athlete preferences with enhanced privacy
 * and notification controls for data sharing and alerts
 */
export interface IAthletePreferences {
  // Configurable thresholds for different types of alerts
  alertThresholds: Record<string, {
    warning: number;
    critical: number;
    enabled: boolean;
  }>;

  // Comprehensive notification settings
  notificationSettings: {
    email: boolean;
    push: boolean;
    sms: boolean;
    preferredHours: string[];
    alertTypes: Record<string, boolean>;
  };

  // Granular data sharing controls
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

  // Enhanced privacy settings
  privacySettings: {
    anonymizeData: boolean;
    dataRetentionDays: number;
    encryptedFields: string[];
  };
}

/**
 * Main athlete interface with comprehensive data structure
 * Implements enhanced privacy controls and detailed biomechanical tracking
 */
export interface IAthlete extends BaseEntity {
  id: UUID;
  name: string;
  email: string;
  teamId: UUID;
  
  // Comprehensive biomechanical measurements
  baselineData: IBaselineData;
  
  // User preferences and privacy settings
  preferences: IAthletePreferences;
  
  // Training session tracking
  sessionIds: UUID[];
  
  // Access control for medical staff, coaches, and other personnel
  authorizedPersonnel: Record<string, {
    id: UUID;
    role: string;
    access: string[];
  }>;
  
  createdAt: Date;
  updatedAt: Date;
}