import React, { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames'; // v2.3.0
import type { IBaseProps } from '../../interfaces/common.interface';
import styles from '../../styles/animations.css';
import theme from '../../styles/theme.css';

interface ToastProps extends IBaseProps {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose?: () => void;
  isVisible?: boolean;
  enableReducedMotion?: boolean;
  ariaLive?: 'polite' | 'assertive';
}

const useToastAnimation = (
  isVisible: boolean,
  duration: number,
  onClose?: () => void,
  enableReducedMotion?: boolean
) => {
  const timeoutRef = useRef<number>();
  const [isAnimating, setIsAnimating] = useState(false);
  const performanceRef = useRef<number>();

  useEffect(() => {
    if (isVisible) {
      // Start animation and measure performance
      performanceRef.current = performance.now();
      setIsAnimating(true);

      // Set up auto-dismiss timer
      timeoutRef.current = window.setTimeout(() => {
        setIsAnimating(false);
        if (onClose) {
          const latency = performance.now() - (performanceRef.current || 0);
          console.debug(`Toast animation latency: ${latency}ms`);
          onClose();
        }
      }, duration);
    }

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [isVisible, duration, onClose]);

  return {
    isAnimating,
    style: {
      willChange: isAnimating ? 'opacity, transform' : 'auto',
      contain: 'layout style paint',
    },
  };
};

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onClose,
  isVisible = false,
  enableReducedMotion = false,
  ariaLive = 'polite',
  className,
  style,
}) => {
  const { isAnimating, style: animationStyle } = useToastAnimation(
    isVisible,
    duration,
    onClose,
    enableReducedMotion
  );

  // Handle keyboard interactions
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && onClose) {
      onClose();
    }
  }, [onClose]);

  // Get semantic colors based on toast type
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: 'var(--color-success-container)',
          color: 'var(--color-on-success-container)',
        };
      case 'error':
        return {
          backgroundColor: 'var(--color-error-container)',
          color: 'var(--color-on-error-container)',
        };
      case 'warning':
        return {
          backgroundColor: 'var(--color-warning-container)',
          color: 'var(--color-on-warning-container)',
        };
      default:
        return {
          backgroundColor: 'var(--color-primary-container)',
          color: 'var(--color-on-primary-container)',
        };
    }
  };

  if (!isVisible && !isAnimating) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live={ariaLive}
      aria-atomic="true"
      tabIndex={0}
      className={classNames(
        theme['elevation-2'],
        {
          [styles['fade-enter']]: isVisible,
          [styles['fade-exit']]: !isVisible && isAnimating,
          [styles['reduced-motion']]: enableReducedMotion,
        },
        className
      )}
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: 'var(--spacing-md)',
        borderRadius: 'var(--border-radius-md)',
        maxWidth: '90vw',
        width: 'auto',
        zIndex: 'var(--z-index-toast)',
        ...getTypeStyles(),
        ...animationStyle,
        ...style,
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        className={theme['text-body']}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
        }}
      >
        {/* Icon based on type */}
        <span 
          className="material-icons"
          aria-hidden="true"
          style={{ fontSize: '20px' }}
        >
          {type === 'success' && 'check_circle'}
          {type === 'error' && 'error'}
          {type === 'warning' && 'warning'}
          {type === 'info' && 'info'}
        </span>
        
        {/* Message */}
        <span>{message}</span>

        {/* Close button */}
        {onClose && (
          <button
            type="button"
            aria-label="Close notification"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: 'var(--spacing-xs)',
              marginLeft: 'auto',
              cursor: 'pointer',
              color: 'inherit',
            }}
          >
            <span className="material-icons" aria-hidden="true">
              close
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

export default Toast;