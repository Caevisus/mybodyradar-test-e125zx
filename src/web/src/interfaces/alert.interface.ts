/**
 * @fileoverview Defines TypeScript interfaces for the alert system in the web frontend,
 * supporting real-time monitoring with >85% injury prediction accuracy and comprehensive
 * alert classification capabilities.
 * @version 1.0.0
 */

import { 
  ALERT_TYPES,
  ALERT_SEVERITY,
  ALERT_STATUS,
  ALERT_CATEGORIES
} from '../constants/alert.constants';
import { ISensorData } from './sensor.interface';
import type { UUID } from 'crypto';

/**
 * Main interface for comprehensive alert data structure
 * Supports high-sensitivity anomaly detection and real-time monitoring
 */
export interface IAlert {
  /** Unique identifier for the alert */
  id: UUID;
  /** Classification of alert based on monitoring type */
  type: ALERT_TYPES;
  /** Specific category for detailed classification */
  category: ALERT_CATEGORIES;
  /** Medical-grade severity assessment */
  severity: ALERT_SEVERITY;
  /** Current state in alert lifecycle */
  status: ALERT_STATUS;
  /** Associated training session identifier */
  sessionId: UUID;
  /** Precise timestamp of alert generation */
  timestamp: Date;
  /** Human-readable alert description */
  message: string;
  /** Comprehensive alert details */
  details: IAlertDetails;
  /** User who acknowledged the alert (if applicable) */
  acknowledgedBy?: UUID;
  /** Timestamp of acknowledgment (if applicable) */
  acknowledgedAt?: Date;
  /** Resolution details (if applicable) */
  resolution?: {
    resolvedBy: UUID;
    resolvedAt: Date;
    notes: string;
  };
}

/**
 * Interface for detailed alert information supporting high-sensitivity detection
 * Includes comprehensive biomechanical and physiological parameters
 */
export interface IAlertDetails {
  /** Threshold value that triggered the alert */
  threshold: number;
  /** Actual value that exceeded the threshold */
  currentValue: number;
  /** Associated sensor data for analysis */
  sensorData: ISensorData;
  /** Anatomical or system location */
  location: string;
  /** Action recommendations for alert resolution */
  recommendations: string[];
  /** Historical context for trend analysis */
  historicalData?: {
    values: number[];
    timestamps: Date[];
  };
  /** Confidence score for prediction accuracy */
  confidenceScore?: number;
  /** Related alerts for pattern recognition */
  relatedAlerts?: UUID[];
  /** Biomechanical metrics (if applicable) */
  biomechanicalMetrics?: {
    force: number;
    velocity: number;
    acceleration: number;
    range: number;
  };
}

/**
 * Interface for configurable alert subscription preferences
 * Enables personalized monitoring and notification settings
 */
export interface IAlertSubscription {
  /** User identifier for subscription */
  userId: UUID;
  /** Types of alerts to monitor */
  alertTypes: ALERT_TYPES[];
  /** Specific categories of interest */
  categories: ALERT_CATEGORIES[];
  /** Minimum severity level for notifications */
  minSeverity: ALERT_SEVERITY;
  /** Preferred notification channels */
  notificationChannels: string[];
  /** Custom threshold overrides */
  thresholdOverrides?: {
    [key in ALERT_TYPES]?: number;
  };
  /** Quiet hours configuration */
  quietHours?: {
    enabled: boolean;
    start: string; // 24-hour format (HH:mm)
    end: string;   // 24-hour format (HH:mm)
  };
}

/**
 * Interface for comprehensive alert filtering capabilities
 * Supports advanced search and analysis features
 */
export interface IAlertFilter {
  /** Filter by alert types */
  types?: ALERT_TYPES[];
  /** Filter by categories */
  categories?: ALERT_CATEGORIES[];
  /** Filter by severity levels */
  severities?: ALERT_SEVERITY[];
  /** Filter by current status */
  statuses?: ALERT_STATUS[];
  /** Filter by date range */
  dateRange?: {
    start: Date;
    end: Date;
  };
  /** Filter by specific users */
  userIds?: UUID[];
  /** Filter by confidence score range */
  confidenceRange?: {
    min: number;
    max: number;
  };
  /** Filter by anatomical location */
  locations?: string[];
  /** Include resolved alerts */
  includeResolved?: boolean;
  /** Sort order configuration */
  sortBy?: {
    field: keyof IAlert;
    order: 'asc' | 'desc';
  };
}

/**
 * Interface for alert analytics and reporting
 * Supports statistical analysis and trend identification
 */
export interface IAlertAnalytics {
  /** Alert frequency metrics */
  frequency: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  /** Distribution by type */
  distribution: {
    [key in ALERT_TYPES]: number;
  };
  /** Resolution time metrics */
  resolutionTime: {
    average: number;
    median: number;
    byType: {
      [key in ALERT_TYPES]: number;
    };
  };
  /** Trend analysis data */
  trends: {
    period: string;
    data: Array<{
      timestamp: Date;
      count: number;
      severity: ALERT_SEVERITY;
    }>;
  };
}