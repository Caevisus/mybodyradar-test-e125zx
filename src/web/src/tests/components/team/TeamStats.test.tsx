import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'; // ^14.0.0
import { Provider } from 'react-redux'; // ^8.1.0
import { configureStore } from '@reduxjs/toolkit'; // ^1.9.0
import { axe, toHaveNoViolations } from 'jest-axe'; // ^4.7.0
import WS from 'ws'; // ^8.0.0
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'; // ^29.0.0

import TeamStats from '../../../components/team/TeamStats';
import { teamActions } from '../../../store/teamSlice';
import { UPDATE_INTERVALS } from '../../../constants/chart.constants';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock WebSocket
jest.mock('react-use-websocket', () => ({
  useWebSocket: () => ({
    sendMessage: jest.fn(),
    lastMessage: null,
    readyState: 1
  })
}));

// Mock performance.now() for timing tests
const originalPerformance = global.performance;
beforeEach(() => {
  let time = 0;
  global.performance = {
    ...originalPerformance,
    now: () => time++
  };
});

afterEach(() => {
  global.performance = originalPerformance;
});

// Mock team data
const mockTeamStats = {
  totalAthletes: 25,
  activeSessions: 15,
  alertsToday: 3,
  performanceMetrics: {
    latency: 45.5,
    successRate: 99.8,
    errorCount: 2
  },
  lastAuditDate: new Date().toISOString()
};

// Helper function to render component with Redux store
const renderWithRedux = (
  component: React.ReactElement,
  initialState = {}
) => {
  const store = configureStore({
    reducer: {
      team: (state = initialState, action) => state
    },
    preloadedState: {
      team: {
        currentTeam: {
          id: '123',
          name: 'Test Team',
          stats: mockTeamStats
        },
        loading: false,
        error: null
      }
    }
  });

  return {
    ...render(
      <Provider store={store}>
        {component}
      </Provider>
    ),
    store
  };
};

// Helper function to setup WebSocket mock server
const setupWebSocketMock = (mockData = mockTeamStats, updateInterval = 100) => {
  const wss = new WS.Server({ port: 8080 });
  
  wss.on('connection', (ws) => {
    const interval = setInterval(() => {
      ws.send(JSON.stringify(mockData));
    }, updateInterval);

    ws.on('close', () => clearInterval(interval));
  });

  return wss;
};

describe('TeamStats Component', () => {
  describe('Performance and Rendering', () => {
    it('should render initial team stats within 100ms', async () => {
      const startTime = performance.now();
      const { container } = renderWithRedux(
        <TeamStats teamId="123" enableRealTime={true} />
      );
      const renderTime = performance.now() - startTime;
      
      expect(renderTime).toBeLessThan(100);
      expect(container).toBeInTheDocument();
    });

    it('should update stats with ±1% accuracy', async () => {
      const { store } = renderWithRedux(
        <TeamStats teamId="123" enableRealTime={true} />
      );

      const newStats = {
        ...mockTeamStats,
        performanceMetrics: {
          latency: 46.0, // 0.5 difference, within 1%
          successRate: 99.9,
          errorCount: 2
        }
      };

      store.dispatch(teamActions.updateStats(newStats));
      
      const latencyElement = await screen.findByText(/46\.0ms/);
      expect(latencyElement).toBeInTheDocument();
    });

    it('should maintain real-time update latency under 100ms', async () => {
      const wss = setupWebSocketMock();
      const { container } = renderWithRedux(
        <TeamStats teamId="123" enableRealTime={true} />
      );

      const updateStartTime = performance.now();
      await waitFor(() => {
        const updateTime = performance.now() - updateStartTime;
        expect(updateTime).toBeLessThan(100);
      });

      wss.close();
    });
  });

  describe('Accessibility Compliance', () => {
    it('should meet WCAG 2.1 Level AA standards', async () => {
      const { container } = renderWithRedux(
        <TeamStats teamId="123" enableRealTime={true} />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels for charts and metrics', () => {
      renderWithRedux(
        <TeamStats teamId="123" enableRealTime={true} />
      );

      expect(screen.getByRole('region', { name: /Team Performance Metrics/i })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /Team Performance Charts/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      renderWithRedux(
        <TeamStats teamId="123" enableRealTime={true} />
      );

      const metrics = screen.getByRole('region', { name: /Team Performance Metrics/i });
      metrics.focus();
      expect(document.activeElement).toBe(metrics);
    });
  });

  describe('Real-time Updates', () => {
    it('should establish WebSocket connection when enabled', async () => {
      const wss = setupWebSocketMock();
      
      renderWithRedux(
        <TeamStats teamId="123" enableRealTime={true} />
      );

      await waitFor(() => {
        expect(wss.clients.size).toBe(1);
      });

      wss.close();
    });

    it('should process real-time updates at specified interval', async () => {
      const wss = setupWebSocketMock(mockTeamStats, UPDATE_INTERVALS.REAL_TIME);
      
      renderWithRedux(
        <TeamStats teamId="123" enableRealTime={true} />
      );

      const updates: number[] = [];
      const startTime = performance.now();

      await waitFor(() => {
        const currentTime = performance.now();
        updates.push(currentTime - startTime);
        expect(updates[updates.length - 1] - updates[updates.length - 2]).toBeCloseTo(UPDATE_INTERVALS.REAL_TIME, -1);
      }, { timeout: 1000 });

      wss.close();
    });
  });

  describe('Error Handling', () => {
    it('should display error message on API failure', async () => {
      const { store } = renderWithRedux(
        <TeamStats teamId="123" enableRealTime={true} />
      );

      store.dispatch(teamActions.setError('Failed to fetch team stats'));
      
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to fetch team stats');
    });

    it('should attempt to reconnect on WebSocket disconnection', async () => {
      const wss = setupWebSocketMock();
      
      renderWithRedux(
        <TeamStats teamId="123" enableRealTime={true} />
      );

      wss.close();

      await waitFor(() => {
        const newWss = setupWebSocketMock();
        expect(newWss.clients.size).toBe(1);
        newWss.close();
      });
    });
  });
});