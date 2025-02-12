/**
 * @fileoverview Enhanced session control component providing comprehensive training session lifecycle management
 * Implements real-time monitoring with <100ms latency and robust error handling
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../common/Button';
import { useSession } from '../../hooks/useSession';
import type { ISession } from '../../interfaces/session.interface';

/**
 * Props interface for SessionControls component with enhanced functionality
 */
interface SessionControlsProps {
  athleteId: string;
  sessionType: string;
  onSessionStart?: (session: ISession) => void;
  onSessionPause?: () => void;
  onSessionResume?: () => void;
  onSessionEnd?: (sessionData: ISession) => void;
  onError?: (error: Error) => void;
  autoReconnect?: boolean;
  reconnectAttempts?: number;
}

/**
 * Enhanced session control component with comprehensive session lifecycle management
 */
export const SessionControls: React.FC<SessionControlsProps> = ({
  athleteId,
  sessionType,
  onSessionStart,
  onSessionPause,
  onSessionResume,
  onSessionEnd,
  onError,
  autoReconnect = true,
  reconnectAttempts = 3
}) => {
  // Session management hook
  const {
    currentSession,
    sessionMetrics,
    isLoading,
    error,
    startSession,
    endSession,
    reconnectSession
  } = useSession();

  // Local state for enhanced UI control
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);

  /**
   * Handles session start with comprehensive error handling
   */
  const handleStartSession = useCallback(async () => {
    if (!athleteId || !sessionType) {
      onError?.(new Error('Invalid session parameters'));
      return;
    }

    setIsStarting(true);
    try {
      const session = await startSession(athleteId, sessionType, {
        alertThresholds: {
          muscleLoad: 85,
          impactForce: 95,
          rangeOfMotion: 80
        },
        samplingRates: {
          imu: 200, // 200Hz for IMU
          tof: 100  // 100Hz for ToF
        },
        dataRetention: 30,
        enabledMetrics: {
          muscleActivity: true,
          forceDistribution: true,
          rangeOfMotion: true,
          anomalyDetection: true
        }
      });

      onSessionStart?.(session);
    } catch (error) {
      console.error('Failed to start session:', error);
      onError?.(error as Error);
    } finally {
      setIsStarting(false);
    }
  }, [athleteId, sessionType, startSession, onSessionStart, onError]);

  /**
   * Handles session end with data persistence and cleanup
   */
  const handleEndSession = useCallback(async () => {
    if (!currentSession?.id) {
      onError?.(new Error('No active session'));
      return;
    }

    setIsEnding(true);
    try {
      await endSession();
      onSessionEnd?.(currentSession);
    } catch (error) {
      console.error('Failed to end session:', error);
      onError?.(error as Error);
    } finally {
      setIsEnding(false);
    }
  }, [currentSession, endSession, onSessionEnd, onError]);

  /**
   * Handles automatic session reconnection
   */
  useEffect(() => {
    if (!autoReconnect || !currentSession || !error) return;

    if (reconnectCount < reconnectAttempts) {
      const timer = setTimeout(() => {
        setReconnectCount(prev => prev + 1);
        reconnectSession().catch(error => {
          console.error('Reconnection failed:', error);
          onError?.(error);
        });
      }, 1000 * (reconnectCount + 1));

      return () => clearTimeout(timer);
    }
  }, [autoReconnect, currentSession, error, reconnectCount, reconnectAttempts, reconnectSession, onError]);

  /**
   * Reset reconnect count when session changes or error resolves
   */
  useEffect(() => {
    if (!error) {
      setReconnectCount(0);
    }
  }, [error]);

  return (
    <div className="session-controls" data-testid="session-controls">
      {!currentSession ? (
        <Button
          variant="contained"
          color="primary"
          onClick={handleStartSession}
          isLoading={isStarting}
          disabled={isStarting || !athleteId}
          ariaLabel="Start training session"
          testId="start-session-button"
        >
          Start Session
        </Button>
      ) : (
        <Button
          variant="outlined"
          color="error"
          onClick={handleEndSession}
          isLoading={isEnding}
          disabled={isEnding}
          ariaLabel="End training session"
          testId="end-session-button"
        >
          End Session
        </Button>
      )}

      {error && (
        <div className="session-controls__error" role="alert">
          <span className="session-controls__error-message">
            {error.message}
          </span>
          {autoReconnect && reconnectCount < reconnectAttempts && (
            <span className="session-controls__reconnect-status">
              Reconnecting... ({reconnectCount + 1}/{reconnectAttempts})
            </span>
          )}
        </div>
      )}

      {currentSession && sessionMetrics && (
        <div className="session-controls__metrics" aria-live="polite">
          <span className="session-controls__duration">
            Duration: {formatDuration(Date.now() - currentSession.startTime.getTime())}
          </span>
          <span className="session-controls__status">
            Status: {currentSession.status}
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * Formats duration in milliseconds to human-readable string
 */
const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
};

export default SessionControls;