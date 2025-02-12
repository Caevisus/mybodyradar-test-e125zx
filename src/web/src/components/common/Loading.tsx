import React from 'react';
import type { IBaseProps } from '../../interfaces/common.interface';
import '../../styles/theme.css';
import '../../styles/components.css';

interface LoadingProps extends IBaseProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'inherit';
  overlay?: boolean;
  message?: string;
  zIndex?: number;
  preventClick?: boolean;
}

const Loading: React.FC<LoadingProps> = React.memo(({
  size = 'medium',
  color = 'primary',
  overlay = false,
  message,
  zIndex = 1200,
  preventClick = true,
  className = '',
  style,
  testId = 'loading-spinner'
}) => {
  // Check for reduced motion preference
  const prefersReducedMotion = React.useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  // Construct class names based on props
  const spinnerClasses = React.useMemo(() => {
    const classes = ['loading__spinner'];
    classes.push(`loading__spinner--${size}`);
    classes.push(`loading__spinner--${color}`);
    if (className) classes.push(className);
    return classes.join(' ');
  }, [size, color, className]);

  // Construct container classes
  const containerClasses = React.useMemo(() => {
    const classes = ['loading'];
    if (overlay) classes.push('loading--overlay');
    return classes.join(' ');
  }, [overlay]);

  // Base styles with containment for performance
  const baseStyles: React.CSSProperties = {
    contain: 'content',
    ...style
  };

  // Overlay styles
  const overlayStyles: React.CSSProperties = overlay ? {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex,
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    ...baseStyles
  } : baseStyles;

  // Click prevention handler
  const preventClickHandler = React.useCallback((e: React.MouseEvent) => {
    if (preventClick && overlay) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, [preventClick, overlay]);

  // Error boundary fallback
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    <div
      className={containerClasses}
      style={overlayStyles}
      onClick={preventClickHandler}
      data-testid={testId}
      role="progressbar"
      aria-busy="true"
      aria-live="polite"
    >
      <div 
        className={spinnerClasses}
        style={{
          animation: prefersReducedMotion ? 'none' : undefined
        }}
      >
        <svg 
          viewBox="0 0 50 50"
          aria-hidden="true"
        >
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            strokeWidth="5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeDasharray="80, 200"
            strokeDashoffset="0"
          />
        </svg>
      </div>
      {message && (
        <div 
          className="loading__message"
          aria-label={message}
        >
          {message}
        </div>
      )}
    </div>
  );
});

Loading.displayName = 'Loading';

export default Loading;