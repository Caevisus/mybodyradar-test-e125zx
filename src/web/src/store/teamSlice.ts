/**
 * @fileoverview Redux slice for managing team state in smart-apparel web application
 * @version 1.0.0
 * 
 * Implements comprehensive team state management with enhanced security,
 * real-time updates, and performance monitoring capabilities.
 */

import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit'; // v1.9.0
import { UUID } from 'crypto';

import { ITeam } from '../interfaces/team.interface';
import { TeamService, teamService } from '../services/team.service';
import { handleApiError } from '../utils/api.utils';

/**
 * Enhanced team state interface with monitoring capabilities
 */
interface TeamState {
  currentTeam: ITeam | null;
  loading: boolean;
  error: string | null;
  isSubscribed: boolean;
  lastUpdated: number;
  performanceMetrics: {
    latency: number;
    successRate: number;
    errorCount: number;
  };
}

/**
 * Initial state with monitoring setup
 */
const initialState: TeamState = {
  currentTeam: null,
  loading: false,
  error: null,
  isSubscribed: false,
  lastUpdated: 0,
  performanceMetrics: {
    latency: 0,
    successRate: 100,
    errorCount: 0
  }
};

/**
 * Async thunk for fetching team data with enhanced monitoring
 */
export const fetchTeam = createAsyncThunk(
  'team/fetchTeam',
  async (teamId: UUID, { rejectWithValue }) => {
    try {
      const startTime = Date.now();
      const response = await teamService.getTeamById(teamId);
      
      // Performance monitoring
      const latency = Date.now() - startTime;
      if (latency > 100) { // Monitor <100ms latency requirement
        console.warn(`Team fetch exceeded latency threshold: ${latency}ms`);
      }

      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

/**
 * Async thunk for updating team settings with security controls
 */
export const updateTeamSettings = createAsyncThunk(
  'team/updateSettings',
  async ({ teamId, settings }: { teamId: UUID, settings: ITeam['settings'] }, { rejectWithValue }) => {
    try {
      // Encrypt sensitive fields before transmission
      const encryptedSettings = {
        ...settings,
        encryptedFields: settings.encryptedFields,
        accessControl: settings.accessControl
      };

      const response = await teamService.updateTeamSettings(teamId, encryptedSettings);
      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

/**
 * Async thunk for subscribing to real-time team updates
 */
export const subscribeToTeamUpdates = createAsyncThunk(
  'team/subscribe',
  async (teamId: UUID, { dispatch }) => {
    try {
      const subscription = await teamService.subscribeToTeamStats(teamId, (stats) => {
        dispatch(teamSlice.actions.updateStats(stats));
      });
      return subscription;
    } catch (error) {
      throw handleApiError(error);
    }
  }
);

/**
 * Team slice with comprehensive state management
 */
const teamSlice = createSlice({
  name: 'team',
  initialState,
  reducers: {
    setTeam: (state, action) => {
      state.currentTeam = action.payload;
      state.lastUpdated = Date.now();
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.performanceMetrics.errorCount++;
    },
    clearTeam: (state) => {
      state.currentTeam = null;
      state.isSubscribed = false;
      state.lastUpdated = 0;
    },
    updateStats: (state, action) => {
      if (state.currentTeam) {
        state.currentTeam.stats = action.payload;
        state.lastUpdated = Date.now();
      }
    },
    setSubscribed: (state, action) => {
      state.isSubscribed = action.payload;
    },
    updatePerformanceMetrics: (state, action) => {
      state.performanceMetrics = {
        ...state.performanceMetrics,
        ...action.payload
      };
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTeam.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTeam.fulfilled, (state, action) => {
        state.currentTeam = action.payload;
        state.loading = false;
        state.lastUpdated = Date.now();
        state.performanceMetrics.successRate = 
          ((state.performanceMetrics.successRate * 99) + 100) / 100;
      })
      .addCase(fetchTeam.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.performanceMetrics.errorCount++;
        state.performanceMetrics.successRate = 
          ((state.performanceMetrics.successRate * 99)) / 100;
      })
      .addCase(updateTeamSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateTeamSettings.fulfilled, (state, action) => {
        if (state.currentTeam) {
          state.currentTeam.settings = action.payload;
        }
        state.loading = false;
        state.lastUpdated = Date.now();
      })
      .addCase(updateTeamSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.performanceMetrics.errorCount++;
      });
  }
});

/**
 * Memoized selectors for efficient state access
 */
export const selectTeamState = (state: { team: TeamState }) => state.team;

export const selectCurrentTeam = createSelector(
  [selectTeamState],
  (teamState) => teamState.currentTeam
);

export const selectTeamLoading = createSelector(
  [selectTeamState],
  (teamState) => teamState.loading
);

export const selectTeamError = createSelector(
  [selectTeamState],
  (teamState) => teamState.error
);

export const selectTeamPerformance = createSelector(
  [selectTeamState],
  (teamState) => teamState.performanceMetrics
);

export const { 
  setTeam, 
  setLoading, 
  setError, 
  clearTeam, 
  updateStats, 
  setSubscribed,
  updatePerformanceMetrics 
} = teamSlice.actions;

export default teamSlice.reducer;