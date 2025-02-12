/**
 * @fileoverview GraphQL schema definitions for athlete-related types, queries, mutations, and subscriptions
 * Implements comprehensive data model with enhanced security, privacy controls, and real-time monitoring
 */

import { gql } from 'graphql-tag'; // ^2.12.6
import { GraphQLScalarType } from 'graphql'; // ^16.8.0
import { schemaDirectives } from '@graphql-tools/schema'; // ^9.0.0
import { IAthlete } from '../../../interfaces/athlete.interface';
import { SENSOR_TYPES } from '../../../constants/sensor.constants';

/**
 * Custom Date scalar for handling ISO-8601 compliant dates
 */
export const dateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'ISO-8601 compliant date scalar type',
  serialize(value: Date): string {
    return value.toISOString();
  },
  parseValue(value: string): Date {
    return new Date(value);
  },
  parseLiteral(ast): Date | null {
    if (ast.kind === 'StringValue') {
      return new Date(ast.value);
    }
    return null;
  },
});

/**
 * Custom JSON scalar for complex data structures
 */
export const jsonScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'JSON scalar type for complex data structures',
  serialize(value: any): string {
    return JSON.stringify(value);
  },
  parseValue(value: string): any {
    return JSON.parse(value);
  },
  parseLiteral(ast): any {
    if (ast.kind === 'StringValue') {
      return JSON.parse(ast.value);
    }
    return null;
  },
});

/**
 * GraphQL schema type definitions with enhanced security directives and real-time capabilities
 */
export const athleteTypeDefs = gql`
  scalar Date
  scalar JSON

  """
  Security directives for field-level access control
  """
  directive @auth(requires: Role!) on FIELD_DEFINITION
  directive @rateLimit(max: Int!, window: String!) on FIELD_DEFINITION

  """
  System roles for access control
  """
  enum Role {
    ADMIN
    COACH
    MEDICAL
    ATHLETE
    USER
  }

  """
  Comprehensive baseline data with biomechanical measurements
  """
  type BaselineData @auth(requires: USER) {
    muscleProfiles: JSON!
    rangeOfMotion: JSON!
    forceDistribution: JSON!
    biomechanicalMetrics: JSON!
    sensorCalibration: JSON!
    confidenceScores: JSON!
    lastUpdated: Date!
    calibrationStatus: String!
  }

  """
  Enhanced athlete preferences with privacy controls
  """
  type AthletePreferences @auth(requires: USER) {
    alertThresholds: JSON!
    notificationSettings: JSON!
    dataSharing: JSON!
    privacyControls: JSON!
    consentSettings: JSON!
    lastUpdated: Date!
  }

  """
  Core athlete type with comprehensive data model
  """
  type Athlete @auth(requires: USER) {
    id: ID!
    name: String!
    email: String! @auth(requires: ADMIN)
    team: Team!
    baselineData: BaselineData! @auth(requires: USER)
    preferences: AthletePreferences!
    sessions: [Session!]! @auth(requires: USER)
    performanceMetrics: JSON @auth(requires: USER)
    privacySettings: JSON! @auth(requires: USER)
    createdAt: Date!
    updatedAt: Date!
  }

  """
  Input types for mutations
  """
  input BaselineInput {
    muscleProfiles: JSON
    rangeOfMotion: JSON
    forceDistribution: JSON
    biomechanicalMetrics: JSON
    sensorCalibration: JSON
  }

  input PreferencesInput {
    alertThresholds: JSON
    notificationSettings: JSON
    dataSharing: JSON
    privacyControls: JSON
    consentSettings: JSON
  }

  input AthleteInput {
    name: String!
    email: String!
    teamId: ID!
    baselineData: BaselineInput
    preferences: PreferencesInput
  }

  input PrivacyInput {
    dataEncrypted: Boolean
    consentedPurposes: [String!]
    sharingPreferences: JSON
  }

  """
  Queries with role-based access control
  """
  type Query {
    athlete(id: ID!): Athlete @auth(requires: USER)
    athletes: [Athlete!]! @auth(requires: COACH)
    athletesByTeam(teamId: ID!): [Athlete!]! @auth(requires: COACH)
    athleteBaseline(id: ID!): BaselineData @auth(requires: USER)
    athletePerformance(id: ID!): JSON @auth(requires: USER)
    athletePrivacySettings(id: ID!): JSON @auth(requires: USER)
  }

  """
  Mutations with enhanced security and validation
  """
  type Mutation {
    createAthlete(input: AthleteInput!): Athlete 
      @auth(requires: ADMIN)
      @rateLimit(max: 50, window: "1h")
    
    updateAthlete(id: ID!, input: AthleteInput!): Athlete 
      @auth(requires: USER)
      @rateLimit(max: 100, window: "1h")
    
    updateBaseline(id: ID!, data: BaselineInput!): BaselineData 
      @auth(requires: USER)
      @rateLimit(max: 50, window: "1h")
    
    updatePreferences(id: ID!, prefs: PreferencesInput!): AthletePreferences 
      @auth(requires: USER)
      @rateLimit(max: 100, window: "1h")
    
    updatePrivacySettings(id: ID!, settings: PrivacyInput!): JSON 
      @auth(requires: USER)
      @rateLimit(max: 50, window: "1h")
  }

  """
  Real-time subscriptions with rate limiting
  """
  type Subscription {
    athleteBaselineUpdated(id: ID!): BaselineData 
      @auth(requires: USER)
      @rateLimit(max: 100, window: "1m")
    
    athletePerformanceMetrics(id: ID!): JSON 
      @auth(requires: USER)
      @rateLimit(max: 100, window: "1m")
    
    athleteAlerts(id: ID!): JSON 
      @auth(requires: USER)
      @rateLimit(max: 100, window: "1m")
    
    sensorStatus(id: ID!): JSON 
      @auth(requires: USER)
      @rateLimit(max: 60, window: "1m")
  }
`;