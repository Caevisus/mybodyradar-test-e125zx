/**
 * @fileoverview Redis configuration for the smart-apparel platform
 * Implements high-availability cluster mode with automatic failover support
 * Version: ioredis@5.3.0
 */

import { Redis } from 'ioredis';
import { ENVIRONMENT } from '../constants/system.constants';

/**
 * Base Redis configuration for standalone mode
 * Optimized for real-time data processing with <100ms latency
 */
export const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB) || 0,
  connectTimeout: 10000,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  keepAlive: 10000,
  lazyConnect: true,
  showFriendlyErrorStack: process.env.NODE_ENV !== ENVIRONMENT.PRODUCTION,
  reconnectOnError: (err: Error) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 200, 2000);
    return delay;
  }
};

/**
 * Redis cluster configuration for high-availability
 * Supports horizontal scaling up to 100k concurrent users
 */
export const REDIS_CLUSTER_CONFIG = {
  nodes: [
    {
      host: process.env.REDIS_PRIMARY_HOST,
      port: parseInt(process.env.REDIS_PRIMARY_PORT)
    },
    {
      host: process.env.REDIS_SECONDARY_HOST,
      port: parseInt(process.env.REDIS_SECONDARY_PORT)
    }
  ],
  options: {
    maxRedirections: 16,
    retryDelayOnFailover: 300,
    retryDelayOnClusterDown: 1000,
    enableReadyCheck: true,
    scaleReads: 'all',
    clusterRetryStrategy: (times: number) => Math.min(times * 100, 3000),
    redisOptions: {
      password: process.env.REDIS_CLUSTER_PASSWORD,
      tls: process.env.NODE_ENV === ENVIRONMENT.PRODUCTION,
      connectTimeout: 10000,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
      commandTimeout: 5000
    }
  }
};

/**
 * Creates and configures a Redis client with enhanced error handling
 * @param options - Redis client configuration options
 * @returns Configured Redis client instance
 */
export const createRedisClient = (options: Partial<Redis.RedisOptions> = {}): Redis => {
  const config = {
    ...REDIS_CONFIG,
    ...options
  };

  const client = new Redis(config);

  client.on('connect', () => {
    console.info('Redis client connected successfully');
  });

  client.on('error', (err: Error) => {
    console.error('Redis client error:', err);
  });

  client.on('ready', () => {
    console.info('Redis client ready for operations');
  });

  client.on('close', () => {
    console.warn('Redis client connection closed');
  });

  return client;
};

/**
 * Creates a Redis cluster client with automatic failover support
 * @param options - Redis cluster configuration options
 * @returns Configured Redis cluster client
 */
export const createClusterClient = (options: Partial<Redis.ClusterOptions> = {}): Redis.Cluster => {
  const config = {
    ...REDIS_CLUSTER_CONFIG,
    ...options
  };

  const cluster = new Redis.Cluster(config.nodes, {
    ...config.options,
    clusterRetryStrategy: (times: number) => {
      const delay = Math.min(times * 100, 3000);
      console.warn(`Cluster connection attempt ${times}, retrying in ${delay}ms`);
      return delay;
    }
  });

  cluster.on('connect', () => {
    console.info('Redis cluster connected successfully');
  });

  cluster.on('error', (err: Error) => {
    console.error('Redis cluster error:', err);
  });

  cluster.on('node error', (err: Error, node: Redis) => {
    console.error(`Redis cluster node error on ${node.options.host}:${node.options.port}:`, err);
  });

  cluster.on('+node', (node: Redis) => {
    console.info(`Redis cluster node added: ${node.options.host}:${node.options.port}`);
  });

  cluster.on('-node', (node: Redis) => {
    console.warn(`Redis cluster node removed: ${node.options.host}:${node.options.port}`);
  });

  return cluster;
};

/**
 * Export Redis configuration and client creation utilities
 */
export const redisConfig = {
  createRedisClient,
  createClusterClient,
  REDIS_CONFIG,
  REDIS_CLUSTER_CONFIG
};

export default redisConfig;