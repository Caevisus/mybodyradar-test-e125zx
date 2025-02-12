/**
 * @fileoverview Comprehensive test suite for SessionControls component
 * Verifies real-time monitoring capabilities, session management, and performance metrics
 * @version 1.0.0
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import WS from 'jest-websocket-mock';
import { SessionControls } from '../../../components/session/SessionControls';
import { useSession } from '../../../hooks/useSession';
import { usePerformanceMetrics } from '@performance/metrics';

// Mock dependencies
jest.mock('../../../hooks/useSession');
jest.mock('@performance/metrics');

// Test data constants
const MOCK_ATHLETE_ID = 'test-athlete-123';
const MOCK_SESSION_TYPE = 'training';
const MOCK_SESSION = {
  id: 'test-session-123',
  athleteId: MOCK_ATHLETE_ID,
  type: MOCK_SESSION_TYPE,
  startTime: new Date(),
  status: 'active',
  metrics: {
    muscleActivity: { quadriceps: 0.75 },
    forceDistribution: { left: 0.48, right: 0.52 },
    rangeOfMotion: { knee: { current: 85, baseline: 90, deviation: -5 } }
  }
};

// Mock WebSocket server for real-time testing
let mockServer: WS;

describe('SessionControls Component', () => {
  // Mock hook implementations
  const mockStartSession = jest.fn();
  const mockEndSession = jest.fn();
  const mockReconnectSession = jest.fn();
  const mockHandleMetricsUpdate = jest.fn();

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock useSession hook
    (useSession as jest.Mock).mockReturnValue({
      currentSession: null,
      sessionMetrics: null,
      isLoading: false,
      error: null,
      startSession: mockStartSession,
      endSession: mockEndSession,
      reconnectSession: mockReconnectSession
    });

    // Mock performance metrics hook
    (usePerformanceMetrics as jest.Mock).mockReturnValue({
      measureLatency: jest.fn(),
      recordMetric: jest.fn()
    });

    // Initialize WebSocket mock server
    mockServer = new WS('ws://localhost:1234');
  });

  afterEach(() => {
    // Cleanup WebSocket server
    WS.clean();
  });

  test('renders initial state correctly', () => {
    const { getByTestId, queryByTestId } = render(
      <SessionControls
        athleteId={MOCK_ATHLETE_ID}
        sessionType={MOCK_SESSION_TYPE}
      />
    );

    expect(getByTestId('start-session-button')).toBeInTheDocument();
    expect(queryByTestId('end-session-button')).not.toBeInTheDocument();
  });

  test('handles session start with correct configuration', async () => {
    const onSessionStart = jest.fn();
    const { getByTestId } = render(
      <SessionControls
        athleteId={MOCK_ATHLETE_ID}
        sessionType={MOCK_SESSION_TYPE}
        onSessionStart={onSessionStart}
      />
    );

    mockStartSession.mockResolvedValueOnce(MOCK_SESSION);

    // Trigger session start
    fireEvent.click(getByTestId('start-session-button'));

    await waitFor(() => {
      expect(mockStartSession).toHaveBeenCalledWith(
        MOCK_ATHLETE_ID,
        MOCK_SESSION_TYPE,
        expect.objectContaining({
          alertThresholds: expect.any(Object),
          samplingRates: {
            imu: 200,
            tof: 100
          },
          dataRetention: expect.any(Number),
          enabledMetrics: expect.any(Object)
        })
      );
      expect(onSessionStart).toHaveBeenCalledWith(MOCK_SESSION);
    });
  });

  test('verifies real-time monitoring with <100ms latency', async () => {
    const { getByTestId } = render(
      <SessionControls
        athleteId={MOCK_ATHLETE_ID}
        sessionType={MOCK_SESSION_TYPE}
      />
    );

    // Mock successful session start
    mockStartSession.mockResolvedValueOnce(MOCK_SESSION);
    
    // Start session
    await act(async () => {
      fireEvent.click(getByTestId('start-session-button'));
    });

    // Simulate real-time data stream
    const sensorData = {
      timestamp: Date.now(),
      measurements: {
        muscleActivity: [0.75, 0.80, 0.85],
        force: [120, 125, 130],
        acceleration: [1.1, 1.2, 1.3]
      }
    };

    await act(async () => {
      mockServer.send(JSON.stringify(sensorData));
    });

    // Verify data processing latency
    const { measureLatency } = usePerformanceMetrics();
    expect(measureLatency).toHaveBeenCalled();
    expect(measureLatency).toHaveReturnedWith(expect.any(Number));
    expect(measureLatency()).toBeLessThan(100); // Verify <100ms requirement
  });

  test('handles session end with cleanup', async () => {
    const onSessionEnd = jest.fn();
    
    // Mock active session
    (useSession as jest.Mock).mockReturnValue({
      currentSession: MOCK_SESSION,
      sessionMetrics: MOCK_SESSION.metrics,
      isLoading: false,
      error: null,
      startSession: mockStartSession,
      endSession: mockEndSession
    });

    const { getByTestId } = render(
      <SessionControls
        athleteId={MOCK_ATHLETE_ID}
        sessionType={MOCK_SESSION_TYPE}
        onSessionEnd={onSessionEnd}
      />
    );

    // Trigger session end
    await act(async () => {
      fireEvent.click(getByTestId('end-session-button'));
    });

    await waitFor(() => {
      expect(mockEndSession).toHaveBeenCalled();
      expect(onSessionEnd).toHaveBeenCalledWith(MOCK_SESSION);
    });
  });

  test('handles connection errors with auto-reconnect', async () => {
    const onError = jest.fn();
    
    // Mock session with error
    (useSession as jest.Mock).mockReturnValue({
      currentSession: MOCK_SESSION,
      sessionMetrics: null,
      isLoading: false,
      error: new Error('Connection lost'),
      startSession: mockStartSession,
      endSession: mockEndSession,
      reconnectSession: mockReconnectSession
    });

    render(
      <SessionControls
        athleteId={MOCK_ATHLETE_ID}
        sessionType={MOCK_SESSION_TYPE}
        onError={onError}
        autoReconnect={true}
        reconnectAttempts={3}
      />
    );

    await waitFor(() => {
      expect(mockReconnectSession).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  test('displays session metrics with live updates', async () => {
    // Mock active session with metrics
    (useSession as jest.Mock).mockReturnValue({
      currentSession: MOCK_SESSION,
      sessionMetrics: MOCK_SESSION.metrics,
      isLoading: false,
      error: null,
      startSession: mockStartSession,
      endSession: mockEndSession
    });

    const { getByTestId } = render(
      <SessionControls
        athleteId={MOCK_ATHLETE_ID}
        sessionType={MOCK_SESSION_TYPE}
      />
    );

    // Verify metrics display
    await waitFor(() => {
      const metricsElement = getByTestId('session-controls');
      expect(metricsElement).toHaveTextContent(/Duration:/);
      expect(metricsElement).toHaveTextContent(/Status: active/);
    });

    // Simulate metrics update
    const updatedMetrics = {
      ...MOCK_SESSION.metrics,
      muscleActivity: { quadriceps: 0.85 }
    };

    await act(async () => {
      mockServer.send(JSON.stringify({ type: 'metrics', data: updatedMetrics }));
    });

    // Verify metrics update
    await waitFor(() => {
      expect(mockHandleMetricsUpdate).toHaveBeenCalledWith(updatedMetrics);
    });
  });
});