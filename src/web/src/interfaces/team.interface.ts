/**
 * @fileoverview TypeScript interface definitions for team-related data structures
 * Provides comprehensive type definitions for team management, analytics, and security
 * with enhanced privacy controls and audit capabilities
 * @version 1.0.0
 */

import { UUID } from 'crypto'; // v20.0.0+
import { BaseEntity } from './common.interface';
import { IAthlete } from './athlete.interface';

/**
 * Interface defining comprehensive team-wide settings and configurations
 * Implements enhanced security controls and data protection measures
 */
export interface ITeamSettings {
  // Configurable thresholds for different types of team-wide alerts
  alertThresholds: Record<string, number>;

  // Data retention and backup configuration
  dataRetentionPolicy: {
    days: number;
    backupFrequency: string; // 'daily' | 'weekly' | 'monthly'
  };

  // Team-wide notification preferences
  notificationPreferences: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };

  // Field-level encryption configuration
  encryptedFields: string[];

  // Role-based access control mappings
  accessControl: Record<string, string[]>;
}

/**
 * Interface defining comprehensive team statistics and analytics
 * Includes compliance tracking and performance metrics
 */
export interface ITeamStats {
  // Team composition metrics
  totalAthletes: number;
  activeSessions: number;
  alertsToday: number;

  // Aggregated performance metrics
  performanceMetrics: Record<string, number>;

  // Compliance status tracking
  complianceStatus: {
    gdpr: boolean;
    hipaa: boolean;
  };

  // Last compliance audit timestamp
  lastAuditDate: Date;
}

/**
 * Main team interface with enhanced security features and audit capabilities
 * Implements comprehensive data protection and access controls
 */
export interface ITeam extends BaseEntity {
  // Core team identifiers
  id: UUID;
  name: string;

  // Team composition
  athleteIds: UUID[];

  // Team configuration and analytics
  settings: ITeamSettings;
  stats: ITeamStats;

  // Security classification
  securityLevel: string; // 'high' | 'medium' | 'low'
  dataClassification: string; // 'sensitive' | 'confidential' | 'public'

  // Audit tracking
  auditLog: {
    lastCheck: Date;
    status: string;
  };
}