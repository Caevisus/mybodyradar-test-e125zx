/**
 * @fileoverview Redux slice for managing training session state with real-time monitoring
 * Implements comprehensive session lifecycle management and performance analytics
 * with WebSocket integration for live updates (<100ms latency)
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // v1.9.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

import { ISession, ISessionMetrics, ISessionConfig } from '../interfaces/session.interface';
import { SessionService } from '../services/session.service';

/**
 * Comprehensive session state interface with real-time monitoring capabilities
 */
interface SessionState {
  currentSession: ISession | null;
  isLoading: boolean;
  error: string | null;
  sessionMetrics: Record<string, ISessionMetrics>;
  realTimeMetrics: Record<string, number>;
  baselineComparisons: Record<string, {
    current: number;
    baseline: number;
  }>;
  performanceIndicators: Record<string, number>;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
}

/**
 * Initial state configuration with null values and empty collections
 */
const initialState: SessionState = {
  currentSession: null,
  isLoading: false,
  error: null,
  sessionMetrics: {},
  realTimeMetrics: {},
  baselineComparisons: {},
  performanceIndicators: {},
  connectionStatus: 'disconnected'
};

/**
 * Async thunk for initializing a new training session with real-time monitoring
 */
export const startSession = createAsyncThunk(
  'session/start',
  async ({ athleteId, config }: { athleteId: string; config: ISessionConfig }, { rejectWithValue }) => {
    try {
      const sessionService = new SessionService();
      const session = await sessionService.startSession(athleteId, config);
      return session;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

/**
 * Async thunk for gracefully terminating current session
 */
export const endSession = createAsyncThunk(
  'session/end',
  async (sessionId: string, { rejectWithValue }) => {
    try {
      const sessionService = new SessionService();
      await sessionService.endSession(sessionId);
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

/**
 * Session management slice with comprehensive real-time monitoring
 */
const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    /**
     * Updates real-time session metrics with baseline comparison
     */
    updateSessionMetrics(state, action: PayloadAction<{
      sessionId: string;
      metrics: ISessionMetrics;
    }>) {
      const { sessionId, metrics } = action.payload;
      state.sessionMetrics[sessionId] = metrics;

      // Update real-time metrics
      Object.entries(metrics.muscleActivity).forEach(([muscle, value]) => {
        state.realTimeMetrics[muscle] = value;
      });

      // Calculate baseline comparisons
      if (state.currentSession?.baselineData) {
        Object.entries(metrics.muscleActivity).forEach(([muscle, value]) => {
          const baseline = state.currentSession!.baselineData.muscleProfiles[muscle]?.current || 0;
          state.baselineComparisons[muscle] = {
            current: value,
            baseline
          };
        });
      }

      // Update performance indicators
      state.performanceIndicators = {
        ...state.performanceIndicators,
        averageForce: Object.values(metrics.forceDistribution).reduce((a, b) => a + b, 0) / 
          Object.values(metrics.forceDistribution).length,
        anomalyScore: Math.max(...Object.values(metrics.anomalyScores))
      };
    },

    /**
     * Updates WebSocket connection status
     */
    setConnectionStatus(state, action: PayloadAction<'connected' | 'disconnected' | 'reconnecting'>) {
      state.connectionStatus = action.payload;
    },

    /**
     * Clears current session state
     */
    clearSession(state) {
      state.currentSession = null;
      state.sessionMetrics = {};
      state.realTimeMetrics = {};
      state.baselineComparisons = {};
      state.performanceIndicators = {};
    },

    /**
     * Sets error state with message
     */
    setError(state, action: PayloadAction<string>) {
      state.error = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      // Start Session
      .addCase(startSession.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(startSession.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentSession = action.payload;
        state.connectionStatus = 'connected';
      })
      .addCase(startSession.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // End Session
      .addCase(endSession.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(endSession.fulfilled, (state) => {
        state.isLoading = false;
        state.currentSession = null;
        state.connectionStatus = 'disconnected';
      })
      .addCase(endSession.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  }
});

// Export actions and reducer
export const {
  updateSessionMetrics,
  setConnectionStatus,
  clearSession,
  setError
} = sessionSlice.actions;

export default sessionSlice.reducer;

// Memoized selectors
export const selectCurrentSession = (state: { session: SessionState }) => state.session.currentSession;
export const selectSessionMetrics = (state: { session: SessionState }) => state.session.sessionMetrics;
export const selectRealTimeMetrics = (state: { session: SessionState }) => state.session.realTimeMetrics;
export const selectBaselineComparisons = (state: { session: SessionState }) => state.session.baselineComparisons;
export const selectPerformanceIndicators = (state: { session: SessionState }) => state.session.performanceIndicators;
export const selectConnectionStatus = (state: { session: SessionState }) => state.session.connectionStatus;