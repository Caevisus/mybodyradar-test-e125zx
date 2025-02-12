import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0
import { useEncryption } from '@medical/encryption'; // v1.0.0
import { useAuditLog } from '@medical/audit-logging'; // v1.0.0

import { ITreatmentPlan } from '../../interfaces/medical.interface';
import { MedicalService } from '../../services/medical.service';

// Access level enumeration for medical staff
enum AccessLevel {
  READ = 'read',
  WRITE = 'write',
  ADMIN = 'admin'
}

interface TreatmentPlanProps {
  athleteId: string;
  isEditable: boolean;
  onUpdate?: () => void;
  userAccessLevel: AccessLevel;
  encryptionKey: string;
}

/**
 * TreatmentPlan component for secure medical data management
 * Implements HIPAA compliance and real-time updates
 */
const TreatmentPlan: React.FC<TreatmentPlanProps> = ({
  athleteId,
  isEditable,
  onUpdate,
  userAccessLevel,
  encryptionKey
}) => {
  // State management
  const [treatmentPlan, setTreatmentPlan] = useState<ITreatmentPlan | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Service instances
  const medicalService = useRef(new MedicalService());
  const { encrypt, decrypt } = useEncryption(encryptionKey);
  const { logAccess, logModification } = useAuditLog();

  // WebSocket connection for real-time updates
  const wsRef = useRef<WebSocket | null>(null);

  /**
   * Fetches and decrypts treatment plan data
   */
  const fetchTreatmentPlan = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await medicalService.current.getTreatmentPlan(athleteId);
      
      // Decrypt sensitive fields
      const decryptedPlan = {
        ...response.data,
        diagnosis: await decrypt(response.data.diagnosis),
        recommendations: await Promise.all(
          response.data.recommendations.map(decrypt)
        ),
        restrictions: await Promise.all(
          response.data.restrictions.map(decrypt)
        )
      };

      setTreatmentPlan(decryptedPlan);
      await logAccess({
        resourceType: 'treatment_plan',
        resourceId: decryptedPlan.id,
        action: 'view'
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch treatment plan'));
      console.error('Error fetching treatment plan:', err);
    } finally {
      setIsLoading(false);
    }
  }, [athleteId, decrypt, logAccess]);

  /**
   * Handles secure updates to treatment plan
   */
  const handleUpdatePlan = useCallback(async (updates: Partial<ITreatmentPlan>) => {
    if (userAccessLevel !== AccessLevel.WRITE && userAccessLevel !== AccessLevel.ADMIN) {
      setError(new Error('Insufficient permissions to modify treatment plan'));
      return;
    }

    try {
      // Encrypt sensitive fields before update
      const encryptedUpdates = {
        ...updates,
        diagnosis: updates.diagnosis ? await encrypt(updates.diagnosis) : undefined,
        recommendations: updates.recommendations 
          ? await Promise.all(updates.recommendations.map(encrypt))
          : undefined,
        restrictions: updates.restrictions
          ? await Promise.all(updates.restrictions.map(encrypt))
          : undefined
      };

      // Optimistic update
      setTreatmentPlan(prev => prev ? { ...prev, ...updates } : null);

      await medicalService.current.updateTreatmentPlan({
        ...encryptedUpdates,
        athleteId,
        modifiedBy: 'current-user-id', // Would come from auth context
        lastModified: new Date()
      });

      await logModification({
        resourceType: 'treatment_plan',
        resourceId: treatmentPlan?.id,
        action: 'modify',
        changes: updates
      });

      onUpdate?.();
      setIsEditing(false);
    } catch (err) {
      // Rollback on failure
      await fetchTreatmentPlan();
      setError(err instanceof Error ? err : new Error('Failed to update treatment plan'));
      console.error('Error updating treatment plan:', err);
    }
  }, [athleteId, encrypt, logModification, onUpdate, treatmentPlan?.id, userAccessLevel]);

  /**
   * Sets up real-time updates subscription
   */
  useEffect(() => {
    const setupWebSocket = async () => {
      const cleanup = await medicalService.current.subscribeToPlanUpdates(
        athleteId,
        async (updatedPlan) => {
          // Decrypt incoming real-time updates
          const decryptedPlan = {
            ...updatedPlan,
            diagnosis: await decrypt(updatedPlan.diagnosis),
            recommendations: await Promise.all(
              updatedPlan.recommendations.map(decrypt)
            ),
            restrictions: await Promise.all(
              updatedPlan.restrictions.map(decrypt)
            )
          };
          setTreatmentPlan(decryptedPlan);
        }
      );

      return cleanup;
    };

    setupWebSocket();

    return () => {
      wsRef.current?.close();
    };
  }, [athleteId, decrypt]);

  // Initial data fetch
  useEffect(() => {
    fetchTreatmentPlan();
  }, [fetchTreatmentPlan]);

  if (isLoading) {
    return <div className="treatment-plan-loading">Loading treatment plan...</div>;
  }

  if (error) {
    return (
      <div className="treatment-plan-error">
        Error: {error.message}
        <button onClick={fetchTreatmentPlan}>Retry</button>
      </div>
    );
  }

  if (!treatmentPlan) {
    return <div className="treatment-plan-empty">No treatment plan found</div>;
  }

  return (
    <ErrorBoundary
      fallbackRender={({ error }) => (
        <div className="treatment-plan-error">
          An error occurred: {error.message}
        </div>
      )}
    >
      <div className="treatment-plan-container">
        <div className="treatment-plan-header">
          <h2>Treatment Plan</h2>
          {isEditable && userAccessLevel !== AccessLevel.READ && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="edit-button"
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
          )}
        </div>

        <div className="treatment-plan-content">
          <div className="treatment-plan-section">
            <h3>Diagnosis</h3>
            {isEditing ? (
              <textarea
                value={treatmentPlan.diagnosis}
                onChange={(e) => handleUpdatePlan({ diagnosis: e.target.value })}
                className="diagnosis-input"
              />
            ) : (
              <p>{treatmentPlan.diagnosis}</p>
            )}
          </div>

          <div className="treatment-plan-section">
            <h3>Recommendations</h3>
            {isEditing ? (
              <ul>
                {treatmentPlan.recommendations.map((rec, index) => (
                  <li key={index}>
                    <input
                      value={rec}
                      onChange={(e) => {
                        const newRecs = [...treatmentPlan.recommendations];
                        newRecs[index] = e.target.value;
                        handleUpdatePlan({ recommendations: newRecs });
                      }}
                    />
                  </li>
                ))}
                <button
                  onClick={() => handleUpdatePlan({
                    recommendations: [...treatmentPlan.recommendations, '']
                  })}
                >
                  Add Recommendation
                </button>
              </ul>
            ) : (
              <ul>
                {treatmentPlan.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="treatment-plan-section">
            <h3>Restrictions</h3>
            {isEditing ? (
              <ul>
                {treatmentPlan.restrictions.map((restriction, index) => (
                  <li key={index}>
                    <input
                      value={restriction}
                      onChange={(e) => {
                        const newRestrictions = [...treatmentPlan.restrictions];
                        newRestrictions[index] = e.target.value;
                        handleUpdatePlan({ restrictions: newRestrictions });
                      }}
                    />
                  </li>
                ))}
                <button
                  onClick={() => handleUpdatePlan({
                    restrictions: [...treatmentPlan.restrictions, '']
                  })}
                >
                  Add Restriction
                </button>
              </ul>
            ) : (
              <ul>
                {treatmentPlan.restrictions.map((restriction, index) => (
                  <li key={index}>{restriction}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="treatment-plan-footer">
            <p>Last modified: {new Date(treatmentPlan.lastModified).toLocaleString()}</p>
            <p>Status: {treatmentPlan.status}</p>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default TreatmentPlan;