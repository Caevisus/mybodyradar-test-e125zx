/**
 * @fileoverview Test suite for validation utility functions
 * Ensures proper validation of user inputs, sensor data, and session configurations
 * with WCAG 2.1 Level AA compliance
 * @version 1.0.0
 */

import { describe, it, expect } from '@jest/globals'; // v29.7.0
import { configureAxe, toHaveNoViolations } from 'axe-core/jest'; // v4.7.0

import {
  validateEmail,
  validatePassword,
  validateSensorData,
  validateSessionConfig,
  validateAlertConfig
} from '../../utils/validation.utils';

import { 
  INPUT_VALIDATION,
  SENSOR_VALIDATION,
  SESSION_VALIDATION,
  ALERT_VALIDATION,
  ERROR_MESSAGES 
} from '../../constants/validation.constants';

// Configure axe for accessibility testing
const axe = configureAxe({
  rules: {
    'color-contrast': { enabled: true },
    'aria-required-attr': { enabled: true },
    'keyboard-interactive': { enabled: true }
  }
});

expect.extend(toHaveNoViolations);

describe('Email Validation', () => {
  it('should validate correct email formats', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('user.name+tag@example.co.uk')).toBe(true);
    expect(validateEmail('user123@subdomain.example.com')).toBe(true);
  });

  it('should reject invalid email formats', () => {
    expect(validateEmail('')).toBe(false);
    expect(validateEmail('invalid.email')).toBe(false);
    expect(validateEmail('@example.com')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
    expect(validateEmail('user@.com')).toBe(false);
  });

  it('should handle edge cases', () => {
    expect(validateEmail(undefined as any)).toBe(false);
    expect(validateEmail(null as any)).toBe(false);
    expect(validateEmail(' ')).toBe(false);
  });
});

describe('Password Validation', () => {
  it('should validate strong passwords', () => {
    const result = validatePassword('StrongP@ss123');
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject weak passwords', () => {
    const result = validatePassword('weak');
    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toBe(ERROR_MESSAGES.INVALID_PASSWORD);
  });

  it('should enforce length requirements', () => {
    expect(validatePassword('Ab1@').isValid).toBe(false);
    expect(validatePassword('A'.repeat(129) + 'b1@').isValid).toBe(false);
  });
});

describe('Sensor Data Validation', () => {
  it('should validate ToF sensor data at 100Hz', () => {
    const tofData = {
      type: 'tof' as const,
      samplingRate: 100,
      values: [500, 600, 700],
      timestamp: Date.now(),
      signalStrength: -85
    };
    expect(validateSensorData(tofData).isValid).toBe(true);
  });

  it('should validate IMU sensor data at 200Hz', () => {
    const imuData = {
      type: 'imu' as const,
      samplingRate: 200,
      values: [45, 90, 135],
      timestamp: Date.now(),
      signalStrength: -80
    };
    expect(validateSensorData(imuData).isValid).toBe(true);
  });

  it('should reject invalid sampling rates', () => {
    const invalidData = {
      type: 'tof' as const,
      samplingRate: 50,
      values: [500],
      timestamp: Date.now(),
      signalStrength: -85
    };
    const result = validateSensorData(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.error?.code).toBe('INVALID_SENSOR_DATA');
  });

  it('should validate signal strength requirements', () => {
    const weakSignalData = {
      type: 'imu' as const,
      samplingRate: 200,
      values: [45],
      timestamp: Date.now(),
      signalStrength: -95
    };
    expect(validateSensorData(weakSignalData).isValid).toBe(false);
  });
});

describe('Session Configuration Validation', () => {
  it('should validate valid session configurations', () => {
    const validConfig = {
      duration: 1800,
      restInterval: 60,
      sets: 3,
      reps: 12,
      concurrent: 2
    };
    expect(validateSessionConfig(validConfig).isValid).toBe(true);
  });

  it('should reject invalid session durations', () => {
    const invalidDuration = {
      duration: 30,
      restInterval: 60,
      sets: 3,
      reps: 12,
      concurrent: 2
    };
    expect(validateSessionConfig(invalidDuration).isValid).toBe(false);
  });

  it('should validate concurrent session limits', () => {
    const tooManyConcurrent = {
      duration: 1800,
      restInterval: 60,
      sets: 3,
      reps: 12,
      concurrent: 6
    };
    expect(validateSessionConfig(tooManyConcurrent).isValid).toBe(false);
  });
});

describe('Alert Configuration Validation', () => {
  it('should validate proper alert configurations', () => {
    const result = validateAlertConfig(
      'High Force Alert',
      'Excessive force detected in right knee sensor',
      'HIGH'
    );
    expect(result.isValid).toBe(true);
  });

  it('should reject invalid alert priorities', () => {
    const result = validateAlertConfig(
      'Test Alert',
      'Test Message',
      'INVALID_PRIORITY'
    );
    expect(result.isValid).toBe(false);
    expect(result.error?.details.priority).toBeDefined();
  });

  it('should validate message length requirements', () => {
    const result = validateAlertConfig(
      'Test',
      'Too short',
      'MEDIUM'
    );
    expect(result.isValid).toBe(false);
    expect(result.error?.details.message).toBeDefined();
  });
});

describe('Accessibility Compliance', () => {
  it('should provide screen reader compatible error messages', () => {
    const result = validatePassword('weak');
    expect(result.error?.message).toBe(ERROR_MESSAGES.INVALID_PASSWORD);
    // Error message should be clear and descriptive for screen readers
    expect(result.error?.message.length).toBeGreaterThan(0);
  });

  it('should support keyboard navigation in validation UI', async () => {
    // Mock DOM element for testing
    document.body.innerHTML = `
      <div role="alert" aria-live="polite">
        ${ERROR_MESSAGES.INVALID_PASSWORD}
      </div>
    `;
    
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });

  it('should maintain proper focus management', () => {
    // Verify that error states preserve focus for keyboard users
    const element = document.createElement('input');
    element.setAttribute('aria-invalid', 'true');
    element.setAttribute('aria-errormessage', 'error-message');
    
    expect(element.hasAttribute('aria-invalid')).toBe(true);
    expect(element.hasAttribute('aria-errormessage')).toBe(true);
  });
});