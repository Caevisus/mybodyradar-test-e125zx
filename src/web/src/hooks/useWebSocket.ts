/**
 * @fileoverview Custom React hook for managing WebSocket connections and real-time data streaming
 * Implements reliable WebSocket functionality with connection management, monitoring,
 * and message queuing to meet <100ms latency requirements
 * @version 1.0.0
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import { WebSocketContext } from '../contexts/WebSocketContext';
import { ISensorData } from '../interfaces/sensor.interface';

// WebSocket configuration constants
const WS_CONFIG = {
  DEFAULT_RECONNECT_ATTEMPTS: 5,
  DEFAULT_RECONNECT_INTERVAL: 1000,
  DEFAULT_MESSAGE_BUFFER: 1000,
  DEFAULT_CONNECTION_TIMEOUT: 5000,
  DEFAULT_HEALTH_CHECK_INTERVAL: 30000,
  PERFORMANCE_WINDOW: 60000, // 1-minute window for performance metrics
} as const;

/**
 * Configuration options for WebSocket hook
 */
export interface IUseWebSocketOptions {
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  maxMessageBuffer?: number;
  connectionTimeout?: number;
  healthCheckInterval?: number;
}

/**
 * Connection statistics interface for monitoring
 */
export interface IConnectionStats {
  uptime: number;
  reconnectAttempts: number;
  lastReconnectTime: Date | null;
  messageLatency: number;
  queueSize: number;
  messagesProcessed: number;
  lastMessageTime: Date | null;
}

/**
 * Return type for useWebSocket hook
 */
export interface IUseWebSocketReturn {
  isConnected: boolean;
  isReconnecting: boolean;
  lastMessage: ISensorData | null;
  error: Error | null;
  connectionStats: IConnectionStats;
  messageQueue: Array<ISensorData>;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribe: (channel: string, callback: (data: ISensorData) => void) => () => void;
  send: (data: any) => Promise<void>;
}

/**
 * Custom hook for managing WebSocket connections with enhanced reliability
 * and performance monitoring capabilities
 */
export const useWebSocket = (
  options: IUseWebSocketOptions = {}
): IUseWebSocketReturn => {
  const context = useRef(WebSocketContext);
  const performanceMetrics = useRef<number[]>([]);
  const startTime = useRef<number>(Date.now());

  // Initialize state with default values
  const [state, setState] = useState({
    isConnected: false,
    isReconnecting: false,
    lastMessage: null as ISensorData | null,
    error: null as Error | null,
    connectionStats: {
      uptime: 0,
      reconnectAttempts: 0,
      lastReconnectTime: null,
      messageLatency: 0,
      queueSize: 0,
      messagesProcessed: 0,
      lastMessageTime: null,
    } as IConnectionStats,
    messageQueue: [] as Array<ISensorData>,
  });

  // Merge provided options with defaults
  const config = {
    autoConnect: options.autoConnect ?? true,
    reconnectAttempts: options.reconnectAttempts ?? WS_CONFIG.DEFAULT_RECONNECT_ATTEMPTS,
    reconnectInterval: options.reconnectInterval ?? WS_CONFIG.DEFAULT_RECONNECT_INTERVAL,
    maxMessageBuffer: options.maxMessageBuffer ?? WS_CONFIG.DEFAULT_MESSAGE_BUFFER,
    connectionTimeout: options.connectionTimeout ?? WS_CONFIG.DEFAULT_CONNECTION_TIMEOUT,
    healthCheckInterval: options.healthCheckInterval ?? WS_CONFIG.DEFAULT_HEALTH_CHECK_INTERVAL,
  };

  /**
   * Establishes WebSocket connection with retry mechanism
   */
  const connect = useCallback(async () => {
    if (state.isConnected || state.isReconnecting) return;

    setState(prev => ({
      ...prev,
      isReconnecting: true,
      connectionStats: {
        ...prev.connectionStats,
        reconnectAttempts: prev.connectionStats.reconnectAttempts + 1,
        lastReconnectTime: new Date(),
      }
    }));

    try {
      await context.current.connect();
      setState(prev => ({
        ...prev,
        isConnected: true,
        isReconnecting: false,
        error: null,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isReconnecting: false,
        error: error as Error,
      }));
    }
  }, [state.isConnected, state.isReconnecting]);

  /**
   * Handles message processing with performance tracking
   */
  const handleMessage = useCallback((message: ISensorData) => {
    const processStart = performance.now();

    setState(prev => {
      const latency = performance.now() - processStart;
      performanceMetrics.current.push(latency);

      // Maintain performance metrics window
      while (performanceMetrics.current.length > 0 &&
             performanceMetrics.current[0] < Date.now() - WS_CONFIG.PERFORMANCE_WINDOW) {
        performanceMetrics.current.shift();
      }

      const avgLatency = performanceMetrics.current.reduce((a, b) => a + b, 0) /
                        performanceMetrics.current.length;

      return {
        ...prev,
        lastMessage: message,
        connectionStats: {
          ...prev.connectionStats,
          messageLatency: avgLatency,
          messagesProcessed: prev.connectionStats.messagesProcessed + 1,
          lastMessageTime: new Date(),
        }
      };
    });
  }, []);

  /**
   * Subscribes to a specific channel with callback
   */
  const subscribe = useCallback((
    channel: string,
    callback: (data: ISensorData) => void
  ) => {
    const unsubscribe = context.current.subscribe(channel, callback);
    return () => {
      unsubscribe();
    };
  }, []);

  /**
   * Sends message with queuing capability
   */
  const send = useCallback(async (data: any) => {
    if (!state.isConnected) {
      if (state.messageQueue.length < config.maxMessageBuffer) {
        setState(prev => ({
          ...prev,
          messageQueue: [...prev.messageQueue, data]
        }));
      }
      return;
    }

    try {
      await context.current.send(data);
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error as Error,
        messageQueue: [...prev.messageQueue, data]
      }));
    }
  }, [state.isConnected, state.messageQueue.length, config.maxMessageBuffer]);

  /**
   * Disconnects WebSocket with cleanup
   */
  const disconnect = useCallback(() => {
    context.current.disconnect();
    setState(prev => ({
      ...prev,
      isConnected: false,
      error: null,
    }));
  }, []);

  // Connection health monitoring
  useEffect(() => {
    const healthCheck = setInterval(() => {
      setState(prev => ({
        ...prev,
        connectionStats: {
          ...prev.connectionStats,
          uptime: (Date.now() - startTime.current) / 1000,
        }
      }));
    }, config.healthCheckInterval);

    return () => {
      clearInterval(healthCheck);
    };
  }, [config.healthCheckInterval]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (config.autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [config.autoConnect, connect, disconnect]);

  return {
    isConnected: state.isConnected,
    isReconnecting: state.isReconnecting,
    lastMessage: state.lastMessage,
    error: state.error,
    connectionStats: state.connectionStats,
    messageQueue: state.messageQueue,
    connect,
    disconnect,
    subscribe,
    send,
  };
};

export type { IUseWebSocketOptions, IConnectionStats, IUseWebSocketReturn };