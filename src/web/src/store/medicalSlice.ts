/**
 * @fileoverview Redux toolkit slice for HIPAA-compliant medical state management
 * Implements secure state handling for injury risk assessments, treatment plans,
 * and biomechanical metrics with comprehensive audit logging
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, createSelector, PayloadAction } from '@reduxjs/toolkit';
import { EncryptionService } from '@smartapparel/encryption'; // ^1.0.0
import { AuditService } from '@smartapparel/audit'; // ^1.0.0
import { 
  IInjuryRiskAssessment, 
  ITreatmentPlan, 
  IBiomechanicalMetrics,
  InjuryRiskLevel,
  IMedicalHistory
} from '../interfaces/medical.interface';
import type { UUID } from 'crypto';
import type { RootState } from './store';

// Initialize services
const encryptionService = new EncryptionService();
const auditService = new AuditService();

/**
 * Interface for medical state with HIPAA compliance
 */
interface MedicalState {
  riskAssessments: Record<string, IInjuryRiskAssessment>;
  treatmentPlans: Record<string, ITreatmentPlan>;
  biomechanicalMetrics: Record<string, IBiomechanicalMetrics>;
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
}

const initialState: MedicalState = {
  riskAssessments: {},
  treatmentPlans: {},
  biomechanicalMetrics: {},
  loading: false,
  error: null,
  lastSync: null
};

/**
 * Async thunk for securely fetching injury risk assessment with audit logging
 */
export const fetchRiskAssessmentWithAudit = createAsyncThunk(
  'medical/fetchRiskAssessment',
  async ({ athleteId, requesterId }: { athleteId: UUID; requesterId: string }, { rejectWithValue }) => {
    try {
      // Log access attempt
      await auditService.logAccess({
        userId: requesterId,
        resourceType: 'riskAssessment',
        resourceId: athleteId,
        action: 'view'
      });

      const response = await fetch(`/api/medical/risk-assessment/${athleteId}`, {
        headers: {
          'X-Requester-ID': requesterId,
          'X-Request-Type': 'HIPAA-Protected'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch risk assessment');
      }

      const data = await response.json();
      
      // Encrypt sensitive fields
      const encryptedData = await encryptionService.encryptFields(data, [
        'riskFactors',
        'recommendations',
        'biomechanicalMetrics'
      ]);

      // Log successful access
      await auditService.logSuccess({
        userId: requesterId,
        resourceType: 'riskAssessment',
        resourceId: athleteId
      });

      return encryptedData;
    } catch (error) {
      // Log error
      await auditService.logError({
        userId: requesterId,
        resourceType: 'riskAssessment',
        resourceId: athleteId,
        error: error as Error
      });
      return rejectWithValue(error);
    }
  }
);

/**
 * Async thunk for updating treatment plans with HIPAA compliance
 */
export const updateTreatmentPlanSecure = createAsyncThunk(
  'medical/updateTreatmentPlan',
  async ({ 
    planId, 
    updates, 
    requesterId 
  }: { 
    planId: UUID; 
    updates: Partial<ITreatmentPlan>; 
    requesterId: string 
  }, { rejectWithValue }) => {
    try {
      // Encrypt sensitive update fields
      const encryptedUpdates = await encryptionService.encryptFields(updates, [
        'diagnosis',
        'recommendations',
        'restrictions'
      ]);

      const response = await fetch(`/api/medical/treatment-plan/${planId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requester-ID': requesterId,
          'X-Request-Type': 'HIPAA-Protected'
        },
        body: JSON.stringify(encryptedUpdates)
      });

      if (!response.ok) {
        throw new Error('Failed to update treatment plan');
      }

      const updatedPlan = await response.json();

      // Log modification
      await auditService.logModification({
        userId: requesterId,
        resourceType: 'treatmentPlan',
        resourceId: planId,
        changes: updates
      });

      return updatedPlan;
    } catch (error) {
      await auditService.logError({
        userId: requesterId,
        resourceType: 'treatmentPlan',
        resourceId: planId,
        error: error as Error
      });
      return rejectWithValue(error);
    }
  }
);

/**
 * Medical slice with HIPAA-compliant reducers
 */
const medicalSlice = createSlice({
  name: 'medical',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    updateBiomechanicalMetrics: (state, action: PayloadAction<IBiomechanicalMetrics>) => {
      const { timestamp, ...metrics } = action.payload;
      state.biomechanicalMetrics[timestamp.toISOString()] = {
        ...metrics,
        timestamp
      };
    },
    clearMedicalData: (state) => {
      state.riskAssessments = {};
      state.treatmentPlans = {};
      state.biomechanicalMetrics = {};
      state.lastSync = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRiskAssessmentWithAudit.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRiskAssessmentWithAudit.fulfilled, (state, action) => {
        state.loading = false;
        state.riskAssessments[action.payload.athleteId] = action.payload;
        state.lastSync = new Date();
      })
      .addCase(fetchRiskAssessmentWithAudit.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateTreatmentPlanSecure.fulfilled, (state, action) => {
        state.treatmentPlans[action.payload.id] = action.payload;
        state.lastSync = new Date();
      });
  }
});

// Selectors with memoization for performance
export const selectEncryptedRiskAssessment = createSelector(
  [(state: RootState) => state.medical.riskAssessments, (_, athleteId: UUID) => athleteId],
  (riskAssessments, athleteId) => riskAssessments[athleteId]
);

export const selectTreatmentPlan = createSelector(
  [(state: RootState) => state.medical.treatmentPlans, (_, planId: UUID) => planId],
  (treatmentPlans, planId) => treatmentPlans[planId]
);

export const selectLatestBiomechanicalMetrics = createSelector(
  [(state: RootState) => state.medical.biomechanicalMetrics],
  (metrics) => {
    const timestamps = Object.keys(metrics).sort();
    return timestamps.length ? metrics[timestamps[timestamps.length - 1]] : null;
  }
);

export const { setLoading, updateBiomechanicalMetrics, clearMedicalData } = medicalSlice.actions;
export default medicalSlice.reducer;