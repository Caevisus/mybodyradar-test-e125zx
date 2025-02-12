/**
 * @fileoverview GraphQL schema definitions for training session management
 * Implements real-time monitoring, performance analytics, and alert system capabilities
 * Version: 1.0.0
 */

import { gql } from 'graphql-tag'; // v2.12.6
import { GraphQLObjectType, GraphQLSchema } from 'graphql'; // v16.8.0
import { ISession, ISessionConfig } from '../../../interfaces/session.interface';
import { ISensorData } from '../../../interfaces/sensor.interface';

/**
 * GraphQL schema definition for comprehensive session management
 * Implements real-time monitoring and analytics requirements
 */
export const sessionSchema = gql`
  """
  Enum for supported session types
  """
  enum SessionType {
    TRAINING
    ASSESSMENT
    RECOVERY
  }

  """
  Enum for session status tracking
  """
  enum SessionStatus {
    SCHEDULED
    IN_PROGRESS
    COMPLETED
    CANCELLED
  }

  """
  Enum for metric types in performance monitoring
  """
  enum MetricType {
    MUSCLE_ACTIVITY
    FORCE_DISTRIBUTION
    RANGE_OF_MOTION
    KINEMATIC
  }

  """
  Enum for alert severity levels
  """
  enum AlertLevel {
    INFO
    WARNING
    CRITICAL
  }

  """
  Type defining comprehensive performance metrics
  """
  type SessionMetrics {
    muscleActivity: MuscleActivityMetrics!
    forceDistribution: ForceDistributionMetrics!
    rangeOfMotion: RangeOfMotionMetrics!
    anomalyScores: AnomalyScores!
    performanceIndicators: PerformanceIndicators!
  }

  """
  Type for muscle activity monitoring
  """
  type MuscleActivityMetrics {
    current: Float!
    baseline: Float!
    variance: Float!
    timestamp: DateTime!
  }

  """
  Type for force distribution analysis
  """
  type ForceDistributionMetrics {
    magnitude: Float!
    direction: Float!
    balance: Float!
    timestamp: DateTime!
  }

  """
  Type for range of motion tracking
  """
  type RangeOfMotionMetrics {
    current: Float!
    baseline: Float!
    deviation: Float!
    timestamp: DateTime!
  }

  """
  Type for anomaly detection scores
  """
  type AnomalyScores {
    score: Float!
    confidence: Float!
    timestamp: DateTime!
    type: MetricType!
  }

  """
  Type for key performance indicators
  """
  type PerformanceIndicators {
    value: Float!
    trend: Float!
    threshold: Float!
    metricType: MetricType!
  }

  """
  Type for session configuration
  """
  type SessionConfig {
    type: SessionType!
    alertThresholds: AlertThresholds!
    samplingRates: SamplingRates!
    dataRetention: DataRetention!
  }

  """
  Type for alert threshold configuration
  """
  type AlertThresholds {
    warning: Float!
    critical: Float!
    sensitivity: Float!
    metricType: MetricType!
  }

  """
  Type for sensor sampling configuration
  """
  type SamplingRates {
    rate: Int!
    precision: Float!
    sensorType: String!
  }

  """
  Type for data retention policy
  """
  type DataRetention {
    duration: Int!
    granularity: String!
  }

  """
  Type for comprehensive session data
  """
  type Session {
    id: ID!
    athleteId: ID!
    startTime: DateTime!
    endTime: DateTime
    config: SessionConfig!
    metrics: SessionMetrics!
    status: SessionStatus!
    statusHistory: [StatusHistoryEntry!]!
  }

  """
  Type for session status history
  """
  type StatusHistoryEntry {
    status: SessionStatus!
    timestamp: DateTime!
  }

  """
  Input type for session creation
  """
  input CreateSessionInput {
    athleteId: ID!
    type: SessionType!
    config: SessionConfigInput!
  }

  """
  Input type for session configuration
  """
  input SessionConfigInput {
    alertThresholds: [AlertThresholdInput!]!
    samplingRates: [SamplingRateInput!]!
    dataRetention: DataRetentionInput!
  }

  """
  Input type for alert threshold configuration
  """
  input AlertThresholdInput {
    warning: Float!
    critical: Float!
    sensitivity: Float!
    metricType: MetricType!
  }

  """
  Input type for sampling rate configuration
  """
  input SamplingRateInput {
    rate: Int!
    precision: Float!
    sensorType: String!
  }

  """
  Input type for data retention configuration
  """
  input DataRetentionInput {
    duration: Int!
    granularity: String!
  }

  """
  Queries for session management
  """
  type Query {
    session(id: ID!): Session!
    athleteSessions(athleteId: ID!, status: SessionStatus): [Session!]!
    sessionMetrics(sessionId: ID!, metricType: MetricType!): SessionMetrics!
    sessionAlerts(sessionId: ID!, level: AlertLevel): [Alert!]!
  }

  """
  Mutations for session management
  """
  type Mutation {
    createSession(input: CreateSessionInput!): Session!
    startSession(id: ID!): Session!
    endSession(id: ID!): Session!
    updateSessionConfig(id: ID!, config: SessionConfigInput!): Session!
    shareSessionData(sessionId: ID!, recipientId: ID!, metrics: [MetricType!]!): Boolean!
  }

  """
  Subscriptions for real-time updates
  """
  type Subscription {
    sessionMetricsUpdate(sessionId: ID!): SessionMetrics!
    sessionAlerts(sessionId: ID!, level: AlertLevel): Alert!
    sessionStatusChange(sessionId: ID!): Session!
  }

  """
  Type for alert notifications
  """
  type Alert {
    id: ID!
    sessionId: ID!
    level: AlertLevel!
    metricType: MetricType!
    value: Float!
    threshold: Float!
    timestamp: DateTime!
  }

  """
  Custom scalar for DateTime handling
  """
  scalar DateTime
`;

export default sessionSchema;