/**
 * @fileoverview Enhanced WebSocket Context Provider for real-time data streaming
 * Implements reliable WebSocket connections with reconnection logic, message queuing,
 * and performance monitoring to meet <100ms latency requirements
 * @version 1.0.0
 */

import React, { 
  createContext, 
  useContext, 
  useEffect, 
  useCallback, 
  useState, 
  useMemo, 
  useRef 
} from 'react';
import { WebSocketService } from '../services/websocket.service';
import { ISensorData } from '../interfaces/sensor.interface';

// Connection monitoring constants
const MONITORING_CONFIG = {
  HEALTH_CHECK_INTERVAL: 30000,
  MAX_RECONNECT_ATTEMPTS: 5,
  MESSAGE_BATCH_SIZE: 100,
  PERFORMANCE_WINDOW: 60000, // 1 minute window for performance stats
} as const;

interface IConnectionStats {
  messagesReceived: number;
  messagesSent: number;
  averageLatency: number;
  lastMessageTime: number;
  connectionUptime: number;
  reconnectAttempts: number;
}

interface IConnectionHealth {
  isHealthy: boolean;
  latency: number;
  messageRate: number;
  lastHeartbeat: number;
}

interface IWebSocketContextState {
  isConnected: boolean;
  isReconnecting: boolean;
  lastMessage: ISensorData | null;
  error: Error | null;
  connectionAttempts: number;
  lastHeartbeat: number;
  messageQueue: Array<ISensorData>;
  connectionStats: IConnectionStats;
}

interface IWebSocketContextValue {
  state: IWebSocketContextState;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribe: (channel: string, callback: Function) => void;
  send: (data: any) => Promise<void>;
  getConnectionHealth: () => IConnectionHealth;
  clearMessageQueue: () => void;
  resetConnection: () => Promise<void>;
}

const WebSocketContext = createContext<IWebSocketContextValue | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
  url: string;
  options?: {
    autoConnect?: boolean;
    reconnectAttempts?: number;
    messageQueueSize?: number;
  };
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ 
  children, 
  url, 
  options = {} 
}) => {
  const webSocketService = useRef(new WebSocketService());
  const messageCallbacks = useRef<Map<string, Set<Function>>>(new Map());
  const performanceMetrics = useRef<number[]>([]);

  const [state, setState] = useState<IWebSocketContextState>({
    isConnected: false,
    isReconnecting: false,
    lastMessage: null,
    error: null,
    connectionAttempts: 0,
    lastHeartbeat: Date.now(),
    messageQueue: [],
    connectionStats: {
      messagesReceived: 0,
      messagesSent: 0,
      averageLatency: 0,
      lastMessageTime: Date.now(),
      connectionUptime: 0,
      reconnectAttempts: 0
    }
  });

  // Enhanced connection handler with performance monitoring
  const connect = useCallback(async () => {
    if (state.isConnected || state.isReconnecting) return;

    setState(prev => ({ 
      ...prev, 
      isReconnecting: true,
      connectionAttempts: prev.connectionAttempts + 1 
    }));

    try {
      await webSocketService.current.connect(url, {
        bufferSize: 1024,
        sampleRate: 200,
        compression: true,
        priority: 'high',
        qos: 2
      });

      setState(prev => ({ 
        ...prev,
        isConnected: true,
        isReconnecting: false,
        error: null,
        lastHeartbeat: Date.now()
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev,
        isReconnecting: false,
        error: error as Error
      }));
    }
  }, [url, state.isConnected, state.isReconnecting]);

  // Enhanced message handler with batching and performance tracking
  const handleMessage = useCallback((message: ISensorData) => {
    const startTime = performance.now();

    setState(prev => {
      const newStats = { ...prev.connectionStats };
      newStats.messagesReceived++;
      newStats.lastMessageTime = Date.now();

      // Track message processing latency
      const latency = performance.now() - startTime;
      performanceMetrics.current.push(latency);

      // Maintain performance metrics window
      while (performanceMetrics.current.length > 0 && 
             performanceMetrics.current[0] < Date.now() - MONITORING_CONFIG.PERFORMANCE_WINDOW) {
        performanceMetrics.current.shift();
      }

      // Calculate average latency
      newStats.averageLatency = performanceMetrics.current.reduce((a, b) => a + b, 0) / 
                               performanceMetrics.current.length;

      return {
        ...prev,
        lastMessage: message,
        connectionStats: newStats
      };
    });

    // Notify subscribers
    messageCallbacks.current.get(message.sensorId)?.forEach(callback => {
      callback(message);
    });
  }, []);

  // Connection health monitoring
  const getConnectionHealth = useCallback((): IConnectionHealth => {
    const now = Date.now();
    const messageRate = state.connectionStats.messagesReceived / 
                       (MONITORING_CONFIG.PERFORMANCE_WINDOW / 1000);

    return {
      isHealthy: state.isConnected && 
                 (now - state.lastHeartbeat) < MONITORING_CONFIG.HEALTH_CHECK_INTERVAL * 2,
      latency: state.connectionStats.averageLatency,
      messageRate,
      lastHeartbeat: state.lastHeartbeat
    };
  }, [state.isConnected, state.lastHeartbeat, state.connectionStats]);

  // Enhanced subscription management
  const subscribe = useCallback((channel: string, callback: Function) => {
    if (!messageCallbacks.current.has(channel)) {
      messageCallbacks.current.set(channel, new Set());
    }
    messageCallbacks.current.get(channel)!.add(callback);

    return () => {
      messageCallbacks.current.get(channel)?.delete(callback);
      if (messageCallbacks.current.get(channel)?.size === 0) {
        messageCallbacks.current.delete(channel);
      }
    };
  }, []);

  // Enhanced message sending with queuing
  const send = useCallback(async (data: any) => {
    if (!state.isConnected) {
      setState(prev => ({
        ...prev,
        messageQueue: [...prev.messageQueue, data]
      }));
      return;
    }

    try {
      await webSocketService.current.send(data);
      setState(prev => ({
        ...prev,
        connectionStats: {
          ...prev.connectionStats,
          messagesSent: prev.connectionStats.messagesSent + 1
        }
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error as Error,
        messageQueue: [...prev.messageQueue, data]
      }));
    }
  }, [state.isConnected]);

  // Clean disconnect with state reset
  const disconnect = useCallback(() => {
    webSocketService.current.disconnect();
    setState(prev => ({
      ...prev,
      isConnected: false,
      error: null,
      connectionAttempts: 0
    }));
  }, []);

  // Message queue management
  const clearMessageQueue = useCallback(() => {
    setState(prev => ({ ...prev, messageQueue: [] }));
  }, []);

  // Connection reset functionality
  const resetConnection = useCallback(async () => {
    await disconnect();
    setState(prev => ({
      ...prev,
      connectionAttempts: 0,
      error: null,
      messageQueue: []
    }));
    return connect();
  }, [connect, disconnect]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (options.autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [options.autoConnect, connect, disconnect]);

  const contextValue = useMemo(() => ({
    state,
    connect,
    disconnect,
    subscribe,
    send,
    getConnectionHealth,
    clearMessageQueue,
    resetConnection
  }), [
    state,
    connect,
    disconnect,
    subscribe,
    send,
    getConnectionHealth,
    clearMessageQueue,
    resetConnection
  ]);

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};

export default WebSocketContext;