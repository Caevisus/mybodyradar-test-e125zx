/**
 * @fileoverview Enhanced custom React hook for team management operations
 * Provides comprehensive team state management, real-time updates, security controls,
 * and performance monitoring for the smart-apparel web application
 * @version 1.0.0
 */

import { useEffect, useCallback } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.0.0
import type { UUID } from 'crypto';

import { ITeam } from '../interfaces/team.interface';
import { teamService } from '../services/team.service';
import type { IApiError } from '../interfaces/common.interface';

interface ITeamHookState {
  team: ITeam | null;
  loading: boolean;
  error: IApiError | null;
  performanceMetrics: {
    latency: number;
    lastUpdate: Date;
    operationCount: number;
  };
}

interface ITeamHookOperations {
  updateSettings: (settings: Partial<ITeam['settings']>) => Promise<void>;
  addMember: (athleteId: UUID) => Promise<void>;
  removeMember: (athleteId: UUID) => Promise<void>;
  refreshStats: () => Promise<void>;
  resetError: () => void;
}

/**
 * Enhanced custom hook for managing team operations with real-time updates,
 * security controls, and performance monitoring
 * @param teamId - UUID of the team to manage
 * @returns Team state and operations with comprehensive monitoring
 */
export const useTeam = (teamId: UUID): ITeamHookState & ITeamHookOperations => {
  const dispatch = useDispatch();
  const teamState = useSelector((state: any) => state.team);

  // Performance monitoring state
  const [performanceMetrics, setPerformanceMetrics] = useState({
    latency: 0,
    lastUpdate: new Date(),
    operationCount: 0
  });

  /**
   * Updates performance metrics after each operation
   */
  const updatePerformanceMetrics = useCallback((latency: number) => {
    setPerformanceMetrics(prev => ({
      latency: (prev.latency + latency) / 2, // Rolling average
      lastUpdate: new Date(),
      operationCount: prev.operationCount + 1
    }));
  }, []);

  /**
   * Fetches initial team data with security context
   */
  const fetchTeamData = useCallback(async () => {
    try {
      dispatch({ type: 'TEAM_LOADING' });
      const startTime = Date.now();
      
      const response = await teamService.getTeam(teamId);
      
      updatePerformanceMetrics(Date.now() - startTime);
      dispatch({ type: 'TEAM_LOADED', payload: response.data });
    } catch (error) {
      dispatch({ type: 'TEAM_ERROR', payload: error });
    }
  }, [teamId, dispatch]);

  /**
   * Updates team settings with validation and audit logging
   */
  const updateSettings = useCallback(async (
    settings: Partial<ITeam['settings']>
  ) => {
    try {
      dispatch({ type: 'TEAM_UPDATING' });
      const startTime = Date.now();

      const response = await teamService.updateTeamSettings(teamId, settings);
      
      updatePerformanceMetrics(Date.now() - startTime);
      dispatch({ type: 'TEAM_UPDATED', payload: response.data });
    } catch (error) {
      dispatch({ type: 'TEAM_ERROR', payload: error });
      throw error;
    }
  }, [teamId, dispatch]);

  /**
   * Adds a new team member with security validation
   */
  const addMember = useCallback(async (athleteId: UUID) => {
    try {
      dispatch({ type: 'TEAM_UPDATING' });
      const startTime = Date.now();

      const response = await teamService.addTeamMember(teamId, athleteId);
      
      updatePerformanceMetrics(Date.now() - startTime);
      dispatch({ type: 'TEAM_UPDATED', payload: response.data });
    } catch (error) {
      dispatch({ type: 'TEAM_ERROR', payload: error });
      throw error;
    }
  }, [teamId, dispatch]);

  /**
   * Removes a team member with security validation
   */
  const removeMember = useCallback(async (athleteId: UUID) => {
    try {
      dispatch({ type: 'TEAM_UPDATING' });
      const startTime = Date.now();

      const response = await teamService.removeTeamMember(teamId, athleteId);
      
      updatePerformanceMetrics(Date.now() - startTime);
      dispatch({ type: 'TEAM_UPDATED', payload: response.data });
    } catch (error) {
      dispatch({ type: 'TEAM_ERROR', payload: error });
      throw error;
    }
  }, [teamId, dispatch]);

  /**
   * Refreshes team statistics with real-time data
   */
  const refreshStats = useCallback(async () => {
    try {
      const startTime = Date.now();
      const response = await teamService.getTeamStats(teamId);
      
      updatePerformanceMetrics(Date.now() - startTime);
      dispatch({ type: 'TEAM_STATS_UPDATED', payload: response.data });
    } catch (error) {
      dispatch({ type: 'TEAM_ERROR', payload: error });
      throw error;
    }
  }, [teamId, dispatch]);

  /**
   * Resets any error state
   */
  const resetError = useCallback(() => {
    dispatch({ type: 'TEAM_RESET_ERROR' });
  }, [dispatch]);

  /**
   * Sets up real-time team statistics subscription
   */
  useEffect(() => {
    let subscription: ZenObservable.Subscription;

    const setupSubscription = async () => {
      try {
        subscription = await teamService.subscribeToTeamStats(
          teamId,
          (stats) => {
            dispatch({ type: 'TEAM_STATS_UPDATED', payload: stats });
          }
        );
      } catch (error) {
        dispatch({ type: 'TEAM_ERROR', payload: error });
      }
    };

    setupSubscription();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [teamId, dispatch]);

  /**
   * Fetches initial team data on mount
   */
  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  return {
    // State
    team: teamState.team,
    loading: teamState.loading,
    error: teamState.error,
    performanceMetrics,

    // Operations
    updateSettings,
    addMember,
    removeMember,
    refreshStats,
    resetError
  };
};