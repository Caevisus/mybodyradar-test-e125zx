import React, { useState, useEffect, useRef, forwardRef } from 'react';
import classNames from 'classnames';
import { useDebounce } from 'use-debounce';
import { validateEmail } from '../../utils/validation.utils';
import type { IBaseProps } from '../../interfaces/common.interface';

/**
 * Input types supported by the component
 */
type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'search' | 'url';

/**
 * Custom validation function type
 */
type ValidationFunction = (value: string) => Promise<string | null> | string | null;

/**
 * Input mask configuration
 */
interface InputMask {
  pattern: string;
  placeholder: string;
}

/**
 * Locale options for internationalization
 */
interface LocaleOptions {
  locale: string;
  numberFormat?: Intl.NumberFormatOptions;
  direction?: 'ltr' | 'rtl';
}

/**
 * Props interface for the Input component
 */
interface InputProps extends IBaseProps {
  name: string;
  label: string;
  value: string;
  placeholder?: string;
  type?: InputType;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  onChange?: (value: string) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  helperText?: string;
  customValidation?: ValidationFunction;
  mask?: InputMask;
  localeOptions?: LocaleOptions;
  maxLength?: number;
  autoComplete?: boolean;
}

/**
 * A comprehensive, accessible input component implementing Material Design 3.0
 * and WCAG 2.1 Level AA compliance.
 */
const Input = forwardRef<HTMLInputElement, InputProps>(({
  name,
  label,
  value,
  placeholder,
  type = 'text',
  error,
  disabled = false,
  required = false,
  onChange,
  onBlur,
  helperText,
  customValidation,
  mask,
  localeOptions,
  maxLength,
  autoComplete = true,
  className,
  style
}, ref) => {
  // Component state
  const [touched, setTouched] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [ariaAnnouncement, setAriaAnnouncement] = useState('');
  
  // Input ref for imperative operations
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Debounced value for performance optimization
  const [debouncedValue] = useDebounce(value, 300);

  // Combine external and internal errors
  const displayError = error || internalError;

  /**
   * Validates input based on type and custom validation rules
   */
  const validateInput = async (inputValue: string): Promise<string | null> => {
    if (required && !inputValue) {
      return 'This field is required';
    }

    if (!inputValue) {
      return null;
    }

    // Type-specific validation
    switch (type) {
      case 'email':
        if (!validateEmail(inputValue)) {
          return 'Please enter a valid email address';
        }
        break;
      case 'tel':
        if (!/^\+?[1-9]\d{1,14}$/.test(inputValue)) {
          return 'Please enter a valid phone number';
        }
        break;
      case 'url':
        try {
          new URL(inputValue);
        } catch {
          return 'Please enter a valid URL';
        }
        break;
    }

    // Custom validation if provided
    if (customValidation) {
      const customError = await customValidation(inputValue);
      if (customError) {
        return customError;
      }
    }

    return null;
  };

  /**
   * Handles input value changes with validation
   */
  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = event.target.value;

    // Apply input mask if configured
    if (mask) {
      newValue = newValue.replace(new RegExp(mask.pattern), '');
    }

    // Apply maxLength constraint
    if (maxLength) {
      newValue = newValue.slice(0, maxLength);
    }

    // Call onChange callback
    onChange?.(newValue);

    // Update validation state
    setIsValidating(true);
    const validationError = await validateInput(newValue);
    setInternalError(validationError);
    setIsValidating(false);

    // Update ARIA announcement
    if (validationError) {
      setAriaAnnouncement(validationError);
    }
  };

  /**
   * Handles input blur events
   */
  const handleBlur = async (event: React.FocusEvent<HTMLInputElement>) => {
    setTouched(true);
    setIsFocused(false);

    // Validate on blur
    const validationError = await validateInput(value);
    setInternalError(validationError);

    // Update ARIA announcement
    if (validationError) {
      setAriaAnnouncement(validationError);
    }

    onBlur?.(event);
  };

  /**
   * Handles input focus events
   */
  const handleFocus = () => {
    setIsFocused(true);
  };

  // Validate on value changes
  useEffect(() => {
    if (touched) {
      validateInput(debouncedValue);
    }
  }, [debouncedValue]);

  // Generate unique IDs for accessibility
  const inputId = `input-${name}`;
  const errorId = `error-${name}`;
  const helperId = `helper-${name}`;

  return (
    <div
      className={classNames(
        'input-container',
        {
          'input-focused': isFocused,
          'input-error': displayError,
          'input-disabled': disabled,
          'input-rtl': localeOptions?.direction === 'rtl'
        },
        className
      )}
      style={style}
    >
      <label
        htmlFor={inputId}
        className="input-label"
        data-required={required}
      >
        {label}
      </label>
      
      <input
        ref={ref || inputRef}
        id={inputId}
        type={type}
        name={name}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete ? 'on' : 'off'}
        aria-invalid={!!displayError}
        aria-required={required}
        aria-describedby={classNames({
          [errorId]: displayError,
          [helperId]: helperText
        })}
        dir={localeOptions?.direction}
        className={classNames('input-field', {
          'input-field-error': displayError,
          'input-field-disabled': disabled
        })}
      />

      {/* Error message */}
      {displayError && (
        <div
          id={errorId}
          role="alert"
          aria-live="polite"
          className="input-error-message"
        >
          {displayError}
        </div>
      )}

      {/* Helper text */}
      {helperText && !displayError && (
        <div
          id={helperId}
          className="input-helper-text"
        >
          {helperText}
        </div>
      )}

      {/* Hidden ARIA live region for announcements */}
      <div
        aria-live="polite"
        className="sr-only"
        role="status"
      >
        {ariaAnnouncement}
      </div>
    </div>
  );
});

Input.displayName = 'Input';

export default Input;