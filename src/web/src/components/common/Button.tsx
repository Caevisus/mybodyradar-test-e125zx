/**
 * @fileoverview Material Design 3.0 Button Component
 * Implements comprehensive button functionality with accessibility features,
 * loading states, and responsive behavior following WCAG 2.1 Level AA guidelines
 * @version 1.0.0
 */

import React, { useCallback, useRef } from 'react';
import classNames from 'classnames'; // v2.3.0
import type { IBaseProps } from '../../interfaces/common.interface';

/**
 * Button variant types following Material Design 3.0 specifications
 */
type ButtonVariant = 'contained' | 'outlined' | 'text';
type ButtonSize = 'small' | 'medium' | 'large';
type ButtonColor = 'primary' | 'secondary' | 'error' | 'warning' | 'success' | 'info';
type ButtonElevation = 'none' | 'low' | 'medium' | 'high';
type ButtonType = 'button' | 'submit' | 'reset';

/**
 * Comprehensive props interface for the Button component
 */
interface ButtonProps extends IBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  color?: ButtonColor;
  disabled?: boolean;
  isLoading?: boolean;
  type?: ButtonType;
  children: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  fullWidth?: boolean;
  elevation?: ButtonElevation;
}

/**
 * Material Design 3.0 compliant Button component with comprehensive accessibility support
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'contained',
  size = 'medium',
  color = 'primary',
  disabled = false,
  isLoading = false,
  type = 'button',
  children,
  onClick,
  ariaLabel,
  ariaDescribedBy,
  fullWidth = false,
  elevation = 'medium',
  className,
  style,
  testId = 'button',
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  /**
   * Enhanced click handler with loading state and accessibility management
   */
  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || isLoading) {
      event.preventDefault();
      return;
    }

    // Ensure proper focus management for accessibility
    buttonRef.current?.focus();

    onClick?.(event);
  }, [disabled, isLoading, onClick]);

  /**
   * Dynamic class generation based on component props
   */
  const buttonClasses = classNames(
    'md-button',
    `md-button--${variant}`,
    `md-button--${size}`,
    `md-button--${color}`,
    {
      'md-button--disabled': disabled,
      'md-button--loading': isLoading,
      'md-button--full-width': fullWidth,
      [`md-button--elevation-${elevation}`]: elevation !== 'none',
    },
    className
  );

  /**
   * Loading spinner component with proper ARIA attributes
   */
  const LoadingSpinner = () => (
    <span 
      className="md-button__spinner"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle className="md-button__spinner-circle" cx="12" cy="12" r="10" />
      </svg>
    </span>
  );

  return (
    <button
      ref={buttonRef}
      type={type}
      className={buttonClasses}
      onClick={handleClick}
      disabled={disabled || isLoading}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-busy={isLoading}
      aria-disabled={disabled}
      data-testid={testId}
      style={style}
    >
      <span className="md-button__content">
        {isLoading && <LoadingSpinner />}
        <span className={classNames('md-button__label', {
          'md-button__label--hidden': isLoading
        })}>
          {children}
        </span>
      </span>
      
      {/* Focus ring for accessibility */}
      <span className="md-button__focus-ring" aria-hidden="true" />
      
      {/* Ripple effect container */}
      <span className="md-button__ripple" aria-hidden="true" />
    </button>
  );
};

/**
 * Default props for Button component
 */
Button.defaultProps = {
  variant: 'contained',
  size: 'medium',
  color: 'primary',
  disabled: false,
  isLoading: false,
  type: 'button',
  fullWidth: false,
  elevation: 'medium',
};

export default Button;