/**
 * @fileoverview Enhanced session management service for smart-apparel system
 * Implements real-time monitoring, data collection, and session lifecycle management
 * with comprehensive error handling and performance monitoring
 * @version 1.0.0
 */

import { injectable } from 'inversify'; // v6.0.1
import { BehaviorSubject, Observable, Subscription } from 'rxjs'; // v7.8.1
import { retry, catchError, timeout } from 'rxjs/operators'; // v7.8.1
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

import { ISession, ISessionConfig, ISessionMetrics } from '../interfaces/session.interface';
import { ApiService } from './api.service';
import { WebSocketService } from './websocket.service';
import { API_ENDPOINTS, REQUEST_CONFIG } from '../constants/api.constants';

/**
 * Enhanced session service managing training session lifecycle with real-time data,
 * error handling, and performance monitoring
 */
@injectable()
export class SessionService {
  private currentSession: BehaviorSubject<ISession | null>;
  private dataSubscriptions: Map<string, Subscription>;
  private readonly retryAttempts: number;
  private readonly timeoutMs: number;

  constructor(
    private readonly apiService: ApiService,
    private readonly wsService: WebSocketService
  ) {
    this.currentSession = new BehaviorSubject<ISession | null>(null);
    this.dataSubscriptions = new Map();
    this.retryAttempts = REQUEST_CONFIG.RETRY_ATTEMPTS;
    this.timeoutMs = REQUEST_CONFIG.TIMEOUT;
  }

  /**
   * Starts a new training session with enhanced error handling and monitoring
   * @param athleteId Unique identifier of the athlete
   * @param config Session configuration parameters
   * @returns Promise resolving to created session
   */
  public async startSession(
    athleteId: string,
    config: ISessionConfig
  ): Promise<ISession> {
    try {
      const correlationId = uuidv4();
      
      // Create session via API
      const response = await this.apiService.post<ISession>(
        API_ENDPOINTS.SESSION.CREATE,
        {
          athleteId,
          config,
          correlationId
        },
        {
          retry: true,
          timeout: this.timeoutMs,
          priority: 'high'
        }
      );

      const session = response.data;
      this.currentSession.next(session);

      // Set up real-time data subscriptions
      await this.setupSessionSubscriptions(session.id);

      return session;
    } catch (error) {
      console.error('Failed to start session:', error);
      throw error;
    }
  }

  /**
   * Ends current session with cleanup and monitoring
   * @param sessionId Session identifier
   */
  public async endSession(sessionId: string): Promise<void> {
    try {
      await this.apiService.put(
        API_ENDPOINTS.SESSION.END,
        { sessionId },
        { retry: true }
      );

      // Cleanup subscriptions
      this.cleanupSessionSubscriptions(sessionId);
      this.currentSession.next(null);
    } catch (error) {
      console.error('Failed to end session:', error);
      throw error;
    }
  }

  /**
   * Retrieves current session metrics with caching
   * @param sessionId Session identifier
   * @returns Promise resolving to session metrics
   */
  public async getSessionMetrics(sessionId: string): Promise<ISessionMetrics> {
    try {
      const response = await this.apiService.get<ISessionMetrics>(
        `${API_ENDPOINTS.SESSION.DETAILS}/${sessionId}/metrics`,
        undefined,
        {
          cache: true,
          timeout: this.timeoutMs
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to fetch session metrics:', error);
      throw error;
    }
  }

  /**
   * Subscribes to real-time session metrics with enhanced reliability
   * @param sessionId Session identifier
   * @param callback Function to handle incoming metrics
   * @returns Cleanup function for subscription
   */
  public subscribeToMetrics(
    sessionId: string,
    callback: (metrics: ISessionMetrics) => void
  ): () => void {
    const subscription = this.wsService.subscribeSensorData(
      sessionId,
      (data) => {
        callback(this.processMetrics(data));
      },
      {
        buffer: true,
        priority: 'high'
      }
    );

    this.dataSubscriptions.set(sessionId, subscription);
    return () => this.cleanupSessionSubscriptions(sessionId);
  }

  /**
   * Gets current session as observable
   * @returns Observable of current session
   */
  public getCurrentSession(): Observable<ISession | null> {
    return this.currentSession.asObservable();
  }

  /**
   * Updates session configuration with monitoring
   * @param sessionId Session identifier
   * @param config Updated configuration
   */
  public async updateSessionConfig(
    sessionId: string,
    config: Partial<ISessionConfig>
  ): Promise<void> {
    try {
      await this.apiService.put(
        API_ENDPOINTS.SESSION.UPDATE,
        { sessionId, config },
        { retry: true }
      );

      const currentSession = this.currentSession.value;
      if (currentSession && currentSession.id === sessionId) {
        this.currentSession.next({
          ...currentSession,
          config: { ...currentSession.config, ...config }
        });
      }
    } catch (error) {
      console.error('Failed to update session config:', error);
      throw error;
    }
  }

  /**
   * Sets up WebSocket subscriptions for session data
   * @param sessionId Session identifier
   */
  private async setupSessionSubscriptions(sessionId: string): Promise<void> {
    try {
      // Subscribe to session updates
      const sessionSubscription = this.wsService.subscribeSensorData(
        sessionId,
        (data) => {
          const currentSession = this.currentSession.value;
          if (currentSession && currentSession.id === sessionId) {
            this.currentSession.next({
              ...currentSession,
              metrics: this.processMetrics(data)
            });
          }
        },
        { priority: 'high' }
      );

      this.dataSubscriptions.set(sessionId, sessionSubscription);
    } catch (error) {
      console.error('Failed to setup session subscriptions:', error);
      throw error;
    }
  }

  /**
   * Processes raw sensor data into session metrics
   * @param data Raw sensor data
   * @returns Processed session metrics
   */
  private processMetrics(data: any): ISessionMetrics {
    // Implementation would process raw sensor data into metrics
    // based on session configuration and requirements
    return {
      muscleActivity: {},
      forceDistribution: {},
      rangeOfMotion: {},
      anomalyScores: {},
      alertTriggers: {}
    };
  }

  /**
   * Cleans up session subscriptions and resources
   * @param sessionId Session identifier
   */
  private cleanupSessionSubscriptions(sessionId: string): void {
    const subscription = this.dataSubscriptions.get(sessionId);
    if (subscription) {
      subscription();
      this.dataSubscriptions.delete(sessionId);
    }
  }
}