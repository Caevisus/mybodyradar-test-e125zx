/**
 * @fileoverview Main entry point for all GraphQL resolvers in the smart apparel system.
 * Combines and exports resolvers for alerts, athletes, sensors, and sessions with
 * comprehensive performance monitoring and type safety.
 * @version 1.0.0
 */

import { merge } from 'lodash'; // ^4.17.21
import { GraphQLError } from 'graphql'; // ^16.8.0
import { ResolverMetrics } from '@graphql-metrics/core'; // ^1.0.0

import { alertResolvers } from './alert.resolver';
import { AthleteResolver } from './athlete.resolver';
import { SensorResolver } from './sensor.resolver';

// Initialize performance metrics collector
const metrics = new ResolverMetrics({
  latencyThreshold: 100, // 100ms as per technical requirements
  sampleRate: 1.0, // Sample all requests in production
  tags: ['graphql', 'resolvers']
});

/**
 * Wraps resolver functions with performance monitoring
 * @param resolver The resolver function to wrap
 * @param resolverName Name of the resolver for metrics
 * @returns Wrapped resolver with performance monitoring
 */
const wrapResolverWithMetrics = (resolver: Function, resolverName: string) => {
  return async (...args: any[]) => {
    const startTime = process.hrtime.bigint();
    try {
      const result = await resolver(...args);
      const endTime = process.hrtime.bigint();
      const latencyMs = Number(endTime - startTime) / 1_000_000;

      // Record resolver performance metrics
      metrics.recordResolverLatency(resolverName, latencyMs);

      // Log warning if latency exceeds threshold
      if (latencyMs > 100) {
        console.warn(`High latency detected in resolver ${resolverName}: ${latencyMs}ms`);
      }

      return result;
    } catch (error) {
      // Record resolver error metrics
      metrics.recordResolverError(resolverName, error);
      
      // Transform error to GraphQLError with additional context
      throw new GraphQLError(error.message, {
        extensions: {
          code: error.code || 'INTERNAL_SERVER_ERROR',
          resolverName,
          timestamp: new Date().toISOString()
        }
      });
    }
  };
};

/**
 * Wraps all resolvers in an object with performance monitoring
 * @param resolvers Object containing resolver functions
 * @param prefix Prefix for metric names
 * @returns Wrapped resolvers with performance monitoring
 */
const wrapResolversWithMetrics = (resolvers: any, prefix: string) => {
  const wrapped: any = {};

  for (const type of ['Query', 'Mutation', 'Subscription']) {
    if (resolvers[type]) {
      wrapped[type] = {};
      for (const [key, resolver] of Object.entries(resolvers[type])) {
        const resolverName = `${prefix}.${type}.${key}`;
        wrapped[type][key] = wrapResolverWithMetrics(resolver, resolverName);
      }
    }
  }

  return wrapped;
};

// Wrap domain-specific resolvers with performance monitoring
const wrappedAlertResolvers = wrapResolversWithMetrics(alertResolvers, 'Alert');
const wrappedAthleteResolvers = wrapResolversWithMetrics(AthleteResolver, 'Athlete');
const wrappedSensorResolvers = wrapResolversWithMetrics(SensorResolver, 'Sensor');

/**
 * Combined GraphQL resolvers with performance monitoring and type safety
 * Implements real-time data processing with <100ms latency requirement
 */
export const resolvers = merge(
  {},
  wrappedAlertResolvers,
  wrappedAthleteResolvers,
  wrappedSensorResolvers,
  {
    // Root-level resolvers for handling shared types
    Node: {
      __resolveType(obj: any) {
        if (obj.type) return 'Alert';
        if (obj.athleteId) return 'Athlete';
        if (obj.sensorId) return 'Sensor';
        return null;
      }
    },
    
    // Date scalar type resolver
    Date: {
      serialize(value: Date) {
        return value.toISOString();
      },
      parseValue(value: string) {
        return new Date(value);
      },
      parseLiteral(ast: any) {
        if (ast.kind === 'StringValue') {
          return new Date(ast.value);
        }
        return null;
      }
    }
  }
);

// Export metrics collector for monitoring
export { metrics as resolverMetrics };