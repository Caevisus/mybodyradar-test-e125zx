/**
 * @fileoverview Material Design 3.0 card component implementation
 * Provides a container with elevation, padding, and rounded corners
 * following Material Design specifications and WCAG 2.1 Level AA guidelines
 * @version 1.0.0
 */

import React from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.0
import { IBaseProps } from '../../interfaces/common.interface';

/**
 * Props interface for the Card component extending IBaseProps
 * with additional card-specific properties
 */
interface ICardProps extends IBaseProps {
  children: React.ReactNode;
  elevation?: 1 | 2 | 3 | 4 | 5;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  role?: string;
  ariaLabel?: string;
}

/**
 * A Material Design card component that provides a container with customizable
 * elevation, styling, and accessibility features.
 * 
 * @param props - Component properties including children, styling, and accessibility attributes
 * @returns A styled card container with the provided content and accessibility features
 */
const Card: React.FC<ICardProps> = React.memo(({
  children,
  className,
  style,
  id,
  testId,
  elevation = 1,
  onClick,
  role = 'region',
  ariaLabel
}) => {
  // Validate elevation range
  const validElevation = Math.max(1, Math.min(5, elevation));

  // Combine class names for styling
  const cardClasses = classNames(
    'md-card',
    `md-elevation-${validElevation}`,
    {
      'md-card--interactive': !!onClick,
    },
    className
  );

  // Base styles following Material Design specifications
  const baseStyles: React.CSSProperties = {
    padding: '16px',
    borderRadius: '12px',
    backgroundColor: 'var(--md-sys-color-surface)',
    color: 'var(--md-sys-color-on-surface)',
    transition: 'box-shadow 280ms cubic-bezier(0.4, 0, 0.2, 1)',
    ...style
  };

  return (
    <div
      id={id}
      className={cardClasses}
      style={baseStyles}
      onClick={onClick}
      role={role}
      aria-label={ariaLabel}
      data-testid={testId}
      tabIndex={onClick ? 0 : undefined}
      onKeyPress={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
        }
      } : undefined}
    >
      {children}
    </div>
  );
});

// Display name for debugging purposes
Card.displayName = 'Card';

export default Card;