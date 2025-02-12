/**
 * @fileoverview TypeScript interface definitions for training session data structures
 * Provides comprehensive type definitions for real-time monitoring, metrics collection,
 * and performance analysis in the web frontend application
 * @version 1.0.0
 */

import { UUID } from 'crypto'; // v20.0.0+
import { ISensorData } from './sensor.interface';
import { IAthlete } from './athlete.interface';
import { BaseEntity } from './common.interface';

/**
 * Interface defining comprehensive real-time metrics collected during a training session
 * Supports real-time monitoring and performance analysis requirements
 */
export interface ISessionMetrics {
  // Real-time muscle activity monitoring data
  muscleActivity: Record<string, number>;

  // Force distribution across body segments
  forceDistribution: Record<string, number>;

  // Range of motion tracking with baseline comparison
  rangeOfMotion: Record<string, {
    current: number;
    baseline: number;
    deviation: number;
  }>;

  // Statistical anomaly detection scores
  anomalyScores: Record<string, number>;

  // Alert trigger conditions with thresholds
  alertTriggers: Record<string, {
    value: number;
    threshold: number;
  }>;
}

/**
 * Interface defining detailed configuration parameters for a training session
 * Supports customization of monitoring and analysis settings
 */
export interface ISessionConfig {
  // Type of training session
  type: string;

  // Configurable alert thresholds for different metrics
  alertThresholds: Record<string, number>;

  // Sampling rates for different sensor types
  samplingRates: Record<string, number>;

  // Data retention period in days
  dataRetention: number;

  // Enabled/disabled metrics for the session
  enabledMetrics: Record<string, boolean>;

  // Baseline reference values for comparison
  baselineReferences: Record<string, number>;
}

/**
 * Main interface for training session data structure
 * Implements comprehensive session tracking with real-time monitoring capabilities
 */
export interface ISession extends BaseEntity {
  // Unique session identifier
  id: UUID;

  // Reference to the athlete
  athleteId: UUID;

  // Session timing
  startTime: Date;
  endTime: Date;

  // Session configuration
  config: ISessionConfig;

  // Real-time metrics
  metrics: ISessionMetrics;

  // Sensor data collection
  sensorData: ISensorData[];

  // Session status
  status: 'active' | 'paused' | 'completed' | 'error';

  // Creation and update timestamps
  createdAt: Date;
  updatedAt: Date;

  // Additional metadata
  metadata: Record<string, any>;
}