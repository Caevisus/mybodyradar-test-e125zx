/**
 * @fileoverview Utility functions for input validation, data validation, and form validation
 * Implements WCAG 2.1 Level AA compliance and sensor data validation requirements
 * @version 1.0.0
 */

import { isEmail, isStrongPassword } from 'validator'; // v13.11.0
import { IApiError } from '../interfaces/common.interface';
import { INPUT_VALIDATION, ERROR_MESSAGES, SENSOR_VALIDATION, SESSION_VALIDATION, ALERT_VALIDATION } from '../constants/validation.constants';

/**
 * Interface for validation results with accessibility support
 */
export interface IValidationResult {
  isValid: boolean;
  error?: IApiError;
}

/**
 * Interface for sensor data validation
 */
interface ISensorData {
  type: 'imu' | 'tof';
  samplingRate: number;
  values: number[];
  timestamp: number;
  signalStrength: number;
}

/**
 * Interface for session configuration
 */
interface ISessionConfig {
  duration: number;
  restInterval: number;
  sets: number;
  reps: number;
  concurrent: number;
}

/**
 * Validates email format with WCAG 2.1 Level AA compliance
 * @param email - Email address to validate
 * @returns boolean indicating if email is valid
 */
export const validateEmail = (email: string): boolean => {
  if (!email) return false;
  return isEmail(email) && INPUT_VALIDATION.EMAIL_PATTERN.test(email);
};

/**
 * Validates password strength with accessibility considerations
 * @param password - Password to validate
 * @returns IValidationResult with validation status and error message
 */
export const validatePassword = (password: string): IValidationResult => {
  if (!password) {
    return {
      isValid: false,
      error: {
        code: 'INVALID_PASSWORD',
        message: ERROR_MESSAGES.INVALID_PASSWORD,
        details: { field: 'password' },
        timestamp: new Date()
      }
    };
  }

  const isValidLength = password.length >= INPUT_VALIDATION.MIN_PASSWORD_LENGTH && 
                       password.length <= INPUT_VALIDATION.MAX_PASSWORD_LENGTH;

  const isStrong = isStrongPassword(password, {
    minLength: INPUT_VALIDATION.MIN_PASSWORD_LENGTH,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1
  });

  return {
    isValid: isValidLength && isStrong,
    error: !isValidLength || !isStrong ? {
      code: 'INVALID_PASSWORD',
      message: ERROR_MESSAGES.INVALID_PASSWORD,
      details: { field: 'password' },
      timestamp: new Date()
    } : undefined
  };
};

/**
 * Validates sensor data against defined thresholds and sampling rates
 * @param sensorData - Sensor data object to validate
 * @returns IValidationResult with validation status and error message
 */
export const validateSensorData = (sensorData: ISensorData): IValidationResult => {
  const expectedRate = sensorData.type === 'tof' ? 
    SENSOR_VALIDATION.TOF_SAMPLING_RATE : 
    SENSOR_VALIDATION.IMU_SAMPLING_RATE;

  const isValidRate = Math.abs(sensorData.samplingRate - expectedRate) <= 1;
  const isValidRange = sensorData.values.every(value => 
    value >= SENSOR_VALIDATION.MIN_FORCE_VALUE && 
    value <= SENSOR_VALIDATION.MAX_FORCE_VALUE
  );
  const isValidSignal = sensorData.signalStrength >= SENSOR_VALIDATION.MIN_SIGNAL_STRENGTH;

  if (!isValidRate || !isValidRange || !isValidSignal) {
    return {
      isValid: false,
      error: {
        code: 'INVALID_SENSOR_DATA',
        message: ERROR_MESSAGES.INVALID_SENSOR_DATA,
        details: {
          type: sensorData.type,
          samplingRate: sensorData.samplingRate,
          expectedRate,
          signalStrength: sensorData.signalStrength
        },
        timestamp: new Date()
      }
    };
  }

  return { isValid: true };
};

/**
 * Validates session configuration parameters with accessibility support
 * @param config - Session configuration object to validate
 * @returns IValidationResult with validation status and error message
 */
export const validateSessionConfig = (config: ISessionConfig): IValidationResult => {
  const isValidDuration = config.duration >= SESSION_VALIDATION.MIN_SESSION_DURATION && 
                         config.duration <= SESSION_VALIDATION.MAX_SESSION_DURATION;

  const isValidRest = config.restInterval >= SESSION_VALIDATION.MIN_REST_INTERVAL && 
                     config.restInterval <= SESSION_VALIDATION.MAX_REST_INTERVAL;

  const isValidSets = config.sets >= SESSION_VALIDATION.MIN_SETS && 
                     config.sets <= SESSION_VALIDATION.MAX_SETS;

  const isValidReps = config.reps >= SESSION_VALIDATION.MIN_REPS && 
                     config.reps <= SESSION_VALIDATION.MAX_REPS;

  const isValidConcurrent = config.concurrent <= SESSION_VALIDATION.MAX_CONCURRENT_SESSIONS;

  if (!isValidDuration || !isValidRest || !isValidSets || !isValidReps || !isValidConcurrent) {
    return {
      isValid: false,
      error: {
        code: 'INVALID_SESSION_CONFIG',
        message: ERROR_MESSAGES.INVALID_SESSION_DURATION,
        details: {
          duration: config.duration,
          restInterval: config.restInterval,
          sets: config.sets,
          reps: config.reps,
          concurrent: config.concurrent
        },
        timestamp: new Date()
      }
    };
  }

  return { isValid: true };
};

/**
 * Validates alert configuration with accessibility considerations
 * @param title - Alert title
 * @param message - Alert message
 * @param priority - Alert priority level
 * @returns IValidationResult with validation status and error message
 */
export const validateAlertConfig = (
  title: string,
  message: string,
  priority: string
): IValidationResult => {
  const isValidTitle = title.length >= ALERT_VALIDATION.MIN_TITLE_LENGTH && 
                      title.length <= ALERT_VALIDATION.MAX_TITLE_LENGTH;

  const isValidMessage = message.length >= ALERT_VALIDATION.MIN_MESSAGE_LENGTH && 
                        message.length <= ALERT_VALIDATION.MAX_MESSAGE_LENGTH;

  const isValidPriority = ALERT_VALIDATION.ALERT_PRIORITY_LEVELS.includes(priority as any);

  if (!isValidTitle || !isValidMessage || !isValidPriority) {
    return {
      isValid: false,
      error: {
        code: 'INVALID_ALERT_CONFIG',
        message: 'Invalid alert configuration',
        details: {
          title: isValidTitle ? undefined : 'Invalid title length',
          message: isValidMessage ? undefined : 'Invalid message length',
          priority: isValidPriority ? undefined : 'Invalid priority level'
        },
        timestamp: new Date()
      }
    };
  }

  return { isValid: true };
};

/**
 * Sanitizes input string to prevent XSS attacks
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  return input
    .replace(INPUT_VALIDATION.INPUT_SANITIZATION_PATTERN, '')
    .slice(0, INPUT_VALIDATION.MAX_INPUT_LENGTH);
};