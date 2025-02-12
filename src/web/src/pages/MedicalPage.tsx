/**
 * @fileoverview Medical dashboard page component providing HIPAA-compliant health monitoring
 * and injury risk assessment capabilities for medical professionals.
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import InjuryRiskCard from '../../components/medical/InjuryRiskCard';
import TreatmentPlan from '../../components/medical/TreatmentPlan';
import MedicalHistory from '../../components/medical/MedicalHistory';
import { MedicalService } from '../../services/medical.service';
import type { IInjuryRiskAssessment } from '../../interfaces/medical.interface';

// Access level enumeration for medical staff
enum AccessLevel {
  READ = 'read',
  WRITE = 'write',
  ADMIN = 'admin'
}

interface MedicalPageProps {
  athleteId: string;
  userAccessLevel?: AccessLevel;
  encryptionKey?: string;
}

/**
 * Medical dashboard page component implementing HIPAA-compliant health monitoring
 * and real-time injury risk assessment.
 */
const MedicalPage: React.FC<MedicalPageProps> = ({
  athleteId,
  userAccessLevel = AccessLevel.READ,
  encryptionKey = process.env.REACT_APP_MEDICAL_ENCRYPTION_KEY
}) => {
  // State management
  const [riskAssessment, setRiskAssessment] = useState<IInjuryRiskAssessment | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Service instance
  const medicalService = React.useMemo(() => new MedicalService(), []);

  /**
   * Fetches initial risk assessment data with HIPAA compliance
   */
  const loadRiskAssessment = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await medicalService.getRiskAssessment(athleteId);
      setRiskAssessment(response.data);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load risk assessment'));
      console.error('Error loading risk assessment:', err);
    } finally {
      setIsLoading(false);
    }
  }, [athleteId, medicalService]);

  /**
   * Handles secure updates to treatment recommendations
   */
  const handleRecommendationClick = useCallback(async (recommendation: string) => {
    if (userAccessLevel === AccessLevel.READ) {
      setError(new Error('Insufficient permissions to modify recommendations'));
      return;
    }

    try {
      await medicalService.updateTreatmentPlan({
        athleteId,
        recommendations: [recommendation],
        modifiedBy: 'current-user-id', // Would come from auth context
        lastModified: new Date()
      });
      loadRiskAssessment();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update recommendation'));
      console.error('Error updating recommendation:', err);
    }
  }, [athleteId, userAccessLevel, medicalService, loadRiskAssessment]);

  /**
   * Handles treatment plan updates with audit logging
   */
  const handleTreatmentPlanUpdate = useCallback(async (updates: any) => {
    if (userAccessLevel === AccessLevel.READ) {
      setError(new Error('Insufficient permissions to modify treatment plan'));
      return;
    }

    try {
      await medicalService.updateTreatmentPlan({
        ...updates,
        athleteId,
        modifiedBy: 'current-user-id', // Would come from auth context
        lastModified: new Date()
      });
      loadRiskAssessment();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update treatment plan'));
      console.error('Error updating treatment plan:', err);
    }
  }, [athleteId, userAccessLevel, medicalService, loadRiskAssessment]);

  // Set up real-time data subscription
  useEffect(() => {
    const setupRealTimeUpdates = async () => {
      try {
        // Subscribe to real-time biomechanical metrics
        const unsubscribe = await medicalService.subscribeSensorData(
          athleteId,
          async (metrics) => {
            await medicalService.processRealTimeMetrics(athleteId, metrics);
            loadRiskAssessment();
          },
          { priority: 'high' }
        );

        return () => {
          unsubscribe();
        };
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to setup real-time updates'));
        console.error('Error setting up real-time updates:', err);
      }
    };

    setupRealTimeUpdates();
  }, [athleteId, medicalService, loadRiskAssessment]);

  // Initial data load
  useEffect(() => {
    loadRiskAssessment();
  }, [loadRiskAssessment]);

  // Error handling
  if (error) {
    return (
      <div className="medical-page__error" role="alert">
        <h2>Error</h2>
        <p>{error.message}</p>
        <button onClick={loadRiskAssessment}>Retry</button>
      </div>
    );
  }

  return (
    <div className="medical-page">
      <header className="medical-page__header">
        <h1>Medical Dashboard</h1>
        <div className="medical-page__last-update">
          Last updated: {lastUpdate.toLocaleString()}
        </div>
      </header>

      <div className="medical-page__content">
        <section className="medical-page__risk-assessment">
          <h2>Injury Risk Assessment</h2>
          {isLoading ? (
            <div className="medical-page__loading">Loading risk assessment...</div>
          ) : (
            <InjuryRiskCard
              assessment={riskAssessment!}
              onRecommendationClick={handleRecommendationClick}
              refreshInterval={100} // Meet <100ms latency requirement
            />
          )}
        </section>

        <section className="medical-page__treatment">
          <h2>Treatment Plan</h2>
          <TreatmentPlan
            athleteId={athleteId}
            isEditable={userAccessLevel !== AccessLevel.READ}
            onUpdate={handleTreatmentPlanUpdate}
            userAccessLevel={userAccessLevel}
            encryptionKey={encryptionKey}
          />
        </section>

        <section className="medical-page__history">
          <h2>Medical History</h2>
          <MedicalHistory
            athleteId={athleteId}
            onError={setError}
            encryptionKey={encryptionKey}
            auditMetadata={{
              accessReason: 'medical_review',
              accessedBy: 'current-user-id', // Would come from auth context
              accessTimestamp: new Date(),
              encryptionVersion: '1.0'
            }}
          />
        </section>
      </div>
    </div>
  );
};

export default MedicalPage;