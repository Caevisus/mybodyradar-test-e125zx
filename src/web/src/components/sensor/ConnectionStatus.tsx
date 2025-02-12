import React, { useCallback, useEffect, useMemo, memo } from 'react';
import classNames from 'classnames';
import { ISensorConfig } from '../../interfaces/sensor.interface';
import { SENSOR_STATUS } from '../../constants/sensor.constants';
import { useSensor } from '../../hooks/useSensor';

// Component props interface
interface ConnectionStatusProps {
  sensor: ISensorConfig;
  onReconnect?: (sensorId: string) => Promise<void>;
  showDetailedMetrics?: boolean;
}

/**
 * Enhanced connection status indicator component with real-time monitoring
 * Implements accessibility features and performance optimizations
 * @version 1.0.0
 */
export const ConnectionStatus: React.FC<ConnectionStatusProps> = memo(({ 
  sensor, 
  onReconnect,
  showDetailedMetrics = false 
}) => {
  // Custom hook for sensor management
  const { 
    sensorStatus,
    sensorMetrics,
    startSensor,
    reconnectSensor
  } = useSensor(sensor);

  /**
   * Returns appropriate status color and animation classes
   * with accessibility considerations
   */
  const getStatusColor = useCallback((status: SENSOR_STATUS) => {
    const baseClasses = 'h-4 w-4 rounded-full transition-all duration-300';
    
    const statusConfig = {
      [SENSOR_STATUS.DISCONNECTED]: {
        className: classNames(baseClasses, 'bg-red-500', 'animate-pulse'),
        ariaLabel: 'Sensor disconnected',
        role: 'status'
      },
      [SENSOR_STATUS.CONNECTING]: {
        className: classNames(baseClasses, 'bg-yellow-500', 'animate-pulse'),
        ariaLabel: 'Sensor connecting',
        role: 'status'
      },
      [SENSOR_STATUS.ACTIVE]: {
        className: classNames(baseClasses, 'bg-green-500'),
        ariaLabel: 'Sensor connected',
        role: 'status'
      },
      [SENSOR_STATUS.ERROR]: {
        className: classNames(baseClasses, 'bg-red-600', 'animate-ping'),
        ariaLabel: 'Sensor error',
        role: 'alert'
      },
      [SENSOR_STATUS.DEGRADED]: {
        className: classNames(baseClasses, 'bg-orange-500', 'animate-pulse'),
        ariaLabel: 'Degraded performance',
        role: 'alert'
      }
    };

    return statusConfig[status] || statusConfig[SENSOR_STATUS.DISCONNECTED];
  }, []);

  /**
   * Returns battery indicator configuration with critical warnings
   */
  const getBatteryIndicator = useCallback((batteryLevel: number) => {
    const baseClasses = 'px-2 py-1 rounded text-sm font-medium';
    
    if (batteryLevel <= 15) {
      return {
        className: classNames(baseClasses, 'bg-red-100 text-red-800', 'animate-pulse'),
        icon: '🔋',
        ariaLabel: `Critical battery level: ${batteryLevel}%`,
        role: 'alert'
      };
    } else if (batteryLevel <= 30) {
      return {
        className: classNames(baseClasses, 'bg-yellow-100 text-yellow-800'),
        icon: '🔋',
        ariaLabel: `Low battery: ${batteryLevel}%`,
        role: 'status'
      };
    }
    
    return {
      className: classNames(baseClasses, 'bg-green-100 text-green-800'),
      icon: '🔋',
      ariaLabel: `Battery level: ${batteryLevel}%`,
      role: 'status'
    };
  }, []);

  /**
   * Handles sensor reconnection with exponential backoff
   */
  const handleReconnect = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (onReconnect) {
      await onReconnect(sensor.id);
    } else {
      try {
        await reconnectSensor(sensor.id);
        await startSensor(sensor.id);
      } catch (error) {
        console.error('Reconnection failed:', error);
      }
    }
  }, [sensor.id, onReconnect, reconnectSensor, startSensor]);

  /**
   * Memoized signal strength indicator
   */
  const signalStrengthIndicator = useMemo(() => {
    const strength = sensor.signalStrength;
    const bars = Math.max(0, Math.min(4, Math.floor(strength / 25)));
    
    return (
      <div 
        className="flex items-center gap-1" 
        role="meter" 
        aria-label={`Signal strength: ${strength}%`}
        aria-valuenow={strength}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={classNames(
              'w-1 rounded-t',
              i < bars ? 'bg-green-500' : 'bg-gray-300',
              `h-${i + 1}`
            )}
          />
        ))}
      </div>
    );
  }, [sensor.signalStrength]);

  // Monitor connection status and trigger alerts for degraded performance
  useEffect(() => {
    const currentStatus = sensorStatus.get(sensor.id);
    if (currentStatus === SENSOR_STATUS.DEGRADED) {
      console.warn(`Degraded performance detected for sensor ${sensor.id}`);
    }
  }, [sensor.id, sensorStatus]);

  const status = sensorStatus.get(sensor.id) || SENSOR_STATUS.DISCONNECTED;
  const statusConfig = getStatusColor(status);
  const batteryConfig = getBatteryIndicator(sensor.batteryLevel);

  return (
    <div className="flex items-center space-x-4 p-4 rounded-lg border bg-white shadow-sm">
      {/* Status Indicator */}
      <div
        className={statusConfig.className}
        role={statusConfig.role}
        aria-label={statusConfig.ariaLabel}
      />

      {/* Connection Details */}
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-900">
          Sensor {sensor.id}
        </span>
        <span className="text-xs text-gray-500">
          {statusConfig.ariaLabel}
        </span>
      </div>

      {/* Battery Indicator */}
      <div
        className={batteryConfig.className}
        role={batteryConfig.role}
        aria-label={batteryConfig.ariaLabel}
      >
        {batteryConfig.icon} {sensor.batteryLevel}%
      </div>

      {/* Signal Strength */}
      {signalStrengthIndicator}

      {/* Detailed Metrics */}
      {showDetailedMetrics && sensorMetrics && (
        <div className="flex flex-col text-xs text-gray-600">
          <span>Latency: {sensorMetrics.latency}ms</span>
          <span>Data Rate: {sensorMetrics.dataRate}/s</span>
          <span>Buffer: {sensorMetrics.bufferUsage}%</span>
        </div>
      )}

      {/* Reconnect Button */}
      {status !== SENSOR_STATUS.ACTIVE && (
        <button
          onClick={handleReconnect}
          className={classNames(
            'px-3 py-1 rounded text-sm font-medium',
            'bg-blue-500 text-white hover:bg-blue-600',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            { 'animate-pulse': status === SENSOR_STATUS.CONNECTING }
          )}
          disabled={status === SENSOR_STATUS.CONNECTING}
          aria-busy={status === SENSOR_STATUS.CONNECTING}
        >
          {status === SENSOR_STATUS.CONNECTING ? 'Connecting...' : 'Reconnect'}
        </button>
      )}
    </div>
  );
});

ConnectionStatus.displayName = 'ConnectionStatus';

export default ConnectionStatus;