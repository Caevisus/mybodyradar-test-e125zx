/**
 * @fileoverview TypeScript interface definitions for team data structures in the smart apparel system
 * Implements comprehensive team management, analytics, and security features as specified in technical requirements.
 * @version 1.0.0
 */

import { UUID } from 'crypto'; // latest
import { IAthlete } from './athlete.interface';

/**
 * Interface defining comprehensive team-wide configuration settings
 * Maps to technical specifications for team management and security controls
 */
export interface ITeamSettings {
  alertThresholds: Record<string, number>;
  dataRetentionDays: number;
  notificationPreferences: {
    email: boolean;
    push: boolean;
    sms: boolean;
    allowedHours: string[];
    alertTypes: string[];
  };
  dataAccessControls: Record<string, boolean>;
  encryptionKeys: Record<string, string>;
  analyticsConfig: {
    realTimeWindow: number;
    aggregationPeriod: number;
    storagePolicy: {
      hotStorage: number;
      warmStorage: number;
      coldStorage: number;
    };
    customMetrics: Record<string, {
      enabled: boolean;
      formula: string;
      threshold: number;
    }>;
  };
}

/**
 * Interface for comprehensive team performance and analytics metrics
 * Implements real-time monitoring and statistical analysis capabilities
 */
export interface ITeamStats {
  totalAthletes: number;
  activeSessions: number;
  alertsToday: number;
  lastUpdated: Date;
  performanceMetrics: Record<string, number>;
  realtimeAnalytics: {
    activeUsers: number;
    avgIntensity: number;
    anomalyCount: number;
    sensorHealth: Record<string, number>;
  };
  historicalTrends: Array<{
    timestamp: Date;
    metrics: Record<string, number>;
    alerts: number;
    participation: number;
  }>;
}

/**
 * Main team interface with comprehensive type safety and security features
 * Implements core data model with enhanced security controls
 */
export interface ITeam {
  id: UUID;
  name: string;
  athleteIds: UUID[];
  settings: ITeamSettings;
  stats: ITeamStats;
  createdAt: Date;
  updatedAt: Date;
  securityContext: Record<string, any>;
  accessControl: {
    admins: UUID[];
    coaches: UUID[];
    medicalStaff: UUID[];
    dataAccessPolicies: Record<string, {
      role: string;
      permissions: string[];
      restrictions: string[];
    }>;
    auditLog: Array<{
      timestamp: Date;
      userId: UUID;
      action: string;
      resource: string;
    }>;
  };
  integrations: {
    ehrSystem?: {
      enabled: boolean;
      systemId: string;
      lastSync: Date;
      syncConfig: Record<string, any>;
    };
    teamManagement?: {
      enabled: boolean;
      systemId: string;
      lastSync: Date;
      syncConfig: Record<string, any>;
    };
  };
}

/**
 * Type guard to validate team data structure
 * @param team - Object to validate as ITeam
 * @returns boolean indicating if object conforms to ITeam interface
 */
export function isTeam(team: any): team is ITeam {
  return (
    team &&
    typeof team.id === 'string' &&
    typeof team.name === 'string' &&
    Array.isArray(team.athleteIds) &&
    team.settings &&
    team.stats &&
    team.createdAt instanceof Date &&
    team.updatedAt instanceof Date
  );
}