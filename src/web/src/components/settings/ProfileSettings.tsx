/**
 * @fileoverview Enhanced Profile Settings Component with comprehensive security,
 * validation, and accessibility features for the smart-apparel system.
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import classNames from 'classnames';
import * as yup from 'yup';
import { Input } from '../common/Input';
import { useAuth } from '../../hooks/useAuth';
import { sanitizeInput } from '../../utils/validation.utils';
import { setStorageItem } from '../../utils/storage.utils';
import { INPUT_VALIDATION, ERROR_MESSAGES } from '../../constants/validation.constants';
import type { IBaseProps } from '../../interfaces/common.interface';

// Profile form validation schema
const profileSchema = yup.object().shape({
  name: yup.string()
    .required(ERROR_MESSAGES.REQUIRED_FIELD)
    .min(INPUT_VALIDATION.MIN_USERNAME_LENGTH)
    .max(INPUT_VALIDATION.MAX_USERNAME_LENGTH)
    .matches(INPUT_VALIDATION.USERNAME_PATTERN, ERROR_MESSAGES.INVALID_USERNAME),
  email: yup.string()
    .required(ERROR_MESSAGES.REQUIRED_FIELD)
    .matches(INPUT_VALIDATION.EMAIL_PATTERN, ERROR_MESSAGES.INVALID_EMAIL),
  phoneNumber: yup.string()
    .matches(INPUT_VALIDATION.PHONE_PATTERN, ERROR_MESSAGES.INVALID_PHONE),
  teamId: yup.string().nullable(),
  preferences: yup.object().default({}),
  roleSpecificData: yup.object().default({})
});

// Component props interface
interface ProfileSettingsProps extends IBaseProps {
  onSave: (data: ProfileFormData) => Promise<void>;
  onCancel: () => void;
  onError: (error: Error) => void;
}

// Form data interface
interface ProfileFormData {
  name: string;
  email: string;
  phoneNumber: string;
  teamId: string;
  preferences: Record<string, any>;
  roleSpecificData: Record<string, any>;
}

/**
 * Enhanced Profile Settings component with comprehensive security and accessibility features
 */
const ProfileSettings: React.FC<ProfileSettingsProps> = ({
  onSave,
  onCancel,
  onError,
  className,
  style
}) => {
  // Authentication context
  const { user, refreshSession, validateSession } = useAuth();

  // Component state
  const [formData, setFormData] = useState<ProfileFormData>({
    name: user?.name || '',
    email: user?.email || '',
    phoneNumber: user?.phoneNumber || '',
    teamId: user?.teamId || '',
    preferences: user?.preferences || {},
    roleSpecificData: user?.roleSpecificData || {}
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [validationTimeout, setValidationTimeout] = useState<NodeJS.Timeout | null>(null);
  const [sessionValid, setSessionValid] = useState(true);

  // Cleanup validation timeout on unmount
  useEffect(() => {
    return () => {
      if (validationTimeout) {
        clearTimeout(validationTimeout);
      }
    };
  }, [validationTimeout]);

  // Session validation effect
  useEffect(() => {
    const validateUserSession = async () => {
      try {
        const isValid = await validateSession();
        setSessionValid(isValid);
      } catch (error) {
        setSessionValid(false);
        onError(error instanceof Error ? error : new Error('Session validation failed'));
      }
    };

    validateUserSession();
  }, [validateSession, onError]);

  /**
   * Handles form input changes with debounced validation
   */
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    const sanitizedValue = sanitizeInput(value);

    setFormData(prev => ({
      ...prev,
      [name]: sanitizedValue
    }));
    setIsDirty(true);

    // Debounced validation
    if (validationTimeout) {
      clearTimeout(validationTimeout);
    }

    const newTimeout = setTimeout(async () => {
      try {
        await profileSchema.validateAt(name, { [name]: sanitizedValue });
        setErrors(prev => ({ ...prev, [name]: '' }));
      } catch (error) {
        if (error instanceof yup.ValidationError) {
          setErrors(prev => ({ ...prev, [name]: error.message }));
        }
      }
    }, 300);

    setValidationTimeout(newTimeout);
  }, [validationTimeout]);

  /**
   * Handles form submission with comprehensive validation
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!sessionValid) {
      onError(new Error('Invalid session. Please log in again.'));
      return;
    }

    setIsSubmitting(true);

    try {
      // Validate entire form
      const validatedData = await profileSchema.validate(formData, { abortEarly: false });

      // Store form data securely
      await setStorageItem('profileData', validatedData, true);

      // Submit form data
      await onSave(validatedData);

      // Refresh session after successful update
      await refreshSession();

      setIsDirty(false);
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const validationErrors: Record<string, string> = {};
        error.inner.forEach(err => {
          if (err.path) {
            validationErrors[err.path] = err.message;
          }
        });
        setErrors(validationErrors);
      }
      onError(error instanceof Error ? error : new Error('Form submission failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Unsaved changes warning
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  return (
    <form
      onSubmit={handleSubmit}
      className={classNames('profile-settings', className)}
      style={style}
      noValidate
    >
      <div className="profile-settings__content">
        <Input
          name="name"
          label="Full Name"
          value={formData.name}
          onChange={handleInputChange}
          error={errors.name}
          required
          disabled={isSubmitting}
          maxLength={INPUT_VALIDATION.MAX_USERNAME_LENGTH}
          helperText="Enter your full name as it appears on official documents"
        />

        <Input
          name="email"
          label="Email Address"
          type="email"
          value={formData.email}
          onChange={handleInputChange}
          error={errors.email}
          required
          disabled={isSubmitting}
          helperText="This email will be used for account notifications"
        />

        <Input
          name="phoneNumber"
          label="Phone Number"
          type="tel"
          value={formData.phoneNumber}
          onChange={handleInputChange}
          error={errors.phoneNumber}
          disabled={isSubmitting}
          helperText="Optional: Add a phone number for SMS notifications"
        />

        <Input
          name="teamId"
          label="Team ID"
          value={formData.teamId}
          onChange={handleInputChange}
          error={errors.teamId}
          disabled={isSubmitting}
          helperText="Your assigned team identifier"
        />
      </div>

      <div className="profile-settings__actions">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="profile-settings__cancel-btn"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !isDirty || !sessionValid}
          className="profile-settings__save-btn"
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Hidden live region for screen readers */}
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {isSubmitting ? 'Saving profile changes...' : ''}
        {!sessionValid ? 'Your session has expired. Please log in again.' : ''}
      </div>
    </form>
  );
};

export default ProfileSettings;