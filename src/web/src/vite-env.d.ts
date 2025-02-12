/// <reference types="vite/client" version="^4.3.9" />

/**
 * Type definitions for environment variables used in the smart-apparel web application.
 * Provides strict typing for configuration across development, staging and production environments.
 */
interface ImportMetaEnv {
  /** Base URL for REST API endpoints */
  readonly VITE_API_URL: string;

  /** WebSocket server URL for real-time data */
  readonly VITE_WEBSOCKET_URL: string;

  /** GraphQL API endpoint URL */
  readonly VITE_GRAPHQL_URL: string;

  /** Authentication provider domain */
  readonly VITE_AUTH_DOMAIN: string;

  /** OAuth 2.0 client identifier */
  readonly VITE_AUTH_CLIENT_ID: string;

  /** OAuth 2.0 API audience identifier */
  readonly VITE_AUTH_AUDIENCE: string;

  /** Current deployment environment */
  readonly VITE_ENVIRONMENT: 'development' | 'staging' | 'production';

  /** Sensor data sampling rate in Hz */
  readonly VITE_SENSOR_SAMPLE_RATE: number;

  /** Maximum allowed concurrent WebSocket connections */
  readonly VITE_MAX_CONCURRENT_CONNECTIONS: number;

  /** Threshold for generating performance alerts */
  readonly VITE_ALERT_THRESHOLD: number;

  /** Number of days to retain historical data */
  readonly VITE_DATA_RETENTION_DAYS: number;

  /** Interval for heat map visualization updates in ms */
  readonly VITE_HEAT_MAP_UPDATE_INTERVAL: number;

  /** Interval for performance metrics updates in ms */
  readonly VITE_PERFORMANCE_METRICS_INTERVAL: number;

  /** Maximum number of historical data points to display */
  readonly VITE_MAX_HISTORICAL_DATA_POINTS: number;

  /** Interval for team data synchronization in ms */
  readonly VITE_TEAM_DATA_SYNC_INTERVAL: number;
}

/**
 * Extends the ImportMeta interface to include environment variable types
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}