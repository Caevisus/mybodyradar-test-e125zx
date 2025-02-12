/**
 * @fileoverview Quick Actions Dashboard Component
 * Implements Material Design 3.0 quick access buttons for common actions
 * with comprehensive error handling and responsive layout
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom'; // v6.0.0
import Button from '../common/Button';
import { useSession } from '../../hooks/useSession';
import { useSensor } from '../../hooks/useSensor';
import type { CSSProperties } from 'react';

/**
 * Props interface for QuickActions component
 */
interface QuickActionsProps {
  className?: string;
  style?: CSSProperties;
  disableActions?: boolean;
  onActionComplete?: () => void;
}

/**
 * QuickActions component providing rapid access to core system functionalities
 */
export const QuickActions: React.FC<QuickActionsProps> = ({
  className,
  style,
  disableActions = false,
  onActionComplete
}) => {
  const navigate = useNavigate();
  const [isCalibrating, setIsCalibrating] = useState(false);
  
  // Session management hooks
  const { 
    startSession, 
    endSession, 
    currentSession, 
    isLoading: sessionLoading,
    error: sessionError 
  } = useSession();

  // Sensor management hooks
  const { 
    calibrateSensor,
    sensorStatus,
    sensorErrors
  } = useSensor({
    id: 'primary-sensor',
    type: 'imu',
    samplingRate: 200,
    bufferSize: 1024,
    calibrationParams: {
      tofGain: 8,
      imuDriftCorrection: 0.5,
      pressureThreshold: 1.0,
      sampleWindow: 100,
      filterCutoff: 2
    }
  });

  /**
   * Handles session start with error handling and validation
   */
  const handleStartSession = useCallback(async () => {
    if (currentSession || sessionLoading || disableActions) return;

    try {
      await startSession('default-athlete', 'training', {
        alertThresholds: {
          muscleLoad: 85,
          impactForce: 1000
        },
        dataRetention: 30,
        enabledMetrics: { all: true }
      });
      onActionComplete?.();
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  }, [currentSession, sessionLoading, disableActions, startSession, onActionComplete]);

  /**
   * Handles session end with data preservation
   */
  const handleEndSession = useCallback(async () => {
    if (!currentSession || sessionLoading || disableActions) return;

    try {
      await endSession();
      onActionComplete?.();
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  }, [currentSession, sessionLoading, disableActions, endSession, onActionComplete]);

  /**
   * Handles sensor calibration with progress tracking
   */
  const handleCalibrateSensors = useCallback(async () => {
    if (isCalibrating || disableActions) return;

    try {
      setIsCalibrating(true);
      await calibrateSensor('primary-sensor', {
        tofGain: 8,
        imuDriftCorrection: 0.5,
        pressureThreshold: 1.0,
        sampleWindow: 100,
        filterCutoff: 2
      });
      onActionComplete?.();
    } catch (error) {
      console.error('Calibration failed:', error);
    } finally {
      setIsCalibrating(false);
    }
  }, [isCalibrating, disableActions, calibrateSensor, onActionComplete]);

  /**
   * Navigates to alerts view
   */
  const handleViewAlerts = useCallback(() => {
    navigate('/alerts');
  }, [navigate]);

  return (
    <div 
      className={`quick-actions ${className || ''}`}
      style={{
        display: 'grid',
        gap: '1rem',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        padding: '1rem',
        ...style
      }}
    >
      <Button
        variant="contained"
        color="primary"
        size="large"
        onClick={handleStartSession}
        disabled={!!currentSession || sessionLoading || disableActions}
        isLoading={sessionLoading}
        fullWidth
        ariaLabel="Start Training Session"
      >
        Start Session
      </Button>

      <Button
        variant="contained"
        color="error"
        size="large"
        onClick={handleEndSession}
        disabled={!currentSession || sessionLoading || disableActions}
        isLoading={sessionLoading}
        fullWidth
        ariaLabel="End Training Session"
      >
        End Session
      </Button>

      <Button
        variant="outlined"
        color="secondary"
        size="large"
        onClick={handleCalibrateSensors}
        disabled={isCalibrating || disableActions}
        isLoading={isCalibrating}
        fullWidth
        ariaLabel="Calibrate Sensors"
      >
        Calibrate Sensors
      </Button>

      <Button
        variant="outlined"
        color="info"
        size="large"
        onClick={handleViewAlerts}
        disabled={disableActions}
        fullWidth
        ariaLabel="View System Alerts"
      >
        View Alerts
      </Button>

      {/* Error display section */}
      {(sessionError || sensorErrors.size > 0) && (
        <div 
          className="quick-actions__errors"
          style={{
            gridColumn: '1 / -1',
            padding: '1rem',
            backgroundColor: 'rgba(211, 47, 47, 0.1)',
            borderRadius: '4px',
            marginTop: '1rem'
          }}
        >
          {sessionError && (
            <p className="quick-actions__error-text">
              Session Error: {sessionError.message}
            </p>
          )}
          {Array.from(sensorErrors.entries()).map(([sensorId, error]) => (
            <p key={sensorId} className="quick-actions__error-text">
              Sensor Error ({sensorId}): {error.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuickActions;