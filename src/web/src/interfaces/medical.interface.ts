/**
 * @fileoverview Medical data structure interfaces with HIPAA compliance and security
 * Provides comprehensive type definitions for injury risk assessment, biomechanical metrics,
 * and treatment plans with enhanced security features
 * @version 1.0.0
 */

import { UUID } from 'crypto'; // v20.0.0+
import { IApiResponse } from './common.interface';
import { IAthlete } from './athlete.interface';

/**
 * Encryption metadata for HIPAA-compliant data storage
 */
interface IEncryptionMetadata {
  algorithm: string;
  keyId: UUID;
  iv: string;
  encryptedAt: Date;
  version: string;
}

/**
 * HIPAA compliance metadata for medical records
 */
interface IHipaaMetadata {
  phi: boolean;
  securityLevel: 'normal' | 'sensitive' | 'restricted';
  dataRetentionPeriod: number; // Days
  lastAccessedBy: UUID;
  lastAccessedAt: Date;
  authorizedRoles: string[];
}

/**
 * Audit record for tracking data access and modifications
 */
interface IAuditRecord {
  id: UUID;
  userId: UUID;
  action: 'view' | 'modify' | 'delete' | 'share';
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  changes?: Record<string, any>;
}

/**
 * Treatment plan version history
 */
interface ITreatmentPlanVersion {
  version: number;
  modifiedAt: Date;
  modifiedBy: UUID;
  changes: Record<string, any>;
  reason: string;
}

/**
 * Enum for injury risk assessment levels
 */
export enum InjuryRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

/**
 * Interface for enhanced biomechanical measurement data with encryption
 */
export interface IBiomechanicalMetrics {
  muscleLoad: Record<string, number>;
  jointAngles: Record<string, number>;
  forceDistribution: Record<string, number>;
  muscleActivation: Record<string, number>;
  impactForces: Record<string, number>;
  timestamp: Date;
  encryptionMetadata: IEncryptionMetadata;
}

/**
 * Interface for comprehensive injury risk assessment with HIPAA compliance
 */
export interface IInjuryRiskAssessment {
  athleteId: UUID;
  riskLevel: InjuryRiskLevel;
  riskFactors: string[];
  biomechanicalMetrics: IBiomechanicalMetrics;
  recommendations: string[];
  assessmentDate: Date;
  hipaaCompliance: IHipaaMetadata;
  auditTrail: IAuditRecord[];
}

/**
 * Interface for versioned treatment plans with HIPAA compliance
 */
export interface ITreatmentPlan {
  id: UUID;
  version: number;
  athleteId: UUID;
  diagnosis: string;
  recommendations: string[];
  restrictions: string[];
  startDate: Date;
  endDate: Date;
  status: 'active' | 'completed' | 'cancelled';
  hipaaCompliance: IHipaaMetadata;
  versionHistory: ITreatmentPlanVersion[];
  auditTrail: IAuditRecord[];
}

/**
 * Interface for secure athlete medical history with HIPAA compliance
 */
export interface IMedicalHistory {
  athleteId: UUID;
  injuries: Array<{
    date: Date;
    description: string;
    severity: string;
    recoveryTime: number;
  }>;
  treatments: ITreatmentPlan[];
  riskAssessments: IInjuryRiskAssessment[];
  hipaaCompliance: IHipaaMetadata;
  encryptionMetadata: IEncryptionMetadata;
  auditTrail: IAuditRecord[];
}

/**
 * Type definition for medical data API responses
 */
export type MedicalApiResponse<T> = IApiResponse<T & {
  hipaaCompliance: IHipaaMetadata;
  auditRecord: IAuditRecord;
}>;