import React from 'react';

// Base interface for common icon properties
interface IconProps {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
  testId?: string;
}

// Additional props for Alert icon
interface AlertIconProps {
  severity: 'info' | 'warning' | 'error' | 'success';
  animated?: boolean;
}

// Additional props for Chevron icon
interface ChevronIconProps {
  direction: 'up' | 'down' | 'left' | 'right';
  animated?: boolean;
}

// Additional props for Loading icon
interface LoadingIconProps {
  speed: 'slow' | 'normal' | 'fast';
  variant: 'spinner' | 'circular' | 'dots';
}

// Dashboard icon component
export const DashboardIcon: React.FC<IconProps> = ({
  size = 24,
  color = 'currentColor',
  className,
  style,
  ariaLabel = 'Dashboard',
  testId = 'dashboard-icon'
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={style}
    aria-label={ariaLabel}
    data-testid={testId}
  >
    <path
      d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"
      fill={color}
    />
  </svg>
);

// Alert icon component with severity states
export const AlertIcon: React.FC<IconProps & AlertIconProps> = ({
  size = 24,
  color,
  severity = 'info',
  animated = false,
  className,
  style,
  ariaLabel,
  testId = 'alert-icon'
}) => {
  const severityColors = {
    info: '#0288D1',
    warning: '#FFA000',
    error: '#D32F2F',
    success: '#388E3C'
  };

  const iconColor = color || severityColors[severity];
  const animationClass = animated ? 'alert-icon-pulse' : '';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${animationClass}`}
      style={style}
      aria-label={ariaLabel || `${severity} alert`}
      data-testid={testId}
    >
      {severity === 'info' && (
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
          fill={iconColor}
        />
      )}
      {severity === 'warning' && (
        <path
          d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"
          fill={iconColor}
        />
      )}
      {severity === 'error' && (
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
          fill={iconColor}
        />
      )}
      {severity === 'success' && (
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
          fill={iconColor}
        />
      )}
    </svg>
  );
};

// Chevron icon component with direction support
export const ChevronIcon: React.FC<IconProps & ChevronIconProps> = ({
  size = 24,
  color = 'currentColor',
  direction = 'down',
  animated = false,
  className,
  style,
  ariaLabel,
  testId = 'chevron-icon'
}) => {
  const getRotation = () => {
    switch (direction) {
      case 'up': return '180deg';
      case 'right': return '270deg';
      case 'left': return '90deg';
      default: return '0deg';
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${animated ? 'chevron-animated' : ''}`}
      style={{ ...style, transform: `rotate(${getRotation()})` }}
      aria-label={ariaLabel || `Chevron ${direction}`}
      data-testid={testId}
    >
      <path
        d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"
        fill={color}
      />
    </svg>
  );
};

// Loading icon component with variants
export const LoadingIcon: React.FC<IconProps & LoadingIconProps> = ({
  size = 24,
  color = 'currentColor',
  speed = 'normal',
  variant = 'spinner',
  className,
  style,
  ariaLabel = 'Loading',
  testId = 'loading-icon'
}) => {
  const getAnimationDuration = () => {
    switch (speed) {
      case 'slow': return '2s';
      case 'fast': return '0.5s';
      default: return '1s';
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} loading-${variant}`}
      style={{
        ...style,
        animation: `spin ${getAnimationDuration()} linear infinite`
      }}
      aria-label={ariaLabel}
      data-testid={testId}
    >
      {variant === 'spinner' && (
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"
          fill={color}
          opacity="0.3"
        >
          <path
            d="M12 2v4c4.42 0 8 3.58 8 8s-3.58 8-8 8-8-3.58-8-8h-4c0 6.627 5.373 12 12 12s12-5.373 12-12-5.373-12-12-12z"
            fill={color}
          />
        </path>
      )}
      {variant === 'circular' && (
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke={color}
          strokeWidth="2"
          fill="none"
          strokeDasharray="30 60"
        />
      )}
      {variant === 'dots' && (
        <>
          <circle cx="6" cy="12" r="2" fill={color} />
          <circle cx="12" cy="12" r="2" fill={color} />
          <circle cx="18" cy="12" r="2" fill={color} />
        </>
      )}
    </svg>
  );
};