import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux'; // ^8.1.0
import { useWebSocket } from 'react-use-websocket'; // ^4.3.1

import { ITeam } from '../../interfaces/team.interface';
import Chart from '../common/Chart';
import { teamActions } from '../../store/teamSlice';

import { 
  ChartTypes, 
  ChartOptions 
} from '../../interfaces/chart.interface';
import { 
  UPDATE_INTERVALS, 
  CHART_DIMENSIONS 
} from '../../constants/chart.constants';

interface TeamStatsProps {
  teamId: UUID;
  className?: string;
  refreshInterval?: number;
  enableRealTime?: boolean;
  chartConfig?: ChartOptions;
}

interface PerformanceMetrics {
  latency: number;
  successRate: number;
  errorCount: number;
}

/**
 * TeamStats component for displaying comprehensive team analytics with real-time updates
 * Implements WebGL-accelerated visualizations and sub-100ms latency requirements
 */
const TeamStats: React.FC<TeamStatsProps> = ({
  teamId,
  className = '',
  refreshInterval = UPDATE_INTERVALS.REAL_TIME,
  enableRealTime = true,
  chartConfig
}) => {
  const dispatch = useDispatch();
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    latency: 0,
    successRate: 100,
    errorCount: 0
  });

  // Redux selectors
  const team = useSelector((state: any) => state.team.currentTeam);
  const loading = useSelector((state: any) => state.team.loading);
  const error = useSelector((state: any) => state.team.error);

  // WebSocket setup for real-time updates
  const { 
    sendMessage,
    lastMessage,
    readyState 
  } = useWebSocket(
    `${process.env.REACT_APP_WS_URL}/team/${teamId}`,
    {
      shouldReconnect: () => true,
      reconnectInterval: UPDATE_INTERVALS.REAL_TIME,
      reconnectAttempts: 5
    }
  );

  // Default chart configuration
  const defaultChartConfig: ChartOptions = useMemo(() => ({
    type: ChartTypes.HEAT_MAP,
    dimensions: {
      width: CHART_DIMENSIONS.DEFAULT_WIDTH,
      height: CHART_DIMENSIONS.DEFAULT_HEIGHT,
      margin: CHART_DIMENSIONS.DEFAULT_MARGIN,
      aspectRatio: 16/9
    },
    updateInterval: refreshInterval,
    precision: 1, // For ±1% accuracy requirement
    colorScale: ['#f7fbff', '#2171b5'],
    animationConfig: {
      duration: 300,
      easing: 'ease-out'
    },
    interactionConfig: {
      zoomEnabled: true,
      panEnabled: true,
      tooltipEnabled: true,
      selectionEnabled: true
    }
  }), [refreshInterval]);

  // Fetch initial team data
  useEffect(() => {
    const fetchData = async () => {
      const startTime = performance.now();
      await dispatch(teamActions.fetchTeam(teamId));
      const latency = performance.now() - startTime;
      
      setPerformanceMetrics(prev => ({
        ...prev,
        latency,
        successRate: latency < 100 ? 100 : 99
      }));
    };

    fetchData();
  }, [dispatch, teamId]);

  // Handle real-time updates
  useEffect(() => {
    if (enableRealTime && lastMessage) {
      const startTime = performance.now();
      const data = JSON.parse(lastMessage.data);
      
      dispatch(teamActions.updateStats(data));
      
      const latency = performance.now() - startTime;
      if (latency > 100) {
        console.warn(`Real-time update exceeded latency threshold: ${latency}ms`);
      }
    }
  }, [dispatch, enableRealTime, lastMessage]);

  // Render performance metrics section
  const renderMetrics = useCallback(() => {
    if (!team?.stats) return null;

    return (
      <div className="team-metrics" role="region" aria-label="Team Performance Metrics">
        <div className="metric-card">
          <h3>Active Athletes</h3>
          <p>{team.stats.totalAthletes}</p>
        </div>
        <div className="metric-card">
          <h3>Active Sessions</h3>
          <p>{team.stats.activeSessions}</p>
        </div>
        <div className="metric-card">
          <h3>Alerts Today</h3>
          <p>{team.stats.alertsToday}</p>
        </div>
        <div className="metric-card">
          <h3>System Performance</h3>
          <p>{performanceMetrics.latency.toFixed(1)}ms</p>
        </div>
      </div>
    );
  }, [team?.stats, performanceMetrics]);

  // Render performance charts
  const renderCharts = useCallback(() => {
    if (!team?.stats) return null;

    const config = chartConfig || defaultChartConfig;

    return (
      <div className="team-charts" role="region" aria-label="Team Performance Charts">
        <Chart
          data={team.stats.performanceMetrics}
          options={config}
          onHover={(event, data) => {
            // Handle hover interactions
          }}
          onClick={(event, data) => {
            // Handle click interactions
          }}
          precision={1}
          useWebGL={true}
          accessibilityLabel="Team performance heat map visualization"
        />
      </div>
    );
  }, [team?.stats, chartConfig, defaultChartConfig]);

  // Error state
  if (error) {
    return (
      <div className="team-stats-error" role="alert">
        <h3>Error Loading Team Statistics</h3>
        <p>{error}</p>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="team-stats-loading" role="status">
        <span className="loading-spinner" aria-hidden="true" />
        <span className="sr-only">Loading team statistics...</span>
      </div>
    );
  }

  return (
    <div className={`team-stats ${className}`} data-testid="team-stats">
      <header className="team-stats-header">
        <h2>{team?.name} Statistics</h2>
        <div className="real-time-indicator" aria-live="polite">
          {enableRealTime && readyState === 1 && (
            <span className="badge badge-success">Live Updates</span>
          )}
        </div>
      </header>

      {renderMetrics()}
      {renderCharts()}

      <footer className="team-stats-footer">
        <small>
          Last updated: {new Date(team?.stats?.lastAuditDate).toLocaleString()}
        </small>
        <small>
          Latency: {performanceMetrics.latency.toFixed(1)}ms
        </small>
      </footer>
    </div>
  );
};

export default TeamStats;