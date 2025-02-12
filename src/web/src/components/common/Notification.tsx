/**
 * @fileoverview A reusable notification component following Material Design 3.0 principles
 * Implements WCAG 2.1 Level AA compliance with proper accessibility features
 * @version 1.0.0
 */

import React, { useEffect, useRef } from 'react';
import classNames from 'classnames'; // v2.3.0
import { IBaseProps } from '../../interfaces/common.interface';
import animations from '../../styles/animations.css';
import theme from '../../styles/theme.css';

/**
 * Props interface for the Notification component
 */
interface NotificationProps extends IBaseProps {
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  onClose?: () => void;
  autoClose?: boolean;
}

/**
 * Custom hook for managing notification auto-close functionality
 */
const useNotificationTimer = (
  duration: number,
  autoClose: boolean,
  onClose?: () => void
): void => {
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (autoClose && duration > 0) {
      // Clear any existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Set new timer
      timerRef.current = setTimeout(() => {
        onClose?.();
      }, duration);
    }

    // Cleanup on unmount or duration change
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [duration, autoClose, onClose]);
};

/**
 * Notification component that displays alerts with Material Design styling
 */
export const Notification: React.FC<NotificationProps> = ({
  message,
  severity = 'info',
  duration = 5000,
  onClose,
  autoClose = true,
  className,
  style,
}) => {
  // Initialize auto-close timer
  useNotificationTimer(duration, autoClose, onClose);

  // Map severity to Material Design colors
  const severityColorMap = {
    info: 'var(--color-primary)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)',
  };

  // Map severity to ARIA roles
  const severityRoleMap = {
    info: 'status',
    success: 'status',
    warning: 'alert',
    error: 'alert',
  };

  const notificationClasses = classNames(
    'notification',
    animations['fade-enter'],
    theme['elevation-1'],
    className,
    {
      'notification--auto-close': autoClose,
    }
  );

  const notificationStyles: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    padding: 'var(--spacing-md)',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-on-surface)',
    borderLeft: `4px solid ${severityColorMap[severity]}`,
    ...style,
  };

  const closeButtonStyles: React.CSSProperties = {
    position: 'absolute',
    right: 'var(--spacing-sm)',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 'var(--spacing-xs)',
    color: 'var(--color-on-surface)',
  };

  // Progress indicator styles for auto-close
  const progressStyles: React.CSSProperties = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: '2px',
    backgroundColor: severityColorMap[severity],
    animation: autoClose ? `${animations['slide-exit']} ${duration}ms linear` : 'none',
    willChange: 'transform',
  };

  return (
    <div
      className={notificationClasses}
      style={notificationStyles}
      role={severityRoleMap[severity]}
      aria-live={severity === 'error' ? 'assertive' : 'polite'}
    >
      <div className="notification__content">
        {message}
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          style={closeButtonStyles}
          aria-label="Close notification"
          className="notification__close"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      )}

      {autoClose && (
        <div 
          className="notification__progress"
          style={progressStyles}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default Notification;