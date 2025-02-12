/**
 * @fileoverview Comprehensive validation and sanitization utility for the smart apparel system
 * Implements robust data validation with caching and performance optimizations
 * @version 1.0.0
 */

import { validate, validateOrReject, ValidationError } from 'class-validator'; // ^0.14.0
import { sanitize, Expose } from 'class-sanitizer'; // ^2.0.0
import { caching } from 'cache-manager'; // ^5.2.0
import { IAlert } from '../interfaces/alert.interface';
import { IAthlete } from '../interfaces/athlete.interface';
import { ISensorData } from '../interfaces/sensor.interface';
import { ALERT_TYPES, ALERT_SEVERITY, ALERT_THRESHOLDS } from '../constants/alert.constants';
import { SENSOR_TYPES, CALIBRATION_PARAMS } from '../constants/sensor.constants';

// Initialize cache for validation results
const validationCache = caching({
  store: 'memory',
  max: 1000,
  ttl: 300 // 5 minutes cache TTL
});

/**
 * Validates alert data structure with caching support
 * @param alert - Alert object to validate
 * @returns Promise<boolean> - Validation result
 * @throws ValidationError with detailed message if invalid
 */
export async function validateAlert(alert: IAlert): Promise<boolean> {
  const cacheKey = `alert_${alert.id}`;
  const cachedResult = await validationCache.get(cacheKey);
  
  if (cachedResult) {
    return cachedResult as boolean;
  }

  try {
    // Validate alert type
    if (!Object.values(ALERT_TYPES).includes(alert.type)) {
      throw new ValidationError('Invalid alert type');
    }

    // Validate severity
    if (!Object.values(ALERT_SEVERITY).includes(alert.severity)) {
      throw new ValidationError('Invalid alert severity');
    }

    // Validate timestamp
    if (!(alert.timestamp instanceof Date) || isNaN(alert.timestamp.getTime())) {
      throw new ValidationError('Invalid timestamp');
    }

    // Validate threshold based on alert type
    if (alert.details?.threshold) {
      const typeThresholds = ALERT_THRESHOLDS[alert.type];
      if (typeThresholds && alert.details.threshold > typeThresholds[alert.type]) {
        throw new ValidationError('Threshold exceeds maximum allowed value');
      }
    }

    // Validate confidence score
    if (alert.confidenceScore < 0 || alert.confidenceScore > 1) {
      throw new ValidationError('Confidence score must be between 0 and 1');
    }

    await validationCache.set(cacheKey, true);
    return true;
  } catch (error) {
    await validationCache.set(cacheKey, false);
    throw error;
  }
}

/**
 * Validates athlete data with support for nested objects
 * @param athlete - Athlete object to validate
 * @returns Promise<boolean> - Validation result
 * @throws ValidationError with detailed message if invalid
 */
export async function validateAthleteData(athlete: IAthlete): Promise<boolean> {
  const cacheKey = `athlete_${athlete.id}`;
  const cachedResult = await validationCache.get(cacheKey);

  if (cachedResult) {
    return cachedResult as boolean;
  }

  try {
    // Validate required fields
    if (!athlete.id || !athlete.name || !athlete.email) {
      throw new ValidationError('Missing required fields');
    }

    // Validate baseline data
    if (athlete.baselineData) {
      for (const [muscle, profile] of Object.entries(athlete.baselineData.muscleProfiles)) {
        if (profile.value < 0 || profile.confidence > 1) {
          throw new ValidationError(`Invalid muscle profile data for ${muscle}`);
        }
      }
    }

    // Validate preferences
    if (athlete.preferences?.alertThresholds) {
      for (const [metric, threshold] of Object.entries(athlete.preferences.alertThresholds)) {
        if (threshold.value < 0) {
          throw new ValidationError(`Invalid threshold value for ${metric}`);
        }
      }
    }

    // Sanitize text fields
    athlete.name = sanitizeInput(athlete.name);
    if (athlete.team?.name) {
      athlete.team.name = sanitizeInput(athlete.team.name);
    }

    await validationCache.set(cacheKey, true);
    return true;
  } catch (error) {
    await validationCache.set(cacheKey, false);
    throw error;
  }
}

/**
 * Validates sensor data with real-time performance optimization
 * @param sensorData - Sensor data object to validate
 * @returns Promise<boolean> - Validation result
 * @throws ValidationError with detailed message if invalid
 */
export async function validateSensorData(sensorData: ISensorData): Promise<boolean> {
  const cacheKey = `sensor_${sensorData.sensorId}_${sensorData.timestamp}`;
  const cachedResult = await validationCache.get(cacheKey);

  if (cachedResult) {
    return cachedResult as boolean;
  }

  try {
    // Validate sensor ID format
    if (!sensorData.sensorId.match(/^[A-Za-z0-9-]+$/)) {
      throw new ValidationError('Invalid sensor ID format');
    }

    // Validate timestamp
    if (sensorData.timestamp < 0 || sensorData.timestamp > Date.now()) {
      throw new ValidationError('Invalid timestamp');
    }

    // Validate readings array
    if (!Array.isArray(sensorData.readings) || sensorData.readings.length === 0) {
      throw new ValidationError('Invalid readings array');
    }

    // Validate each reading
    for (const reading of sensorData.readings) {
      if (!Object.values(SENSOR_TYPES).includes(reading.type)) {
        throw new ValidationError('Invalid sensor type');
      }

      if (reading.confidence < 0 || reading.confidence > 1) {
        throw new ValidationError('Invalid confidence value');
      }
    }

    // Validate metadata
    if (sensorData.metadata) {
      if (sensorData.metadata.quality < 0 || sensorData.metadata.quality > 100) {
        throw new ValidationError('Invalid quality score');
      }

      if (sensorData.metadata.processingLatency < 0) {
        throw new ValidationError('Invalid processing latency');
      }
    }

    await validationCache.set(cacheKey, true);
    return true;
  } catch (error) {
    await validationCache.set(cacheKey, false);
    throw error;
  }
}

/**
 * Sanitizes input strings with comprehensive security measures
 * @param input - String to sanitize
 * @returns string - Sanitized string
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';

  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');

  // Escape special characters
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  // Remove potential script content
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+=/gi, '');

  // Normalize whitespace
  sanitized = sanitized.trim().replace(/\s+/g, ' ');

  // Remove non-printable characters
  sanitized = sanitized.replace(/[^\x20-\x7E]/g, '');

  return sanitized;
}