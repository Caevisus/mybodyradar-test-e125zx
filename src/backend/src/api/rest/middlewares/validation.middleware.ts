/**
 * @fileoverview Express middleware for request validation and sanitization
 * Implements comprehensive data integrity checks and security measures
 * with performance optimization and detailed error handling
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import { validate } from 'class-validator'; // ^0.14.0
import { sanitize } from 'class-sanitizer'; // ^2.0.0
import { validateAlert, validateAthleteData, validateSensorData } from '../../../utils/validation.util';
import { HttpError, ErrorCodes } from './error.middleware';
import { PERFORMANCE_THRESHOLDS } from '../../../constants/system.constants';
import now from 'performance-now'; // ^2.1.0

/**
 * Cache for validation results to optimize performance
 * Implements <100ms latency requirement
 */
const validationCache = new Map<string, {
  result: boolean;
  timestamp: number;
}>();

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const CACHE_TTL = 300000;

/**
 * Generates a cache key for validation results
 */
const generateCacheKey = (req: Request): string => {
  return `${req.method}_${req.path}_${JSON.stringify(req.body)}`;
};

/**
 * Cleans expired cache entries
 */
const cleanCache = (): void => {
  const now = Date.now();
  for (const [key, value] of validationCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      validationCache.delete(key);
    }
  }
};

/**
 * Validates and sanitizes request parameters
 */
const validateParams = (params: any): boolean => {
  if (!params) return true;
  
  for (const [key, value] of Object.entries(params)) {
    // Validate parameter format
    if (typeof value === 'string' && !value.match(/^[A-Za-z0-9-_]+$/)) {
      throw new HttpError(
        400,
        `Invalid parameter format: ${key}`,
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }
  return true;
};

/**
 * Validates request query parameters
 */
const validateQuery = (query: any): boolean => {
  if (!query) return true;

  const allowedOperators = ['eq', 'gt', 'lt', 'gte', 'lte', 'in', 'between'];
  
  for (const [key, value] of Object.entries(query)) {
    // Validate query operators
    if (key.includes('_') && !allowedOperators.includes(key.split('_')[1])) {
      throw new HttpError(
        400,
        `Invalid query operator: ${key}`,
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }
  return true;
};

/**
 * Main validation middleware with performance optimization
 * Implements comprehensive request validation and security measures
 */
export const validateRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = now();
  const cacheKey = generateCacheKey(req);

  try {
    // Check cache for existing validation result
    const cachedResult = validationCache.get(cacheKey);
    if (cachedResult && (Date.now() - cachedResult.timestamp < CACHE_TTL)) {
      if (!cachedResult.result) {
        throw new HttpError(
          400,
          'Validation failed (cached)',
          ErrorCodes.VALIDATION_ERROR
        );
      }
      return next();
    }

    // Validate URL parameters
    validateParams(req.params);

    // Validate query parameters
    validateQuery(req.query);

    // Validate request body based on endpoint type
    if (req.body) {
      let isValid = false;

      switch (req.path) {
        case '/api/alerts':
          isValid = await validateAlert(req.body);
          break;
        case '/api/athletes':
          isValid = await validateAthleteData(req.body);
          break;
        case '/api/sensor-data':
          isValid = await validateSensorData(req.body);
          break;
        default:
          // Generic validation for other endpoints
          const validationErrors = await validate(req.body);
          isValid = validationErrors.length === 0;
          if (!isValid) {
            throw new HttpError(
              400,
              'Validation failed',
              ErrorCodes.VALIDATION_ERROR,
              validationErrors
            );
          }
      }

      if (!isValid) {
        throw new HttpError(
          400,
          'Validation failed',
          ErrorCodes.VALIDATION_ERROR
        );
      }
    }

    // Sanitize request body
    if (req.body) {
      sanitize(req.body);
    }

    // Cache successful validation result
    validationCache.set(cacheKey, {
      result: true,
      timestamp: Date.now()
    });

    // Clean cache periodically
    if (Math.random() < 0.1) { // 10% chance to trigger cleanup
      cleanCache();
    }

    // Check performance threshold
    const processingTime = now() - startTime;
    if (processingTime > PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS) {
      console.warn(`Validation processing time exceeded threshold: ${processingTime}ms`);
    }

    next();
  } catch (error) {
    // Cache failed validation result
    validationCache.set(cacheKey, {
      result: false,
      timestamp: Date.now()
    });

    if (error instanceof HttpError) {
      next(error);
    } else {
      next(new HttpError(
        500,
        'Internal validation error',
        ErrorCodes.INTERNAL_ERROR,
        error
      ));
    }
  }
};

/**
 * Specialized validation middleware for alert requests
 * Implements real-time validation with priority handling
 */
export const validateAlertRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = now();

  try {
    if (!req.body) {
      throw new HttpError(
        400,
        'Missing alert data',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const isValid = await validateAlert(req.body);
    if (!isValid) {
      throw new HttpError(
        400,
        'Alert validation failed',
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Check performance for real-time requirements
    const processingTime = now() - startTime;
    if (processingTime > PERFORMANCE_THRESHOLDS.MAX_LATENCY_MS) {
      console.warn(`Alert validation exceeded latency threshold: ${processingTime}ms`);
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default validateRequest;