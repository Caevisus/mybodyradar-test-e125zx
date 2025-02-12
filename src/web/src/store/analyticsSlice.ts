/**
 * @fileoverview Redux Toolkit slice for managing analytics state in the smart-apparel system
 * Implements real-time sensor data processing, metrics calculation, and visualization
 * with <100ms latency requirement.
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { ISensorData } from '../interfaces/sensor.interface';
import { ISessionMetrics } from '../interfaces/session.interface';
import { AnalyticsService } from '../services/analytics.service';

// Initialize analytics service
const analyticsService = new AnalyticsService();

/**
 * Interface for analytics state
 */
interface AnalyticsState {
  metrics: ISessionMetrics;
  heatMapData: Record<string, number>;
  anomalyScores: Record<string, number>;
  isProcessing: boolean;
  error: string | null;
  processingTimestamp: number;
  calibrationStatus: {
    isCalibrated: boolean;
    lastCalibration: number;
  };
  errorDetails: {
    code: string;
    message: string;
    timestamp: number;
  }[];
  processingQueue: Array<{
    id: string;
    data: ISensorData;
    timestamp: number;
  }>;
}

/**
 * Initial state for analytics slice
 */
const initialState: AnalyticsState = {
  metrics: {
    muscleActivity: {},
    forceDistribution: {},
    rangeOfMotion: {},
    anomalyScores: {},
    alertTriggers: {}
  },
  heatMapData: {},
  anomalyScores: {},
  isProcessing: false,
  error: null,
  processingTimestamp: 0,
  calibrationStatus: {
    isCalibrated: false,
    lastCalibration: 0
  },
  errorDetails: [],
  processingQueue: []
};

/**
 * Async thunk for processing real-time sensor data stream
 * Implements <100ms latency requirement
 */
export const processDataStream = createAsyncThunk(
  'analytics/processDataStream',
  async (data: ISensorData, { rejectWithValue }) => {
    try {
      const startTime = performance.now();

      // Process sensor data stream
      await analyticsService.processDataStream(data);

      // Generate heat map visualization
      const heatMapData = await analyticsService.generateHeatMap(data);

      // Detect anomalies in processed data
      const anomalyScores = await analyticsService.detectAnomalies({
        muscleActivity: {},
        forceDistribution: {},
        rangeOfMotion: {},
        anomalyScores: {},
        alertTriggers: {}
      });

      const processingTime = performance.now() - startTime;
      if (processingTime > 100) {
        console.warn(`Processing exceeded latency threshold: ${processingTime}ms`);
      }

      return {
        heatMapData,
        anomalyScores,
        processingTime
      };
    } catch (error) {
      return rejectWithValue({
        code: 'PROCESSING_ERROR',
        message: error.message,
        timestamp: Date.now()
      });
    }
  }
);

/**
 * Analytics slice definition with reducers and actions
 */
const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    resetAnalytics: (state) => {
      Object.assign(state, initialState);
    },
    updateCalibration: (state, action: PayloadAction<boolean>) => {
      state.calibrationStatus = {
        isCalibrated: action.payload,
        lastCalibration: Date.now()
      };
    },
    clearErrors: (state) => {
      state.error = null;
      state.errorDetails = [];
    },
    updateMetrics: (state, action: PayloadAction<Partial<ISessionMetrics>>) => {
      state.metrics = {
        ...state.metrics,
        ...action.payload
      };
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(processDataStream.pending, (state) => {
        state.isProcessing = true;
        state.processingTimestamp = Date.now();
      })
      .addCase(processDataStream.fulfilled, (state, action) => {
        state.isProcessing = false;
        state.heatMapData = action.payload.heatMapData;
        state.anomalyScores = action.payload.anomalyScores;
        state.processingTimestamp = Date.now();
      })
      .addCase(processDataStream.rejected, (state, action) => {
        state.isProcessing = false;
        state.error = 'Data processing failed';
        state.errorDetails.push(action.payload as any);
      });
  }
});

// Export actions
export const {
  resetAnalytics,
  updateCalibration,
  clearErrors,
  updateMetrics
} = analyticsSlice.actions;

// Memoized selectors
export const selectMetrics = (state: { analytics: AnalyticsState }) => state.analytics.metrics;
export const selectHeatMapData = (state: { analytics: AnalyticsState }) => state.analytics.heatMapData;
export const selectAnomalyScores = (state: { analytics: AnalyticsState }) => state.analytics.anomalyScores;
export const selectProcessingStatus = (state: { analytics: AnalyticsState }) => ({
  isProcessing: state.analytics.isProcessing,
  timestamp: state.analytics.processingTimestamp
});
export const selectCalibrationStatus = (state: { analytics: AnalyticsState }) => state.analytics.calibrationStatus;

// Export reducer
export default analyticsSlice.reducer;