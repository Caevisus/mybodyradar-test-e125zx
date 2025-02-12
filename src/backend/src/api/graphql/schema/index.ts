/**
 * @fileoverview Main entry point for GraphQL schema definitions that combines and exports all schema types,
 * queries, mutations and subscriptions for the smart apparel system with enhanced validation and performance optimizations.
 * @version 1.0.0
 */

import { makeExecutableSchema } from '@graphql-tools/schema'; // v9.0.0
import { merge } from '@graphql-tools/merge'; // v9.0.0
import { GraphQLSchema, validateSchema } from 'graphql'; // v16.8.0

// Import individual schema definitions
import { alertSchema } from './alert.schema';
import { athleteSchema } from './athlete.schema';
import { sensorSchema } from './sensor.schema';

/**
 * Base schema containing common types, directives and access control definitions
 */
const BASE_SCHEMA = `
  """
  Custom scalar types for specialized data
  """
  scalar DateTime
  scalar JSON

  """
  Security directives for access control and rate limiting
  """
  directive @auth(requires: Role!) on FIELD_DEFINITION | OBJECT
  directive @rateLimit(max: Int!, window: String!) on FIELD_DEFINITION
  directive @cacheControl(maxAge: Int!, scope: CacheControlScope) on FIELD_DEFINITION | OBJECT

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
  Cache control scope options
  """
  enum CacheControlScope {
    PUBLIC
    PRIVATE
  }

  """
  Common pagination input type
  """
  input PaginationInput {
    offset: Int!
    limit: Int!
    sortBy: String
    sortOrder: SortOrder
  }

  """
  Sort order enum
  """
  enum SortOrder {
    ASC
    DESC
  }

  """
  Common response type for mutations
  """
  type MutationResponse {
    success: Boolean!
    message: String
    code: String
  }

  """
  Common error type
  """
  type Error {
    message: String!
    code: String!
    path: [String!]
  }
`;

/**
 * Schema version for compatibility tracking
 */
const SCHEMA_VERSION = '1.0.0';

/**
 * Validates consistency and completeness of merged schema types
 * @param mergedTypeDefs - Combined GraphQL type definitions
 * @returns boolean indicating schema validity
 */
function validateSchemaTypes(mergedTypeDefs: any): boolean {
  try {
    // Create temporary schema for validation
    const tempSchema = makeExecutableSchema({
      typeDefs: mergedTypeDefs,
      // Add empty resolvers to prevent validation errors
      resolvers: {}
    });

    // Validate schema
    const validationErrors = validateSchema(tempSchema);
    if (validationErrors.length > 0) {
      console.error('Schema validation errors:', validationErrors);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Schema validation failed:', error);
    return false;
  }
}

/**
 * Creates optimized executable GraphQL schema with validation
 * Implements comprehensive type system with security controls
 * @returns Validated and executable GraphQL schema
 */
function createSchema(): GraphQLSchema {
  try {
    // Merge all type definitions
    const mergedTypeDefs = merge([
      BASE_SCHEMA,
      alertSchema,
      athleteSchema,
      sensorSchema
    ]);

    // Validate merged schema types
    if (!validateSchemaTypes(mergedTypeDefs)) {
      throw new Error('Schema validation failed');
    }

    // Create executable schema with security directives and caching
    const schema = makeExecutableSchema({
      typeDefs: mergedTypeDefs,
      schemaDirectives: {
        auth: require('../directives/auth'),
        rateLimit: require('../directives/rate-limit'),
        cacheControl: require('../directives/cache-control')
      },
      inheritResolversFromInterfaces: true,
      resolverValidationOptions: {
        requireResolversForResolveType: false
      }
    });

    // Add schema metadata
    Object.defineProperty(schema, 'version', {
      value: SCHEMA_VERSION,
      writable: false
    });

    return schema;
  } catch (error) {
    console.error('Failed to create schema:', error);
    throw error;
  }
}

// Export validated and optimized GraphQL schema
export const schema = createSchema();

// Export individual schemas for testing and development
export {
  alertSchema,
  athleteSchema,
  sensorSchema
};