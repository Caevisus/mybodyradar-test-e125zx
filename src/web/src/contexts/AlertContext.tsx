/**
 * @fileoverview Alert Context Provider for smart-apparel system
 * Implements comprehensive alert state management with real-time updates,
 * alert correlation detection, and advanced filtering capabilities.
 * @version 1.0.0
 */

import React, { 
  createContext, 
  useContext, 
  useEffect, 
  useCallback, 
  useState, 
  useMemo 
} from 'react';
import { IAlert, IAlertFilter } from '../interfaces/alert.interface';
import { alertService } from '../services/alert.service';
import { useWebSocket } from './WebSocketContext';

// Alert processing configuration
const ALERT_CONFIG = {
  BATCH_SIZE: 50,
  CORRELATION_WINDOW: 5000, // 5 seconds
  MAX_ALERTS: 1000,
  PRIORITY_THRESHOLD: 3
} as const;

interface AlertContextState {
  alerts: IAlert[];
  filter: IAlertFilter;
  loading: boolean;
  error: Error | null;
  correlatedAlerts: Map<string, IAlert[]>;
}

interface AlertContextValue extends AlertContextState {
  updateFilter: (newFilter: Partial<IAlertFilter>) => void;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  dismissAlert: (alertId: string) => Promise<void>;
  clearAlerts: () => void;
  getCorrelatedAlerts: (alertId: string) => IAlert[];
  getPriorityAlerts: () => IAlert[];
}

const AlertContext = createContext<AlertContextValue | null>(null);

interface AlertProviderProps {
  children: React.ReactNode;
  batchSize?: number;
  correlationWindow?: number;
}

export const AlertProvider: React.FC<AlertProviderProps> = ({
  children,
  batchSize = ALERT_CONFIG.BATCH_SIZE,
  correlationWindow = ALERT_CONFIG.CORRELATION_WINDOW
}) => {
  // Core state
  const [alerts, setAlerts] = useState<IAlert[]>([]);
  const [filter, setFilter] = useState<IAlertFilter>({
    types: [],
    severities: [],
    statuses: [],
    dateRange: undefined,
    includeResolved: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [correlatedAlerts, setCorrelatedAlerts] = useState<Map<string, IAlert[]>>(new Map());

  // WebSocket integration
  const { connectionStatus, sendMessage } = useWebSocket();

  // Alert batch processing
  const processBatch = useCallback((newAlerts: IAlert[]) => {
    setAlerts(prevAlerts => {
      const combinedAlerts = [...prevAlerts, ...newAlerts]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, ALERT_CONFIG.MAX_ALERTS);

      // Update correlations
      const correlations = new Map<string, IAlert[]>();
      combinedAlerts.forEach(alert => {
        if (alert.correlationId) {
          const correlated = correlations.get(alert.correlationId) || [];
          correlated.push(alert);
          correlations.set(alert.correlationId, correlated);
        }
      });
      setCorrelatedAlerts(correlations);

      return combinedAlerts;
    });
  }, []);

  // Load initial alerts
  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedAlerts = await alertService.getAlerts(filter);
      processBatch(fetchedAlerts);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [filter, processBatch]);

  // Real-time alert subscription
  useEffect(() => {
    if (connectionStatus === 'connected') {
      const unsubscribe = alertService.subscribeToAlerts({
        userId: '', // Will be set by auth context
        alertTypes: filter.types || [],
        minSeverity: filter.severities?.[0] || 'LOW',
        notificationChannels: ['websocket']
      });

      return () => {
        unsubscribe();
      };
    }
  }, [connectionStatus, filter]);

  // Filter updates
  const updateFilter = useCallback((newFilter: Partial<IAlertFilter>) => {
    setFilter(prevFilter => ({
      ...prevFilter,
      ...newFilter
    }));
  }, []);

  // Alert actions
  const acknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      await alertService.updateAlertStatus(alertId, 'ACKNOWLEDGED');
      setAlerts(prevAlerts => 
        prevAlerts.map(alert => 
          alert.id === alertId 
            ? { ...alert, status: 'ACKNOWLEDGED' }
            : alert
        )
      );
    } catch (err) {
      setError(err as Error);
    }
  }, []);

  const dismissAlert = useCallback(async (alertId: string) => {
    try {
      await alertService.updateAlertStatus(alertId, 'DISMISSED');
      setAlerts(prevAlerts => 
        prevAlerts.filter(alert => alert.id !== alertId)
      );
    } catch (err) {
      setError(err as Error);
    }
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
    setCorrelatedAlerts(new Map());
  }, []);

  // Alert analysis utilities
  const getCorrelatedAlerts = useCallback((alertId: string) => {
    const alert = alerts.find(a => a.id === alertId);
    if (!alert?.correlationId) return [];
    return correlatedAlerts.get(alert.correlationId) || [];
  }, [alerts, correlatedAlerts]);

  const getPriorityAlerts = useCallback(() => {
    return alerts.filter(alert => alert.priority >= ALERT_CONFIG.PRIORITY_THRESHOLD);
  }, [alerts]);

  // Context value
  const value = useMemo(() => ({
    alerts,
    filter,
    loading,
    error,
    correlatedAlerts,
    updateFilter,
    acknowledgeAlert,
    dismissAlert,
    clearAlerts,
    getCorrelatedAlerts,
    getPriorityAlerts
  }), [
    alerts,
    filter,
    loading,
    error,
    correlatedAlerts,
    updateFilter,
    acknowledgeAlert,
    dismissAlert,
    clearAlerts,
    getCorrelatedAlerts,
    getPriorityAlerts
  ]);

  return (
    <AlertContext.Provider value={value}>
      {children}
    </AlertContext.Provider>
  );
};

export const useAlerts = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlerts must be used within an AlertProvider');
  }
  return context;
};

export default AlertContext;