/**
 * @fileoverview Core API service for smart-apparel web application
 * @version 1.0.0
 * 
 * Implements enterprise-grade API communication with comprehensive monitoring,
 * reliability features, and standardized request/response handling.
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'; // v1.4.0
import axiosRetry from 'axios-retry'; // v3.5.0
import CircuitBreaker from 'opossum'; // v7.1.0
import * as metrics from 'prom-client'; // v14.0.0

import { apiConfig } from '../config/api.config';
import { createApiRequest, handleApiError, buildQueryString, deduplicateRequest } from '../utils/api.utils';
import type { IApiResponse, IApiError, IMonitoringMetrics } from '../interfaces/common.interface';

/**
 * Request options interface for enhanced API calls
 */
interface RequestOptions {
  cache?: boolean;
  retry?: boolean;
  timeout?: number;
  deduplicate?: boolean;
  priority?: 'high' | 'medium' | 'low';
}

/**
 * Enhanced API service with monitoring and reliability features
 */
export class ApiService {
  private readonly apiClient: AxiosInstance;
  private readonly breaker: CircuitBreaker;
  private readonly metrics: metrics.Registry;
  private readonly requestLatency: metrics.Histogram;
  private readonly errorRate: metrics.Counter;
  private readonly activeRequests: metrics.Gauge;

  constructor() {
    // Initialize API client with monitoring
    this.apiClient = createApiRequest();
    
    // Configure circuit breaker
    this.breaker = new CircuitBreaker(this.executeRequest.bind(this), {
      timeout: apiConfig.timeout,
      errorThresholdPercentage: 50,
      resetTimeout: 30000
    });

    // Initialize metrics
    this.metrics = new metrics.Registry();
    this.requestLatency = new metrics.Histogram({
      name: 'api_request_duration_seconds',
      help: 'API request duration in seconds',
      labelNames: ['endpoint', 'method']
    });
    this.errorRate = new metrics.Counter({
      name: 'api_request_errors_total',
      help: 'Total count of API request errors',
      labelNames: ['endpoint', 'status']
    });
    this.activeRequests = new metrics.Gauge({
      name: 'api_active_requests',
      help: 'Number of currently active API requests'
    });

    // Register metrics
    this.metrics.registerMetric(this.requestLatency);
    this.metrics.registerMetric(this.errorRate);
    this.metrics.registerMetric(this.activeRequests);
  }

  /**
   * Performs GET request with enhanced monitoring and reliability
   */
  public async get<T>(
    endpoint: string,
    params?: Record<string, any>,
    options: RequestOptions = {}
  ): Promise<IApiResponse<T>> {
    const config: AxiosRequestConfig = {
      method: 'GET',
      url: endpoint,
      params,
      timeout: options.timeout || apiConfig.timeout
    };

    if (options.deduplicate) {
      const cacheKey = `GET:${endpoint}:${JSON.stringify(params)}`;
      return deduplicateRequest(cacheKey, () => this.executeRequest<T>(config, options));
    }

    return this.executeRequest<T>(config, options);
  }

  /**
   * Performs POST request with monitoring
   */
  public async post<T>(
    endpoint: string,
    data: any,
    options: RequestOptions = {}
  ): Promise<IApiResponse<T>> {
    const config: AxiosRequestConfig = {
      method: 'POST',
      url: endpoint,
      data,
      timeout: options.timeout || apiConfig.timeout
    };

    return this.executeRequest<T>(config, options);
  }

  /**
   * Performs PUT request with monitoring
   */
  public async put<T>(
    endpoint: string,
    data: any,
    options: RequestOptions = {}
  ): Promise<IApiResponse<T>> {
    const config: AxiosRequestConfig = {
      method: 'PUT',
      url: endpoint,
      data,
      timeout: options.timeout || apiConfig.timeout
    };

    return this.executeRequest<T>(config, options);
  }

  /**
   * Performs DELETE request with monitoring
   */
  public async delete<T>(
    endpoint: string,
    params?: Record<string, any>,
    options: RequestOptions = {}
  ): Promise<IApiResponse<T>> {
    const config: AxiosRequestConfig = {
      method: 'DELETE',
      url: endpoint,
      params,
      timeout: options.timeout || apiConfig.timeout
    };

    return this.executeRequest<T>(config, options);
  }

  /**
   * Retrieves current API metrics
   */
  public getMetrics(): IMonitoringMetrics {
    return {
      requestLatency: this.requestLatency.get().values[0].value,
      errorRate: this.errorRate.get().values[0].value,
      successRate: 100 - (this.errorRate.get().values[0].value * 100),
      timestamp: new Date(),
      resourceUtilization: {
        cpu: process.cpuUsage().user,
        memory: process.memoryUsage().heapUsed,
        bandwidth: 0 // Would be implemented with actual network metrics
      }
    };
  }

  /**
   * Clears request cache
   */
  public clearCache(): void {
    // Implementation would clear any request caching
  }

  /**
   * Core method to execute requests with monitoring and reliability features
   */
  private async executeRequest<T>(
    config: AxiosRequestConfig,
    options: RequestOptions
  ): Promise<IApiResponse<T>> {
    const startTime = Date.now();
    this.activeRequests.inc();

    try {
      const response = await this.breaker.fire(async () => {
        return this.apiClient.request<T>(config);
      });

      // Record metrics
      const duration = (Date.now() - startTime) / 1000;
      this.requestLatency.observe(
        { endpoint: config.url, method: config.method },
        duration
      );

      return response as IApiResponse<T>;
    } catch (error) {
      this.errorRate.inc({ endpoint: config.url, status: error.response?.status });
      throw handleApiError(error);
    } finally {
      this.activeRequests.dec();
    }
  }
}

// Export singleton instance
export const apiService = new ApiService();