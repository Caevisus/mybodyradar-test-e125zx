/**
 * @fileoverview TypeScript interface definitions for the alert system in the smart apparel system.
 * Implements comprehensive data structures for real-time biomechanical and physiological alerts
 * with support for >85% injury prediction accuracy as specified in technical requirements.
 * @version 1.0.0
 */

import { UUID } from 'crypto'; // latest
import { 
  ALERT_TYPES, 
  ALERT_SEVERITY, 
  ALERT_STATUS 
} from '../constants/alert.constants';
import { ISensorData } from './sensor.interface';
import { ISession } from './session.interface';

/**
 * Main interface for alert data structure with comprehensive tracking capabilities
 * Implements core alert system requirements with support for real-time monitoring
 */
export interface IAlert {
  /** Unique identifier for the alert */
  id: UUID;

  /** Category of the alert (biomechanical, physiological, etc.) */
  type: ALERT_TYPES;

  /** Alert severity level for prioritization */
  severity: ALERT_SEVERITY;

  /** Current status in the alert lifecycle */
  status: ALERT_STATUS;

  /** Associated training session ID */
  sessionId: UUID;

  /** Timestamp when the alert was generated */
  timestamp: Date;

  /** Human-readable alert description */
  message: string;

  /** Detailed alert information and measurements */
  details: IAlertDetails;

  /** User ID who acknowledged the alert */
  acknowledgedBy?: UUID;

  /** Timestamp when alert was acknowledged */
  acknowledgedAt?: Date;

  /** User ID who resolved the alert */
  resolvedBy?: UUID;

  /** Timestamp when alert was resolved */
  resolvedAt?: Date;

  /** Notes added during alert resolution */
  resolutionNotes?: string;

  /** ML model confidence score (0-1) for injury prediction */
  confidenceScore: number;
}

/**
 * Interface for detailed alert information including measurements and analysis
 * Supports technical requirement of >85% injury prediction sensitivity
 */
export interface IAlertDetails {
  /** Configured threshold that triggered the alert */
  threshold: number;

  /** Actual value that exceeded the threshold */
  currentValue: number;

  /** Associated sensor data that triggered the alert */
  sensorData: ISensorData;

  /** Anatomical location or system component */
  location: string;

  /** Percentage deviation from baseline */
  deviationPercentage: number;

  /** Historical baseline value for comparison */
  historicalBaseline: number;

  /** Trend analysis data */
  trendAnalysis: {
    direction: 'increasing' | 'decreasing' | 'stable';
    rate: number;
    timeWindow: number;
  };

  /** Related performance metrics */
  relatedMetrics: Map<string, number>;

  /** Identified risk factors */
  riskFactors: string[];
}

/**
 * Interface for alert subscription preferences and notification rules
 * Implements granular control over alert delivery and escalation
 */
export interface IAlertSubscription {
  /** User ID for the subscription */
  userId: UUID;

  /** Types of alerts to receive */
  alertTypes: ALERT_TYPES[];

  /** Minimum severity level to trigger notification */
  minSeverity: ALERT_SEVERITY;

  /** Preferred notification channels */
  notificationChannels: string[];

  /** Time-based notification preferences */
  schedulePreferences: {
    timezone: string;
    activeHours: {
      start: string;
      end: string;
    }[];
    blackoutPeriods: {
      start: Date;
      end: Date;
    }[];
  };

  /** Custom thresholds for specific metrics */
  customThresholds: Map<string, number>;

  /** Periods when notifications should be suppressed */
  mutePeriods: {
    start: Date;
    end: Date;
    reason: string;
  }[];

  /** Rules for alert escalation */
  escalationRules: {
    condition: string;
    delay: number;
    escalateToUserId: UUID;
    notificationChannels: string[];
  }[];
}