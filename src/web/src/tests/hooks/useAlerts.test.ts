/**
 * @fileoverview Test suite for useAlerts hook verifying real-time alert management
 * with comprehensive coverage of alert operations and performance requirements
 * @version 1.0.0
 */

import { renderHook, act } from '@testing-library/react-hooks'; // v8.0.1
import { performance } from 'perf_hooks'; // v1.0.0
import { alertService } from '../../services/alert.service';
import { useAlerts } from '../../hooks/useAlerts';
import { 
  ALERT_TYPES, 
  ALERT_SEVERITY, 
  ALERT_STATUS,
  ALERT_CATEGORIES 
} from '../../constants/alert.constants';
import type { IAlert, IAlertFilter } from '../../interfaces/alert.interface';

// Mock alert service
jest.mock('../../services/alert.service');

describe('useAlerts Hook', () => {
  // Test data setup
  const mockAlerts: IAlert[] = [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      type: ALERT_TYPES.BIOMECHANICAL,
      category: ALERT_CATEGORIES.INJURY_RISK,
      severity: ALERT_SEVERITY.HIGH,
      status: ALERT_STATUS.ACTIVE,
      sessionId: '123e4567-e89b-12d3-a456-426614174001',
      timestamp: new Date(),
      message: 'High impact detected',
      details: {
        threshold: 8.5,
        currentValue: 9.2,
        sensorData: {
          type: 'imu',
          value: [9.2, 1.1, 0.3],
          timestamp: Date.now()
        },
        location: 'Right Knee',
        recommendations: ['Reduce training intensity'],
        confidenceScore: 0.92
      }
    }
  ];

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup alert service mocks
    (alertService.getAlerts as jest.Mock).mockResolvedValue(mockAlerts);
    (alertService.getAlertStream as jest.Mock).mockReturnValue({
      subscribe: jest.fn((callback) => {
        callback(mockAlerts);
        return { unsubscribe: jest.fn() };
      })
    });
  });

  afterEach(() => {
    // Cleanup subscriptions
    jest.clearAllTimers();
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useAlerts());
    
    expect(result.current.loading).toBe(true);
    expect(result.current.alerts).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should fetch alerts and handle real-time updates within latency requirements', async () => {
    const startTime = performance.now();
    
    const { result, waitForNextUpdate } = renderHook(() => useAlerts());
    
    await waitForNextUpdate();
    
    const endTime = performance.now();
    const latency = endTime - startTime;
    
    // Verify latency requirement (<100ms)
    expect(latency).toBeLessThan(100);
    
    // Verify alerts are loaded
    expect(result.current.loading).toBe(false);
    expect(result.current.alerts).toEqual(mockAlerts);
    expect(alertService.getAlerts).toHaveBeenCalled();
  });

  it('should properly filter alerts based on criteria', async () => {
    const filter: IAlertFilter = {
      types: [ALERT_TYPES.BIOMECHANICAL],
      severities: [ALERT_SEVERITY.HIGH],
      categories: [ALERT_CATEGORIES.INJURY_RISK],
      statuses: [ALERT_STATUS.ACTIVE],
      confidenceRange: {
        min: 0.8,
        max: 1.0
      }
    };

    const { result, waitForNextUpdate } = renderHook(() => useAlerts(filter));
    
    await waitForNextUpdate();
    
    expect(alertService.getAlerts).toHaveBeenCalledWith(filter);
    expect(result.current.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: ALERT_TYPES.BIOMECHANICAL,
          severity: ALERT_SEVERITY.HIGH
        })
      ])
    );
  });

  it('should handle alert status updates correctly', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useAlerts());
    
    await waitForNextUpdate();

    await act(async () => {
      await result.current.acknowledgeAlert(mockAlerts[0].id);
    });

    expect(alertService.updateAlertStatus).toHaveBeenCalledWith(
      mockAlerts[0].id,
      ALERT_STATUS.ACKNOWLEDGED
    );
  });

  it('should handle error states gracefully', async () => {
    const testError = new Error('Failed to fetch alerts');
    (alertService.getAlerts as jest.Mock).mockRejectedValueOnce(testError);

    const { result, waitForNextUpdate } = renderHook(() => useAlerts());
    
    await waitForNextUpdate();

    expect(result.current.error).toBeTruthy();
    expect(result.current.loading).toBe(false);
  });

  it('should maintain alert order and deduplication', async () => {
    const duplicateAlert = { ...mockAlerts[0], timestamp: new Date(Date.now() + 1000) };
    const newAlerts = [...mockAlerts, duplicateAlert];

    (alertService.getAlertStream as jest.Mock).mockReturnValue({
      subscribe: jest.fn((callback) => {
        callback(newAlerts);
        return { unsubscribe: jest.fn() };
      })
    });

    const { result, waitForNextUpdate } = renderHook(() => useAlerts());
    
    await waitForNextUpdate();

    expect(result.current.alerts).toHaveLength(1);
    expect(result.current.alerts[0].timestamp).toEqual(duplicateAlert.timestamp);
  });

  it('should cleanup subscriptions on unmount', () => {
    const unsubscribeMock = jest.fn();
    (alertService.getAlertStream as jest.Mock).mockReturnValue({
      subscribe: jest.fn(() => ({ unsubscribe: unsubscribeMock }))
    });

    const { unmount } = renderHook(() => useAlerts());
    
    unmount();
    
    expect(unsubscribeMock).toHaveBeenCalled();
  });

  it('should batch update multiple alerts', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useAlerts());
    
    await waitForNextUpdate();

    const alertIds = [mockAlerts[0].id];
    
    await act(async () => {
      await result.current.batchUpdate(alertIds, ALERT_STATUS.RESOLVED);
    });

    expect(alertService.batchUpdateAlerts).toHaveBeenCalledWith(
      alertIds,
      ALERT_STATUS.RESOLVED
    );
  });

  it('should respect auto-refresh configuration', async () => {
    jest.useFakeTimers();

    const { waitForNextUpdate } = renderHook(() => 
      useAlerts(undefined, { autoRefresh: true, refreshInterval: 5000 })
    );

    await waitForNextUpdate();

    jest.advanceTimersByTime(5000);

    expect(alertService.getAlerts).toHaveBeenCalledTimes(2);
  });
});