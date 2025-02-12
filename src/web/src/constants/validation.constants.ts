/**
 * @fileoverview Validation constants and rules for the smart-apparel web application
 * Implements WCAG 2.1 Level AA compliance requirements and sensor data validation
 * @version 1.0.0
 */

/**
 * Input validation constants for user interactions and form submissions
 */
export const INPUT_VALIDATION = {
  MIN_USERNAME_LENGTH: 3,
  MAX_USERNAME_LENGTH: 50,
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  EMAIL_PATTERN: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  USERNAME_PATTERN: /^[a-zA-Z0-9_-]+$/,
  PHONE_PATTERN: /^\+?[1-9]\d{1,14}$/,
  INPUT_SANITIZATION_PATTERN: /<script>|javascript:|data:|vbscript:|\b(on\w+)=/,
  MAX_INPUT_LENGTH: 5000,
  ARIA_REQUIRED: true,
  FOCUS_VISIBLE: true,
  MIN_COLOR_CONTRAST: 4.5,
  MIN_LARGE_TEXT_CONTRAST: 3
} as const;

/**
 * Sensor data validation constants for hardware measurements
 */
export const SENSOR_VALIDATION = {
  TOF_SAMPLING_RATE: 100, // Hz for Time of Flight sensors
  IMU_SAMPLING_RATE: 200, // Hz for IMU sensors
  MIN_FORCE_VALUE: 0, // Newtons
  MAX_FORCE_VALUE: 2000, // Newtons
  MIN_ANGLE_VALUE: -180, // Degrees
  MAX_ANGLE_VALUE: 180, // Degrees
  DATA_PRECISION: 2, // Decimal places
  BUFFER_SIZE: 1000, // Samples
  MAX_LATENCY_MS: 100, // Milliseconds
  MIN_SIGNAL_STRENGTH: -90, // dBm
  CALIBRATION_THRESHOLD: 0.01, // Deviation threshold
  NOISE_FLOOR: -120 // dBm
} as const;

/**
 * Session validation constants for workout and monitoring sessions
 */
export const SESSION_VALIDATION = {
  MIN_SESSION_DURATION: 60, // Seconds
  MAX_SESSION_DURATION: 7200, // Seconds (2 hours)
  MIN_REST_INTERVAL: 10, // Seconds
  MAX_REST_INTERVAL: 300, // Seconds (5 minutes)
  MIN_SETS: 1,
  MAX_SETS: 20,
  MIN_REPS: 1,
  MAX_REPS: 100,
  MAX_CONCURRENT_SESSIONS: 5,
  SESSION_TIMEOUT: 3600, // Seconds (1 hour)
  HEARTBEAT_INTERVAL: 30 // Seconds
} as const;

/**
 * WCAG 2.1 Level AA accessibility compliance constants
 */
export const ACCESSIBILITY_VALIDATION = {
  MIN_TARGET_SIZE: 44, // Pixels
  MIN_LINE_HEIGHT: 1.5, // Relative to font size
  MIN_TEXT_SPACING: 0.12, // em units
  REFLOW_BREAKPOINT: 320, // Pixels
  MOTION_DURATION: 5000, // Milliseconds
  TIMING_ADJUSTABLE: true,
  KEYBOARD_OPERABLE: true,
  SCREEN_READER_COMPATIBLE: true
} as const;

/**
 * Alert and notification validation constants
 */
export const ALERT_VALIDATION = {
  MIN_TITLE_LENGTH: 3,
  MAX_TITLE_LENGTH: 100,
  MIN_MESSAGE_LENGTH: 10,
  MAX_MESSAGE_LENGTH: 500,
  MAX_ACTIVE_ALERTS: 50,
  ALERT_PRIORITY_LEVELS: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const,
  ALERT_TIMEOUT: {
    LOW: 300000, // 5 minutes
    MEDIUM: 180000, // 3 minutes
    HIGH: 86400000, // 24 hours
    CRITICAL: null // Never timeout
  },
  MAX_RETRY_ATTEMPTS: 3,
  NOTIFICATION_COOLDOWN: 60000 // 1 minute
} as const;

/**
 * Error messages for validation failures
 */
export const ERROR_MESSAGES = {
  REQUIRED_FIELD: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_USERNAME: 'Username must be between 3-50 characters and contain only letters, numbers, underscores and hyphens',
  INVALID_PASSWORD: 'Password must be between 8-128 characters and contain at least one uppercase letter, one lowercase letter, one number and one special character',
  INVALID_PHONE: 'Please enter a valid phone number',
  INVALID_SENSOR_DATA: 'Sensor data values are outside acceptable range',
  INVALID_SAMPLING_RATE: 'Invalid sampling rate detected',
  INVALID_SESSION_DURATION: 'Session duration must be between 1-120 minutes',
  ACCESSIBILITY_ERROR: 'This action does not meet accessibility requirements',
  CONTRAST_ERROR: 'Color contrast ratio does not meet WCAG 2.1 Level AA standards',
  FOCUS_ERROR: 'Element must be keyboard focusable',
  ARIA_ERROR: 'Required ARIA attributes are missing'
} as const;

// Type definitions for exported constants
export type AlertPriorityLevel = typeof ALERT_VALIDATION.ALERT_PRIORITY_LEVELS[number];
export type AlertTimeout = typeof ALERT_VALIDATION.ALERT_TIMEOUT;
export type ValidationErrorMessage = typeof ERROR_MESSAGES[keyof typeof ERROR_MESSAGES];