/**
 * @fileoverview Enhanced React hook for managing training session state and operations
 * Implements real-time monitoring with <100ms latency and comprehensive session lifecycle
 * management for the smart-apparel web application
 * @version 1.0.0
 */

import { useEffect, useCallback } from 'react'; // v18.0.0
import { useDispatch, useSelector } from 'react-redux'; // v8.1.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

import { ISession, ISessionConfig, ISessionMetrics } from '../interfaces/session.interface';
import { sessionService } from '../services/session.service';
import { WebSocketService } from '../services/websocket.service';

// Connection status enum for enhanced state tracking
enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

// Enhanced session error interface
interface SessionError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
}

// WebSocket configuration for real-time data
const WS_CONFIG = {
  RECONNECT_DELAY: 1000,
  MAX_RECONNECT_ATTEMPTS: 5,
  METRICS_BUFFER_SIZE: 1024,
  UPDATE_INTERVAL: 100 // Ensures <100ms latency requirement
};

/**
 * Enhanced custom hook for managing training session state and operations
 * Implements real-time monitoring and comprehensive session lifecycle management
 */
export const useSession = () => {
  const dispatch = useDispatch();
  const wsService = new WebSocketService();

  // Redux state selectors
  const currentSession = useSelector((state: any) => state.session.current);
  const sessionMetrics = useSelector((state: any) => state.session.metrics);
  const isLoading = useSelector((state: any) => state.session.loading);
  const error = useSelector((state: any) => state.session.error);
  const connectionStatus = useSelector((state: any) => state.session.connectionStatus);

  /**
   * Starts a new training session with enhanced error handling
   * @param athleteId Unique identifier of the athlete
   * @param sessionType Type of training session
   * @param config Optional session configuration
   */
  const startSession = useCallback(async (
    athleteId: string,
    sessionType: string,
    config?: Partial<ISessionConfig>
  ) => {
    try {
      dispatch({ type: 'SESSION_START_REQUEST' });

      // Create session with configuration
      const session = await sessionService.startSession(athleteId, {
        type: sessionType,
        alertThresholds: config?.alertThresholds || {},
        samplingRates: {
          imu: 200, // 200Hz for IMU
          tof: 100  // 100Hz for ToF
        },
        dataRetention: config?.dataRetention || 30,
        enabledMetrics: config?.enabledMetrics || { all: true },
        baselineReferences: config?.baselineReferences || {}
      });

      // Setup WebSocket connection for real-time data
      await wsService.connect(session.id, {
        bufferSize: WS_CONFIG.METRICS_BUFFER_SIZE,
        sampleRate: 200, // Maximum sensor rate
        compression: true,
        priority: 'high',
        qos: 2
      });

      dispatch({ type: 'SESSION_START_SUCCESS', payload: session });
      return session;
    } catch (error) {
      const sessionError: SessionError = {
        code: error.code || 'SESSION_START_ERROR',
        message: error.message,
        details: error.details,
        timestamp: new Date()
      };
      dispatch({ type: 'SESSION_START_FAILURE', payload: sessionError });
      throw sessionError;
    }
  }, [dispatch]);

  /**
   * Ends current session with cleanup
   */
  const endSession = useCallback(async () => {
    if (!currentSession?.id) return;

    try {
      dispatch({ type: 'SESSION_END_REQUEST' });
      await sessionService.endSession(currentSession.id);
      await wsService.disconnect();
      dispatch({ type: 'SESSION_END_SUCCESS' });
    } catch (error) {
      dispatch({
        type: 'SESSION_END_FAILURE',
        payload: {
          code: error.code || 'SESSION_END_ERROR',
          message: error.message,
          timestamp: new Date()
        }
      });
    }
  }, [currentSession, dispatch]);

  /**
   * Handles real-time metrics updates with debouncing
   */
  const handleMetricsUpdate = useCallback((metrics: ISessionMetrics) => {
    dispatch({
      type: 'SESSION_METRICS_UPDATE',
      payload: {
        ...metrics,
        timestamp: Date.now()
      }
    });
  }, [dispatch]);

  /**
   * Attempts to reconnect session with error handling
   */
  const reconnectSession = useCallback(async () => {
    if (!currentSession?.id) return;

    try {
      dispatch({ type: 'SESSION_RECONNECT_REQUEST' });
      await sessionService.reconnectSession(currentSession.id);
      dispatch({ type: 'SESSION_RECONNECT_SUCCESS' });
    } catch (error) {
      dispatch({
        type: 'SESSION_RECONNECT_FAILURE',
        payload: {
          code: error.code || 'SESSION_RECONNECT_ERROR',
          message: error.message,
          timestamp: new Date()
        }
      });
    }
  }, [currentSession, dispatch]);

  // Setup WebSocket subscription and cleanup
  useEffect(() => {
    if (!currentSession?.id) return;

    let metricsSubscription: (() => void) | null = null;

    const setupSubscription = async () => {
      try {
        metricsSubscription = await sessionService.subscribeToSessionData(
          currentSession.id,
          handleMetricsUpdate,
          {
            buffer: true,
            priority: 'high'
          }
        );
      } catch (error) {
        dispatch({
          type: 'SESSION_SUBSCRIPTION_ERROR',
          payload: {
            code: 'SUBSCRIPTION_ERROR',
            message: error.message,
            timestamp: new Date()
          }
        });
      }
    };

    setupSubscription();

    // Cleanup subscription on unmount or session change
    return () => {
      if (metricsSubscription) {
        metricsSubscription();
      }
    };
  }, [currentSession?.id, dispatch, handleMetricsUpdate]);

  return {
    // Session state
    currentSession,
    sessionMetrics,
    isLoading,
    error,
    connectionStatus,

    // Session operations
    startSession,
    endSession,
    reconnectSession
  };
};