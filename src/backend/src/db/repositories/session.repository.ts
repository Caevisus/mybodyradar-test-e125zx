/**
 * @fileoverview Repository class implementing data access patterns for training session management
 * with enhanced performance optimizations and data retention policies.
 */

import { InfluxDB, Point } from '@influxdata/influxdb-client'; // v1.33.0
import Redis from 'ioredis'; // v5.3.0
import { trace, Span } from '@opentelemetry/api'; // v1.4.0
import { ISession, ISessionMetrics } from '../../interfaces/session.interface';
import { SessionModel } from '../models/session.model';
import { mongoConfig, influxConfig } from '../../config/database.config';
import { PERFORMANCE_THRESHOLDS, DATA_RETENTION } from '../../constants/system.constants';

/**
 * Repository class implementing data access patterns for training sessions
 * with enhanced performance and retention features
 */
export class SessionRepository {
  private readonly _influxClient: InfluxDB;
  private readonly _cacheClient: Redis;
  private readonly _bucket: string;
  private readonly _org: string;
  private readonly _tracer;
  private readonly _writeApi;
  private readonly _queryApi;

  /**
   * Initializes repository with database connections and monitoring
   */
  constructor(
    influxClient: InfluxDB,
    cacheClient: Redis,
    bucket: string,
    org: string
  ) {
    this._influxClient = influxClient;
    this._cacheClient = cacheClient;
    this._bucket = bucket;
    this._org = org;
    this._tracer = trace.getTracer('session-repository');
    this._writeApi = this._influxClient.getWriteApi(this._org, this._bucket, 'ms');
    this._queryApi = this._influxClient.getQueryApi(this._org);

    // Configure write API with retention policy
    this._writeApi.useDefaultTags({ retention: 'hot' });
  }

  /**
   * Creates a new training session with optimized storage
   */
  async createSession(sessionData: ISession): Promise<ISession> {
    const span = this._tracer.startSpan('createSession');
    try {
      // Start MongoDB transaction
      const session = await SessionModel.startSession();
      session.startTransaction();

      try {
        // Create MongoDB document
        const createdSession = await SessionModel.create([sessionData], { session });

        // Initialize InfluxDB measurement
        const point = new Point('session_metrics')
          .tag('session_id', createdSession[0].id)
          .tag('athlete_id', sessionData.athleteId)
          .timestamp(new Date());

        await this._writeApi.writePoint(point);

        // Set initial cache entry
        await this._cacheClient.setex(
          `session:${createdSession[0].id}`,
          DATA_RETENTION.HOT_STORAGE_DAYS * 24 * 60 * 60,
          JSON.stringify(createdSession[0])
        );

        await session.commitTransaction();
        return createdSession[0];
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        await session.endSession();
      }
    } catch (error) {
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Updates real-time session metrics with caching
   */
  async updateSessionMetrics(sessionId: string, metrics: ISessionMetrics): Promise<void> {
    const span = this._tracer.startSpan('updateSessionMetrics');
    const startTime = Date.now();

    try {
      // Update cache first for fast access
      await this._cacheClient.setex(
        `session:${sessionId}:metrics`,
        DATA_RETENTION.HOT_STORAGE_DAYS * 24 * 60 * 60,
        JSON.stringify(metrics)
      );

      // Write to InfluxDB
      const point = new Point('session_metrics')
        .tag('session_id', sessionId)
        .timestamp(new Date());

      // Add all metric values
      Object.entries(metrics.muscleActivity).forEach(([muscle, data]) => {
        point
          .floatField(`muscle_activity_${muscle}_current`, data.current)
          .floatField(`muscle_activity_${muscle}_baseline`, data.baseline)
          .floatField(`muscle_activity_${muscle}_variance`, data.variance);
      });

      await this._writeApi.writePoint(point);

      // Asynchronously update MongoDB
      await SessionModel.updateOne(
        { _id: sessionId },
        { $set: { metrics } },
        { maxTimeMS: PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS }
      );

      // Record latency metrics
      const latency = Date.now() - startTime;
      span.setAttribute('latency_ms', latency);

    } catch (error) {
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Ends session with data retention management
   */
  async endSession(sessionId: string): Promise<ISession> {
    const span = this._tracer.startSpan('endSession');
    
    try {
      // Update session status
      const session = await SessionModel.findById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      session.endTime = new Date();
      session.status.current = 'DISCONNECTED';
      session.status.history.push({
        status: 'DISCONNECTED',
        timestamp: new Date()
      });

      // Apply retention policy
      const retentionSpan = this._tracer.startSpan('applyRetentionPolicy');
      try {
        // Move data to appropriate storage tier
        await this._writeApi.writePoint(
          new Point('session_archive')
            .tag('session_id', sessionId)
            .tag('retention', 'warm')
            .timestamp(session.endTime)
        );

        // Clear hot cache after retention period
        await this._cacheClient.expire(
          `session:${sessionId}`,
          DATA_RETENTION.HOT_STORAGE_DAYS * 24 * 60 * 60
        );

        await this._cacheClient.expire(
          `session:${sessionId}:metrics`,
          DATA_RETENTION.HOT_STORAGE_DAYS * 24 * 60 * 60
        );

      } finally {
        retentionSpan.end();
      }

      const updatedSession = await session.save();
      return updatedSession;

    } catch (error) {
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }
}