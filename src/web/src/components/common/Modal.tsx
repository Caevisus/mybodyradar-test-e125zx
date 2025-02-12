import React, { useEffect, useRef, useCallback } from 'react';
import classNames from 'classnames';
import FocusTrap from 'focus-trap-react';
import { IBaseProps } from '../../interfaces/common.interface';
import styles from '../../styles/animations.css';

/**
 * Modal size variants following Material Design 3.0 specifications
 */
export type ModalSize = 'small' | 'medium' | 'large' | 'fullscreen';

/**
 * Animation timing and easing configuration
 */
interface TransitionOptions {
  duration?: number;
  easing?: string;
  delay?: number;
}

/**
 * Theme customization options for modal styling
 */
interface ThemeOptions {
  backgroundColor?: string;
  textColor?: string;
  elevation?: 1 | 2 | 3 | 4 | 5;
}

/**
 * Props interface for the Modal component
 */
export interface ModalProps extends IBaseProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: ModalSize;
  closeOnBackdropClick?: boolean;
  showCloseButton?: boolean;
  footer?: React.ReactNode;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  transitionOptions?: TransitionOptions;
  disableAnimation?: boolean;
  onAnimationComplete?: () => void;
  theme?: ThemeOptions;
}

/**
 * A highly accessible modal component implementing Material Design 3.0
 * with GPU-accelerated animations and comprehensive ARIA support.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'medium',
  closeOnBackdropClick = true,
  showCloseButton = true,
  footer,
  ariaLabel,
  ariaDescribedBy,
  className,
  style,
  transitionOptions,
  disableAnimation = false,
  onAnimationComplete,
  theme
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Generate unique IDs for accessibility
  const modalId = useRef(`modal-${Math.random().toString(36).substr(2, 9)}`);
  const titleId = useRef(`modal-title-${modalId.current}`);
  const contentId = useRef(`modal-content-${modalId.current}`);

  // Handle backdrop clicks with debouncing
  const handleBackdropClick = useCallback((event: React.MouseEvent) => {
    if (event.target === event.currentTarget && closeOnBackdropClick) {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  }, [closeOnBackdropClick, onClose]);

  // Manage keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      onClose();
    }
  }, [isOpen, onClose]);

  // Setup and cleanup effects
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, handleKeyDown]);

  // Handle animation completion
  const handleTransitionEnd = useCallback(() => {
    if (!isOpen && onAnimationComplete) {
      onAnimationComplete();
    }
  }, [isOpen, onAnimationComplete]);

  // Generate modal styles
  const modalStyles = {
    ...style,
    '--modal-bg': theme?.backgroundColor || 'var(--color-surface)',
    '--modal-color': theme?.textColor || 'var(--color-on-surface)',
    '--modal-elevation': `var(--shadow-${theme?.elevation || 3})`,
    '--transition-duration': `${transitionOptions?.duration || 250}ms`,
    '--transition-easing': transitionOptions?.easing || 'var(--transition-timing-ease)',
    '--transition-delay': `${transitionOptions?.delay || 0}ms`,
  } as React.CSSProperties;

  // Generate class names
  const modalClasses = classNames(
    'modal',
    {
      'modal--open': isOpen,
      'modal--animated': !disableAnimation,
      [`modal--${size}`]: size,
      [styles['fade-enter']]: isOpen && !disableAnimation,
      [styles['fade-exit']]: !isOpen && !disableAnimation,
    },
    className
  );

  if (!isOpen) return null;

  return (
    <FocusTrap active={isOpen} focusTrapOptions={{ initialFocus: false }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId.current}
        aria-describedby={ariaDescribedBy || contentId.current}
        aria-label={ariaLabel}
        className="modal-backdrop"
        onClick={handleBackdropClick}
        onTransitionEnd={handleTransitionEnd}
      >
        <div
          ref={modalRef}
          id={modalId.current}
          className={modalClasses}
          style={modalStyles}
        >
          <header className="modal__header">
            {title && (
              <h2 id={titleId.current} className="modal__title">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                type="button"
                className="modal__close"
                onClick={onClose}
                aria-label="Close modal"
              >
                <span aria-hidden="true">&times;</span>
              </button>
            )}
          </header>

          <div id={contentId.current} className="modal__content">
            {children}
          </div>

          {footer && (
            <footer className="modal__footer">
              {footer}
            </footer>
          )}
        </div>
      </div>
    </FocusTrap>
  );
};

export default Modal;