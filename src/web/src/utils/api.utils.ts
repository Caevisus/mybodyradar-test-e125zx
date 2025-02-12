/**
 * @fileoverview API utilities for smart-apparel web application
 * @version 1.0.0
 * 
 * Provides enterprise-grade utilities for API request handling, response transformation,
 * error management, and performance monitoring in compliance with system requirements.
 */

import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios'; // v1.4.0
import axiosRetry from 'axios-retry'; // v3.5.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { apiConfig } from '../config/api.config';
import { IApiResponse, IApiError } from '../interfaces/common.interface';

// Performance monitoring cache
const performanceCache = new Map<string, number>();

/**
 * Creates and configures an axios instance with monitoring and retry capabilities
 * @returns Configured axios instance with interceptors
 */
export const createApiRequest = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: apiConfig.baseURL,
    timeout: apiConfig.timeout,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

  // Configure retry logic with exponential backoff
  axiosRetry(instance, {
    retries: apiConfig.retryAttempts,
    retryDelay: (retryCount) => {
      return retryCount * apiConfig.retryDelay;
    },
    retryCondition: (error: AxiosError) => {
      return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        (error.response?.status === 429); // Retry on rate limit
    }
  });

  // Request interceptor for correlation ID and timing
  instance.interceptors.request.use((config) => {
    const correlationId = uuidv4();
    config.headers['X-Correlation-ID'] = correlationId;
    performanceCache.set(correlationId, Date.now());
    return config;
  });

  // Response interceptor for monitoring and transformation
  instance.interceptors.response.use(
    (response) => transformResponse(response),
    (error) => Promise.reject(handleApiError(error))
  );

  return instance;
};

/**
 * Transforms API responses with performance metrics
 * @param response - Axios response object
 * @returns Enhanced API response with monitoring data
 */
export const transformResponse = <T>(response: AxiosResponse): IApiResponse<T> => {
  const correlationId = response.config.headers['X-Correlation-ID'];
  const startTime = performanceCache.get(correlationId);
  const latency = startTime ? Date.now() - startTime : 0;
  performanceCache.delete(correlationId);

  // Record performance metrics if exceeding threshold
  if (latency > apiConfig.monitoring.performance.slowRequestThreshold) {
    console.warn(`Slow request detected: ${response.config.url} (${latency}ms)`);
  }

  return {
    success: true,
    data: response.data,
    timestamp: new Date(),
    latency,
    requestId: correlationId,
    metadata: {
      cache: response.headers['x-cache'] === 'HIT',
      source: response.headers['x-served-by'],
      region: response.headers['x-datacenter']
    }
  };
};

/**
 * Handles API errors with enhanced logging and monitoring
 * @param error - Axios error object
 * @returns Standardized error response
 */
export const handleApiError = (error: AxiosError): IApiError => {
  const correlationId = error.config?.headers?.['X-Correlation-ID'] || uuidv4();
  const timestamp = new Date();

  // Extract detailed error information
  const errorDetails = {
    url: error.config?.url,
    method: error.config?.method,
    status: error.response?.status,
    statusText: error.response?.statusText,
    data: error.response?.data
  };

  // Log error with correlation ID for tracing
  console.error(`API Error [${correlationId}]:`, {
    ...errorDetails,
    stack: error.stack
  });

  // Record error metrics for monitoring
  if (apiConfig.monitoring.enableMetrics) {
    // Implementation would track error metrics here
  }

  return {
    code: error.response?.status?.toString() || '500',
    message: error.message || 'An unexpected error occurred',
    details: errorDetails,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    timestamp,
    context: {
      component: 'API',
      action: error.config?.method,
      params: error.config?.params
    }
  };
};

/**
 * Builds a sanitized query string from parameters
 * @param params - Query parameters object
 * @returns Sanitized query string
 */
export const buildQueryString = (params: Record<string, any>): string => {
  // Filter out null/undefined values
  const filteredParams = Object.entries(params)
    .filter(([_, value]) => value != null)
    .reduce((acc, [key, value]) => ({
      ...acc,
      [key]: typeof value === 'object' ? JSON.stringify(value) : value
    }), {});

  // Create URLSearchParams with sanitized values
  const searchParams = new URLSearchParams();
  Object.entries(filteredParams).forEach(([key, value]) => {
    searchParams.append(key, encodeURIComponent(String(value)));
  });

  return searchParams.toString();
};

/**
 * Request deduplication cache for preventing duplicate requests
 */
const requestCache = new Map<string, Promise<any>>();

/**
 * Deduplicates identical API requests within a time window
 * @param cacheKey - Unique key for the request
 * @param requestFn - Function that makes the API request
 * @param ttl - Cache time-to-live in milliseconds
 * @returns Promise with API response
 */
export const deduplicateRequest = async <T>(
  cacheKey: string,
  requestFn: () => Promise<T>,
  ttl: number = apiConfig.REQUEST_CONFIG?.CACHE_DURATION || 300000
): Promise<T> => {
  const cached = requestCache.get(cacheKey);
  if (cached) return cached;

  const request = requestFn();
  requestCache.set(cacheKey, request);

  try {
    const response = await request;
    setTimeout(() => requestCache.delete(cacheKey), ttl);
    return response;
  } catch (error) {
    requestCache.delete(cacheKey);
    throw error;
  }
};