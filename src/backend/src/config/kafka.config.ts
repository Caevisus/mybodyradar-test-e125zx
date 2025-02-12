/**
 * @fileoverview Kafka configuration for real-time sensor data streaming
 * Implements high-throughput, low-latency event processing with support for
 * horizontal scaling and multi-environment deployment.
 * @version 2.2.4 kafkajs
 */

import { Kafka, CompressionTypes } from 'kafkajs';
import { ENVIRONMENT, SYSTEM_TIMEOUTS } from '../constants/system.constants';

/**
 * Kafka topic definitions for different event streams
 */
export const KAFKA_TOPICS = {
  SENSOR_DATA: 'sensor-data-stream',
  ALERTS: 'system-alerts',
  ANALYTICS: 'performance-analytics',
  SYSTEM_HEALTH: 'system-health-metrics'
} as const;

/**
 * Interface defining the complete Kafka configuration structure
 */
interface KafkaConfig {
  clientId: string;
  brokers: string[];
  ssl: boolean;
  sasl: {
    mechanism: string;
    username: string;
    password: string;
  };
  topics: Record<string, string>;
  consumerConfig: {
    groupId: string;
    sessionTimeout: number;
    rebalanceTimeout: number;
    heartbeatInterval: number;
    maxBytesPerPartition: number;
    maxWaitTimeInMs: number;
    autoCommitInterval: number;
    allowAutoTopicCreation: boolean;
    maxInFlightRequests: number;
    readUncommitted: boolean;
    retry: {
      maxRetryTime: number;
      initialRetryTime: number;
      factor: number;
      multiplier: number;
      retries: number;
    };
  };
  producerConfig: {
    compression: CompressionTypes;
    acks: number;
    timeout: number;
    maxInFlightRequests: number;
    idempotent: boolean;
    maxMessageBytes: number;
    retry: {
      maxRetryTime: number;
      initialRetryTime: number;
      factor: number;
      multiplier: number;
      retries: number;
    };
    transactionalId: string;
    transactionTimeout: number;
  };
}

/**
 * Returns environment-specific Kafka configuration
 * @param env - Target environment for configuration
 * @returns Complete Kafka configuration object
 */
const getKafkaConfig = (env: string): KafkaConfig => {
  const baseConfig: KafkaConfig = {
    clientId: 'smart-apparel-platform',
    brokers: [],
    ssl: false,
    sasl: {
      mechanism: 'plain',
      username: '',
      password: ''
    },
    topics: KAFKA_TOPICS,
    consumerConfig: {
      groupId: 'sensor-data-consumers',
      sessionTimeout: SYSTEM_TIMEOUTS.KAFKA_CONSUMER_MS,
      rebalanceTimeout: SYSTEM_TIMEOUTS.KAFKA_CONSUMER_MS * 2,
      heartbeatInterval: SYSTEM_TIMEOUTS.KAFKA_CONSUMER_MS / 3,
      maxBytesPerPartition: 1048576, // 1MB
      maxWaitTimeInMs: 100, // Ensures <100ms latency requirement
      autoCommitInterval: 5000,
      allowAutoTopicCreation: false,
      maxInFlightRequests: 5,
      readUncommitted: false,
      retry: {
        maxRetryTime: 30000,
        initialRetryTime: 1000,
        factor: 1.5,
        multiplier: 1.1,
        retries: 5
      }
    },
    producerConfig: {
      compression: CompressionTypes.GZIP,
      acks: -1, // Ensures exactly-once delivery
      timeout: 30000,
      maxInFlightRequests: 5,
      idempotent: true,
      maxMessageBytes: 1048576, // 1MB
      retry: {
        maxRetryTime: 30000,
        initialRetryTime: 1000,
        factor: 1.5,
        multiplier: 1.1,
        retries: 5
      },
      transactionalId: 'smart-apparel-producer',
      transactionTimeout: 60000
    }
  };

  switch (env) {
    case ENVIRONMENT.PRODUCTION:
      return {
        ...baseConfig,
        brokers: [
          'kafka-1.prod.smartapparel.com:9092',
          'kafka-2.prod.smartapparel.com:9092',
          'kafka-3.prod.smartapparel.com:9092'
        ],
        ssl: true,
        sasl: {
          mechanism: 'scram-sha-512',
          username: process.env.KAFKA_PROD_USERNAME || '',
          password: process.env.KAFKA_PROD_PASSWORD || ''
        }
      };

    case ENVIRONMENT.STAGING:
      return {
        ...baseConfig,
        brokers: [
          'kafka-1.staging.smartapparel.com:9092',
          'kafka-2.staging.smartapparel.com:9092'
        ],
        ssl: true,
        sasl: {
          mechanism: 'scram-sha-256',
          username: process.env.KAFKA_STAGING_USERNAME || '',
          password: process.env.KAFKA_STAGING_PASSWORD || ''
        }
      };

    case ENVIRONMENT.DEVELOPMENT:
    default:
      return {
        ...baseConfig,
        brokers: ['localhost:9092'],
        ssl: false,
        sasl: {
          mechanism: 'plain',
          username: 'admin',
          password: 'admin'
        }
      };
  }
};

/**
 * Export the environment-specific Kafka configuration
 */
export const kafkaConfig = getKafkaConfig(process.env.NODE_ENV || ENVIRONMENT.DEVELOPMENT);