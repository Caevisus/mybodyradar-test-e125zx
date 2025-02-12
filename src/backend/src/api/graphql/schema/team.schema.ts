/**
 * @fileoverview GraphQL schema definitions for team-related types, queries, mutations and subscriptions
 * Implements comprehensive team management with enhanced security controls and analytics support
 * @version 1.0.0
 */

import { gql } from 'graphql-tag'; // v2.12.6
import { ITeam } from '../../../interfaces/team.interface';
import { IAthlete } from '../../../interfaces/athlete.interface';

/**
 * Input types for team operations with validation rules
 */
const INPUT_TYPES = gql`
  input TimeRangeInput {
    startDate: DateTime!
    endDate: DateTime!
    resolution: TimeResolution = DAILY
  }

  input CreateTeamInput {
    name: String!
    settings: TeamSettingsInput!
    initialAdmins: [ID!]!
  }

  input UpdateTeamInput {
    name: String
    settings: TeamSettingsInput
    addMembers: [ID!]
    removeMembers: [ID!]
  }

  input TeamSettingsInput {
    alertThresholds: AlertThresholdsInput
    notificationPreferences: NotificationPreferencesInput
    dataRetentionPolicy: RetentionPolicyInput
    analyticsConfig: AnalyticsConfigInput
  }

  input AlertThresholdsInput {
    intensityThreshold: Float
    fatigueThreshold: Float
    anomalyThreshold: Float
    technicalScoreThreshold: Float
  }

  input NotificationPreferencesInput {
    email: Boolean
    push: Boolean
    sms: Boolean
    allowedHours: [String!]
    alertTypes: [String!]
  }

  input RetentionPolicyInput {
    hotStorageDays: Int!
    warmStorageDays: Int!
    coldStorageDays: Int!
  }

  input AnalyticsConfigInput {
    realTimeWindowMinutes: Int!
    aggregationPeriodHours: Int!
    enabledMetrics: [String!]!
  }

  enum TimeResolution {
    HOURLY
    DAILY
    WEEKLY
    MONTHLY
  }

  enum MetricType {
    INTENSITY
    FATIGUE
    TECHNICAL_SCORE
    ANOMALY_COUNT
    PARTICIPATION_RATE
  }
`;

/**
 * Core type definitions for team-related entities
 */
const TYPE_DEFINITIONS = gql`
  type Team @auth(requires: TEAM_MEMBER) {
    id: ID!
    name: String!
    settings: TeamSettings! @auth(requires: TEAM_ADMIN)
    stats: TeamStats! @auth(requires: COACH)
    members: [Athlete!]! @auth(requires: TEAM_ADMIN)
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type TeamSettings {
    alertThresholds: AlertThresholds!
    notificationPreferences: NotificationPreferences!
    dataRetentionPolicy: RetentionPolicy! @auth(requires: ADMIN)
    analyticsConfig: AnalyticsConfig! @auth(requires: COACH)
  }

  type AlertThresholds {
    intensityThreshold: Float!
    fatigueThreshold: Float!
    anomalyThreshold: Float!
    technicalScoreThreshold: Float!
  }

  type NotificationPreferences {
    email: Boolean!
    push: Boolean!
    sms: Boolean!
    allowedHours: [String!]!
    alertTypes: [String!]!
  }

  type RetentionPolicy @auth(requires: ADMIN) {
    hotStorageDays: Int!
    warmStorageDays: Int!
    coldStorageDays: Int!
  }

  type AnalyticsConfig @auth(requires: COACH) {
    realTimeWindowMinutes: Int!
    aggregationPeriodHours: Int!
    enabledMetrics: [String!]!
  }

  type TeamStats @auth(requires: COACH) {
    totalAthletes: Int!
    activeSessions: Int!
    alertsToday: Int!
    lastUpdated: DateTime!
    performanceMetrics: PerformanceMetrics!
    realtimeAnalytics: RealtimeAnalytics!
    historicalTrends: [TrendData!]!
  }

  type PerformanceMetrics {
    averageIntensity: Float!
    averageFatigue: Float!
    averageTechnicalScore: Float!
    participationRate: Float!
  }

  type RealtimeAnalytics {
    activeUsers: Int!
    currentIntensity: Float!
    anomalyCount: Int!
    sensorHealth: SensorHealth!
  }

  type SensorHealth {
    imuHealth: Float!
    tofHealth: Float!
    overallHealth: Float!
  }

  type TrendData {
    timestamp: DateTime!
    metrics: MetricValues!
    alerts: Int!
    participation: Float!
  }

  type MetricValues {
    intensity: Float!
    fatigue: Float!
    technicalScore: Float!
    anomalyCount: Int!
  }
`;

/**
 * Query definitions with security directives
 */
const QUERIES = gql`
  type Query {
    getTeam(id: ID!): Team @auth(requires: TEAM_MEMBER)
    listTeams: [Team!]! @auth(requires: USER)
    getTeamStats(
      id: ID!
      timeRange: TimeRangeInput!
    ): TeamStats! @auth(requires: COACH)
    getTeamMembers(
      id: ID!
      active: Boolean
    ): [Athlete!]! @auth(requires: TEAM_ADMIN)
  }
`;

/**
 * Mutation definitions with security directives and audit logging
 */
const MUTATIONS = gql`
  type Mutation {
    createTeam(
      input: CreateTeamInput!
    ): Team! @auth(requires: ADMIN) @log(type: "TEAM_CREATE")

    updateTeam(
      id: ID!
      input: UpdateTeamInput!
    ): Team! @auth(requires: TEAM_ADMIN) @log(type: "TEAM_UPDATE")

    deleteTeam(
      id: ID!
    ): Boolean! @auth(requires: ADMIN) @log(type: "TEAM_DELETE")

    addTeamMembers(
      teamId: ID!
      memberIds: [ID!]!
    ): Team! @auth(requires: TEAM_ADMIN) @log(type: "MEMBER_ADD")

    removeTeamMembers(
      teamId: ID!
      memberIds: [ID!]!
    ): Team! @auth(requires: TEAM_ADMIN) @log(type: "MEMBER_REMOVE")

    updateTeamSettings(
      teamId: ID!
      settings: TeamSettingsInput!
    ): Team! @auth(requires: TEAM_ADMIN) @log(type: "SETTINGS_UPDATE")
  }
`;

/**
 * Subscription definitions for real-time updates
 */
const SUBSCRIPTIONS = gql`
  type Subscription {
    teamStatsUpdated(
      id: ID!
      metrics: [MetricType!]
    ): TeamStats! @auth(requires: COACH)

    teamMembershipChanged(
      id: ID!
    ): Team! @auth(requires: TEAM_ADMIN)

    teamAlertsTriggered(
      id: ID!
      severity: AlertSeverity
    ): Alert! @auth(requires: COACH)
  }

  enum AlertSeverity {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  type Alert {
    id: ID!
    teamId: ID!
    type: String!
    severity: AlertSeverity!
    message: String!
    timestamp: DateTime!
    metadata: JSON
  }
`;

/**
 * Creates and exports the complete team schema with all type definitions
 */
export const teamSchema = gql`
  scalar DateTime
  scalar JSON

  ${INPUT_TYPES}
  ${TYPE_DEFINITIONS}
  ${QUERIES}
  ${MUTATIONS}
  ${SUBSCRIPTIONS}

  directive @auth(requires: Role!) on OBJECT | FIELD_DEFINITION
  directive @log(type: String!) on FIELD_DEFINITION

  enum Role {
    USER
    TEAM_MEMBER
    TEAM_ADMIN
    COACH
    ADMIN
  }
`;