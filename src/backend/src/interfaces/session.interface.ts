/**
 * @fileoverview TypeScript interface definitions for training session data structures in the smart apparel system.
 * Implements comprehensive data models for real-time monitoring, performance analytics, and session management
 * as specified in technical requirements.
 */

import { UUID } from 'crypto'; // v1.0.0
import { ISensorData } from './sensor.interface';
import { IAthlete } from './athlete.interface';

/**
 * Interface defining comprehensive real-time metrics with baseline comparisons
 * and anomaly detection capabilities
 */
export interface ISessionMetrics {
  /** Muscle activity measurements with baseline comparison */
  muscleActivity: Record<string, {
    current: number;
    baseline: number;
    variance: number;
  }>;

  /** Force distribution across body segments */
  forceDistribution: Record<string, {
    magnitude: number;
    direction: number;
    balance: number;
  }>;

  /** Range of motion measurements with baseline deviation tracking */
  rangeOfMotion: Record<string, {
    current: number;
    baseline: number;
    deviation: number;
  }>;

  /** Anomaly detection scores with confidence levels */
  anomalyScores: Record<string, {
    score: number;
    confidence: number;
    timestamp: Date;
  }>;

  /** Key performance indicators with trend analysis */
  performanceIndicators: Record<string, {
    value: number;
    trend: number;
    threshold: number;
  }>;
}

/**
 * Interface defining detailed configuration parameters for session monitoring
 * including thresholds and sampling specifications
 */
export interface ISessionConfig {
  /** Type of training session */
  type: string;

  /** Alert thresholds for different metrics */
  alertThresholds: Record<string, {
    warning: number;
    critical: number;
    sensitivity: number;
  }>;

  /** Sensor-specific sampling rate configurations */
  samplingRates: Record<string, {
    rate: number;
    precision: number;
  }>;

  /** Data retention policy for the session */
  dataRetention: {
    duration: number;
    granularity: string;
  };
}

/**
 * Main interface for training session with comprehensive status tracking
 * and performance metrics
 */
export interface ISession {
  /** Unique session identifier */
  id: UUID;

  /** Reference to the athlete */
  athleteId: UUID;

  /** Session start timestamp */
  startTime: Date;

  /** Session end timestamp */
  endTime: Date;

  /** Session configuration parameters */
  config: ISessionConfig;

  /** Real-time and aggregated metrics */
  metrics: ISessionMetrics;

  /** Raw sensor data collection */
  sensorData: ISensorData[];

  /** Session status tracking */
  status: {
    current: string;
    timestamp: Date;
    history: Array<{
      status: string;
      timestamp: Date;
    }>;
  };
}