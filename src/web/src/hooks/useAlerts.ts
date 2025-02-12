/**
 * @fileoverview Custom React hook for managing real-time alerts in the smart-apparel system
 * @version 1.0.0
 * 
 * Implements comprehensive alert management with real-time updates, filtering,
 * and performance optimizations to support <100ms latency requirement and
 * >85% injury prediction accuracy.
 */

import { useState, useEffect, useCallback } from 'react'; // v18.0.0
import { 
  alertService,
  getAlerts,
  getAlertById,
  updateAlertStatus,
  subscribeToAlerts,
  batchUpdateAlerts
} from '../services/alert.service';
import { 
  IAlert,
  IAlertFilter
} from '../interfaces/alert.interface';
import { DEFAULT_ALERT_REFRESH_INTERVAL } from '../constants/alert.constants';

/**
 * Custom hook for managing real-time alerts with comprehensive state management
 * @param filter - Alert filtering criteria
 * @param options - Additional configuration options
 */
export const useAlerts = (
  filter?: IAlertFilter,
  options: {
    autoRefresh?: boolean;
    refreshInterval?: number;
    batchSize?: number;
  } = {}
) => {
  // State management
  const [alerts, setAlerts] = useState<IAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [subscription, setSubscription] = useState<any>(null);

  // Default options
  const {
    autoRefresh = true,
    refreshInterval = DEFAULT_ALERT_REFRESH_INTERVAL,
    batchSize = 10
  } = options;

  /**
   * Fetches alerts with filtering and error handling
   */
  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getAlerts(filter);
      setAlerts(prevAlerts => {
        // Deduplicate and sort alerts
        const newAlerts = [...prevAlerts, ...response]
          .filter((alert, index, self) => 
            index === self.findIndex(a => a.id === alert.id)
          )
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        
        return newAlerts;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch alerts'));
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  /**
   * Sets up real-time alert subscription with automatic reconnection
   */
  const setupSubscription = useCallback(async () => {
    try {
      const sub = await subscribeToAlerts({
        userId: 'current-user', // Would be replaced with actual user ID
        alertTypes: filter?.types || [],
        categories: filter?.categories || [],
        minSeverity: filter?.severities?.[0] || 'LOW'
      });

      setSubscription(sub);

      // Handle real-time updates
      alertService.getAlertStream().subscribe(newAlerts => {
        setAlerts(prevAlerts => {
          const updated = [...prevAlerts];
          newAlerts.forEach(newAlert => {
            const index = updated.findIndex(a => a.id === newAlert.id);
            if (index >= 0) {
              updated[index] = newAlert;
            } else {
              updated.unshift(newAlert);
            }
          });
          return updated
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 100); // Keep last 100 alerts
        });
      });
    } catch (err) {
      console.error('Error setting up alert subscription:', err);
      setError(err instanceof Error ? err : new Error('Subscription failed'));
    }
  }, [filter]);

  /**
   * Updates alert status with optimistic updates
   */
  const updateAlertStatus = useCallback(async (
    alertId: string,
    status: string,
    notes?: string
  ) => {
    try {
      // Optimistic update
      setAlerts(prevAlerts =>
        prevAlerts.map(alert =>
          alert.id === alertId
            ? { ...alert, status, notes }
            : alert
        )
      );

      await updateAlertStatus(alertId, status, notes);
    } catch (err) {
      // Revert on error
      await fetchAlerts();
      throw err;
    }
  }, [fetchAlerts]);

  /**
   * Batch updates multiple alerts
   */
  const batchUpdate = useCallback(async (
    alertIds: string[],
    status: string
  ) => {
    try {
      // Optimistic update
      setAlerts(prevAlerts =>
        prevAlerts.map(alert =>
          alertIds.includes(alert.id)
            ? { ...alert, status }
            : alert
        )
      );

      await batchUpdateAlerts(alertIds, status);
    } catch (err) {
      // Revert on error
      await fetchAlerts();
      throw err;
    }
  }, [fetchAlerts]);

  // Alert operations with type safety
  const operations = {
    acknowledgeAlert: (alertId: string) => 
      updateAlertStatus(alertId, 'ACKNOWLEDGED'),
    dismissAlert: (alertId: string) => 
      updateAlertStatus(alertId, 'DISMISSED'),
    resolveAlert: (alertId: string, notes?: string) => 
      updateAlertStatus(alertId, 'RESOLVED', notes),
    refreshAlerts: fetchAlerts,
    batchUpdate
  };

  // Initial setup and cleanup
  useEffect(() => {
    fetchAlerts();
    if (autoRefresh) {
      setupSubscription();
    }

    // Auto-refresh timer
    let refreshTimer: NodeJS.Timer | null = null;
    if (autoRefresh) {
      refreshTimer = setInterval(fetchAlerts, refreshInterval);
    }

    // Cleanup
    return () => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [fetchAlerts, setupSubscription, autoRefresh, refreshInterval]);

  return {
    alerts,
    loading,
    error,
    ...operations
  };
};