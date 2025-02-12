/**
 * @fileoverview Enhanced WebSocket service for real-time bidirectional communication
 * Implements reliable data streaming with reconnection logic, message queuing,
 * and connection health monitoring to meet <100ms latency requirements
 * @version 1.0.0
 */

import { injectable } from 'inversify';
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { ISensorData } from '../interfaces/sensor.interface';
import { ISession } from '../interfaces/session.interface';
import { IWebSocketMessage, IStreamConfig } from '../interfaces/common.interface';

// WebSocket configuration constants
const WS_CONFIG = {
  RECONNECT_ATTEMPTS: 5,
  RECONNECT_INTERVAL: 1000,
  HEARTBEAT_INTERVAL: 30000,
  MESSAGE_QUEUE_SIZE: 1000,
  CONNECTION_TIMEOUT: 5000,
} as const;

/**
 * Enhanced WebSocket service managing real-time data streaming with reliability features
 * Supports high-frequency sensor data (IMU 200Hz, ToF 100Hz) with message queuing
 */
@injectable()
export class WebSocketService {
  private ws: WebSocket | null = null;
  private eventEmitter: EventEmitter;
  private reconnectAttempts: number = 0;
  private isConnected: boolean = false;
  private messageQueue: Array<IWebSocketMessage> = [];
  private lastHeartbeat: number = Date.now();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private subscriptions: Map<string, Set<Function>> = new Map();
  private connectionMonitor: NodeJS.Timeout | null = null;

  constructor() {
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(50); // Support multiple concurrent subscriptions
  }

  /**
   * Establishes WebSocket connection with enhanced retry mechanism
   * @param url WebSocket server URL
   * @param options Connection options including stream configuration
   */
  public async connect(url: string, options: IStreamConfig = {
    bufferSize: 1024,
    sampleRate: 200,
    compression: true,
    priority: 'high',
    qos: 2
  }): Promise<void> {
    if (this.isConnected) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url, {
          handshakeTimeout: WS_CONFIG.CONNECTION_TIMEOUT,
          ...options
        });

        this.ws.onopen = () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.setupHeartbeat();
          this.processQueuedMessages();
          this.eventEmitter.emit('connected');
          resolve();
        };

        this.ws.onclose = () => {
          this.handleDisconnection();
        };

        this.ws.onerror = (error) => {
          this.eventEmitter.emit('error', error);
          if (!this.isConnected) {
            reject(error);
          }
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.setupConnectionMonitoring();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Gracefully closes WebSocket connection with cleanup
   */
  public async disconnect(): Promise<void> {
    if (!this.isConnected || !this.ws) {
      return;
    }

    return new Promise((resolve) => {
      this.clearHeartbeat();
      this.clearConnectionMonitoring();
      
      this.ws!.close(1000, 'Client disconnecting');
      this.ws!.onclose = () => {
        this.isConnected = false;
        this.ws = null;
        this.eventEmitter.emit('disconnected');
        resolve();
      };
    });
  }

  /**
   * Subscribes to sensor data with enhanced reliability
   * @param sensorId Unique sensor identifier
   * @param callback Function to handle incoming sensor data
   * @param options Subscription options including data buffering
   */
  public subscribeSensorData(
    sensorId: string,
    callback: (data: ISensorData) => void,
    options: { buffer?: boolean; priority?: 'high' | 'medium' | 'low' } = {}
  ): () => void {
    if (!this.subscriptions.has(sensorId)) {
      this.subscriptions.set(sensorId, new Set());
    }

    this.subscriptions.get(sensorId)!.add(callback);
    this.sendMessage({
      type: 'subscribe',
      payload: { sensorId, options },
      timestamp: new Date(),
      sessionId: '', // Will be set by server
      sequence: 0
    });

    return () => {
      this.subscriptions.get(sensorId)?.delete(callback);
      if (this.subscriptions.get(sensorId)?.size === 0) {
        this.subscriptions.delete(sensorId);
        this.sendMessage({
          type: 'unsubscribe',
          payload: { sensorId },
          timestamp: new Date(),
          sessionId: '',
          sequence: 0
        });
      }
    };
  }

  /**
   * Sends message with queuing and retry capability
   * @param message WebSocket message to send
   * @param options Message sending options
   */
  public async sendMessage(
    message: IWebSocketMessage,
    options: { retry?: boolean; timeout?: number } = {}
  ): Promise<void> {
    if (!this.isConnected) {
      if (this.messageQueue.length < WS_CONFIG.MESSAGE_QUEUE_SIZE) {
        this.messageQueue.push(message);
      } else {
        this.eventEmitter.emit('error', new Error('Message queue full'));
      }
      return;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Message send timeout'));
      }, options.timeout || 5000);

      try {
        this.ws!.send(JSON.stringify(message), (error) => {
          clearTimeout(timeout);
          if (error) {
            if (options.retry) {
              this.messageQueue.push(message);
            }
            reject(error);
          } else {
            resolve();
          }
        });
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Sets up heartbeat mechanism for connection health monitoring
   */
  private setupHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.sendMessage({
          type: 'heartbeat',
          payload: { timestamp: Date.now() },
          timestamp: new Date(),
          sessionId: '',
          sequence: 0
        }).catch(() => this.handleDisconnection());
      }
    }, WS_CONFIG.HEARTBEAT_INTERVAL);
  }

  /**
   * Handles incoming WebSocket messages with type safety
   * @param data Raw message data
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message: IWebSocketMessage = JSON.parse(data.toString());
      this.lastHeartbeat = Date.now();

      switch (message.type) {
        case 'sensorData':
          const sensorData = message.payload as ISensorData;
          this.subscriptions.get(sensorData.sensorId)?.forEach(callback => {
            callback(sensorData);
          });
          break;

        case 'sessionUpdate':
          const sessionUpdate = message.payload as ISession;
          this.eventEmitter.emit('sessionUpdate', sessionUpdate);
          break;

        case 'error':
          this.eventEmitter.emit('error', message.payload);
          break;
      }
    } catch (error) {
      this.eventEmitter.emit('error', error);
    }
  }

  /**
   * Handles disconnection with reconnection logic
   */
  private handleDisconnection(): void {
    this.isConnected = false;
    this.clearHeartbeat();
    this.eventEmitter.emit('disconnected');

    if (this.reconnectAttempts < WS_CONFIG.RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      const delay = this.reconnectAttempts * WS_CONFIG.RECONNECT_INTERVAL;
      setTimeout(() => {
        this.connect(this.ws!.url)
          .catch(() => this.handleDisconnection());
      }, delay);
    } else {
      this.eventEmitter.emit('error', new Error('Max reconnection attempts reached'));
    }
  }

  /**
   * Processes queued messages after reconnection
   */
  private processQueuedMessages(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message, { retry: true })
          .catch(() => this.messageQueue.unshift(message));
      }
    }
  }

  /**
   * Sets up connection health monitoring
   */
  private setupConnectionMonitoring(): void {
    this.connectionMonitor = setInterval(() => {
      const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;
      if (timeSinceLastHeartbeat > WS_CONFIG.HEARTBEAT_INTERVAL * 2) {
        this.handleDisconnection();
      }
    }, WS_CONFIG.HEARTBEAT_INTERVAL);
  }

  /**
   * Cleans up heartbeat interval
   */
  private clearHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Cleans up connection monitoring
   */
  private clearConnectionMonitoring(): void {
    if (this.connectionMonitor) {
      clearInterval(this.connectionMonitor);
      this.connectionMonitor = null;
    }
  }
}