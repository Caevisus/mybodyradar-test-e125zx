/**
 * @fileoverview Common TypeScript interfaces and types for the smart-apparel system
 * Provides comprehensive type definitions for cross-cutting concerns, API communication,
 * monitoring, and component standardization across the web frontend application
 * @version 1.0.0
 */

import { SENSOR_STATUS } from '../constants/sensor.constants';
import type { UUID } from 'crypto'; // v20.0.0+

/**
 * Supported sort orders for data queries
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Generic API response wrapper with monitoring capabilities
 * Ensures <100ms latency tracking and comprehensive error handling
 */
export interface IApiResponse<T = any> {
  success: boolean;
  data: T;
  error?: IApiError;
  timestamp: Date;
  latency: number; // Response time in milliseconds
  requestId: UUID;
  metadata?: {
    cache?: boolean;
    source?: string;
    region?: string;
  };
}

/**
 * Comprehensive error interface for API responses
 * Includes detailed debugging information for error tracking
 */
export interface IApiError {
  code: string;
  message: string;
  details: Record<string, any>;
  stack?: string;
  timestamp: Date;
  context?: {
    component?: string;
    action?: string;
    params?: Record<string, any>;
  };
}

/**
 * Enhanced pagination parameters interface
 * Supports complex data querying and filtering
 */
export interface IPaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: SortOrder;
  filters?: Record<string, any>;
  search?: string;
  fields?: string[];
}

/**
 * Comprehensive device status monitoring interface
 * Tracks real-time sensor health and performance metrics
 */
export interface IDeviceStatus {
  deviceId: UUID;
  status: SENSOR_STATUS;
  lastSeen: Date;
  batteryLevel: number; // Percentage
  signalStrength: number; // dBm
  firmwareVersion: string;
  calibrationStatus: SENSOR_STATUS;
  metrics?: {
    dataRate: number; // Samples per second
    errorCount: number;
    uptime: number; // Seconds
  };
}

/**
 * System-wide monitoring metrics interface
 * Supports observability requirements with detailed performance tracking
 */
export interface IMonitoringMetrics {
  requestLatency: number; // Milliseconds
  errorRate: number; // Percentage
  successRate: number; // Percentage
  timestamp: Date;
  resourceUtilization?: {
    cpu: number; // Percentage
    memory: number; // Bytes
    bandwidth: number; // Bytes per second
  };
  customMetrics?: Record<string, number>;
}

/**
 * Real-time data stream configuration interface
 * Ensures compliance with <100ms latency requirement
 */
export interface IStreamConfig {
  bufferSize: number;
  sampleRate: number;
  compression?: boolean;
  priority: 'high' | 'medium' | 'low';
  qos: 0 | 1 | 2; // MQTT QoS levels
}

/**
 * Rate limiting configuration interface
 * Implements API rate limiting requirements
 */
export interface IRateLimitConfig {
  windowMs: number;
  maxRequests: number;
  errorMessage?: string;
  headers?: boolean;
  keyGenerator?: (req: any) => string;
}

/**
 * Health check response interface
 * Supports system monitoring and availability tracking
 */
export interface IHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  version: string;
  checks: {
    database?: boolean;
    cache?: boolean;
    messaging?: boolean;
    sensors?: boolean;
  };
  metrics: IMonitoringMetrics;
}

/**
 * Audit log entry interface
 * Tracks system activities for compliance and debugging
 */
export interface IAuditLog {
  id: UUID;
  timestamp: Date;
  action: string;
  userId?: UUID;
  resourceType: string;
  resourceId: UUID;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Component loading state interface
 * Standardizes loading state management across components
 */
export interface ILoadingState {
  isLoading: boolean;
  progress?: number;
  message?: string;
  error?: IApiError;
}

/**
 * WebSocket message interface
 * Supports real-time communication requirements
 */
export interface IWebSocketMessage<T = any> {
  type: string;
  payload: T;
  timestamp: Date;
  sessionId: UUID;
  sequence: number;
}