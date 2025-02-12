/**
 * @fileoverview Database configuration for MongoDB and InfluxDB connections
 * Implements polyglot persistence strategy with optimized settings for both
 * document storage and time series data management.
 */

import mongoose from 'mongoose'; // v7.5.0
import { InfluxDB } from '@influxdata/influxdb-client'; // v1.33.0
import { ENVIRONMENT, SYSTEM_TIMEOUTS } from '../constants/system.constants';

/**
 * MongoDB configuration for different environments
 */
export const mongoConfig = {
  [ENVIRONMENT.DEVELOPMENT]: {
    uri: 'mongodb://localhost:27017/smart_apparel_dev',
    options: {
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: SYSTEM_TIMEOUTS.DATABASE_MS,
      connectTimeoutMS: SYSTEM_TIMEOUTS.DATABASE_MS,
      serverSelectionTimeoutMS: SYSTEM_TIMEOUTS.DATABASE_MS,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      writeConcern: { w: 'majority' },
      readPreference: 'primaryPreferred',
      autoIndex: true,
      replicaSet: undefined,
    }
  },
  [ENVIRONMENT.PRODUCTION]: {
    uri: process.env.MONGODB_URI!,
    options: {
      maxPoolSize: 100,
      minPoolSize: 10,
      socketTimeoutMS: SYSTEM_TIMEOUTS.DATABASE_MS,
      connectTimeoutMS: SYSTEM_TIMEOUTS.DATABASE_MS,
      serverSelectionTimeoutMS: SYSTEM_TIMEOUTS.DATABASE_MS,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      writeConcern: { w: 'majority' },
      readPreference: 'primaryPreferred',
      autoIndex: false,
      replicaSet: process.env.MONGODB_REPLICA_SET,
      ssl: true,
      authSource: 'admin',
    }
  }
} as const;

/**
 * InfluxDB configuration for different environments
 */
export const influxConfig = {
  [ENVIRONMENT.DEVELOPMENT]: {
    url: 'http://localhost:8086',
    token: 'dev_token',
    org: 'smart_apparel',
    bucket: 'sensor_data_dev',
    retentionPolicy: {
      hot: '7d',  // 7 days hot storage
      warm: '30d', // 30 days warm storage
      cold: '180d' // 180 days cold storage
    },
    batchSize: 5000,
    flushInterval: 1000,
    maxRetries: 3,
    maxBufferSize: 10000
  },
  [ENVIRONMENT.PRODUCTION]: {
    url: process.env.INFLUXDB_URL!,
    token: process.env.INFLUXDB_TOKEN!,
    org: process.env.INFLUXDB_ORG!,
    bucket: process.env.INFLUXDB_BUCKET!,
    retentionPolicy: {
      hot: '7d',
      warm: '30d',
      cold: '180d'
    },
    batchSize: 10000,
    flushInterval: 1000,
    maxRetries: 5,
    maxBufferSize: 50000
  }
} as const;

/**
 * Creates and configures MongoDB connection with advanced settings
 * @param env - Current environment
 * @returns Promise<mongoose.Connection>
 */
export async function createMongoConnection(env: ENVIRONMENT): Promise<mongoose.Connection> {
  const config = mongoConfig[env];

  // Configure mongoose global settings
  mongoose.set('debug', env === ENVIRONMENT.DEVELOPMENT);
  mongoose.set('strictQuery', true);

  try {
    const connection = await mongoose.createConnection(config.uri, config.options);

    // Connection event handlers
    connection.on('connected', () => {
      console.log('MongoDB connected successfully');
    });

    connection.on('error', (error) => {
      console.error('MongoDB connection error:', error);
    });

    connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    // Graceful shutdown handling
    process.on('SIGINT', async () => {
      await connection.close();
      process.exit(0);
    });

    return connection;
  } catch (error) {
    console.error('Failed to create MongoDB connection:', error);
    throw error;
  }
}

/**
 * Creates and configures InfluxDB connection with optimized settings
 * @param env - Current environment
 * @returns InfluxDB
 */
export function createInfluxConnection(env: ENVIRONMENT): InfluxDB {
  const config = influxConfig[env];

  try {
    const client = new InfluxDB({
      url: config.url,
      token: config.token,
      timeout: SYSTEM_TIMEOUTS.DATABASE_MS,
      transportOptions: {
        maxRetries: config.maxRetries,
        minTimeout: 1000,
        maxTimeout: 15000,
        retryJitter: 100
      }
    });

    // Configure write API options
    const writeApi = client.getWriteApi(config.org, config.bucket, 'ms', {
      batchSize: config.batchSize,
      flushInterval: config.flushInterval,
      maxBufferSize: config.maxBufferSize,
      maxRetries: config.maxRetries,
      defaultTags: {
        environment: env
      }
    });

    // Error handling for write operations
    writeApi.on('error', error => {
      console.error('InfluxDB write error:', error);
    });

    // Periodic health check
    setInterval(async () => {
      try {
        const health = await client.ping();
        if (!health) {
          console.warn('InfluxDB health check failed');
        }
      } catch (error) {
        console.error('InfluxDB health check error:', error);
      }
    }, 30000);

    return client;
  } catch (error) {
    console.error('Failed to create InfluxDB connection:', error);
    throw error;
  }
}