/**
 * @fileoverview Enhanced Header Component with Material Design 3.0
 * Implements secure user authentication display, theme switching, and responsive navigation
 * with comprehensive accessibility features and role-based content display
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import classNames from 'classnames'; // v2.3.0
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../common/Button';

interface HeaderProps {
  className?: string;
  style?: React.CSSProperties;
  enableSystemTheme?: boolean;
  direction?: 'ltr' | 'rtl';
}

export const Header: React.FC<HeaderProps> = ({
  className,
  style,
  enableSystemTheme = true,
  direction = 'ltr'
}) => {
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, user, logout, sessionTimeRemaining } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [sessionWarning, setSessionWarning] = useState(false);

  // Session timeout warning threshold (5 minutes)
  const SESSION_WARNING_THRESHOLD = 5 * 60 * 1000;

  /**
   * Enhanced theme toggle with smooth transition
   */
  const handleThemeToggle = useCallback(() => {
    document.documentElement.style.setProperty('--theme-transition', 'all 0.3s ease');
    toggleTheme();
    setTimeout(() => {
      document.documentElement.style.removeProperty('--theme-transition');
    }, 300);
  }, [toggleTheme]);

  /**
   * Secure logout handler with session cleanup
   */
  const handleLogout = useCallback(async () => {
    try {
      setIsMenuOpen(false);
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [logout]);

  /**
   * Session timeout monitoring
   */
  useEffect(() => {
    if (isAuthenticated && sessionTimeRemaining) {
      const showWarning = sessionTimeRemaining <= SESSION_WARNING_THRESHOLD;
      setSessionWarning(showWarning);
    }
  }, [isAuthenticated, sessionTimeRemaining]);

  /**
   * Menu toggle handler with accessibility
   */
  const handleMenuToggle = useCallback(() => {
    setIsMenuOpen(prev => !prev);
  }, []);

  return (
    <header
      className={classNames(
        'md-header',
        `md-header--${theme.mode}`,
        {
          'md-header--rtl': direction === 'rtl',
          'md-header--warning': sessionWarning
        },
        className
      )}
      style={style}
      role="banner"
      aria-label="Main header"
      dir={direction}
    >
      <div className="md-header__container">
        {/* Logo and branding */}
        <div className="md-header__brand">
          <img 
            src="/logo.svg" 
            alt="Smart Apparel Logo" 
            className="md-header__logo"
            width="32"
            height="32"
          />
          <span className="md-header__title">Smart Apparel</span>
        </div>

        {/* Navigation controls */}
        <nav className="md-header__nav" role="navigation" aria-label="Main navigation">
          {isAuthenticated && (
            <>
              <Button
                variant="text"
                color="primary"
                aria-label="Dashboard"
                className="md-header__nav-item"
              >
                Dashboard
              </Button>
              <Button
                variant="text"
                color="primary"
                aria-label="Analytics"
                className="md-header__nav-item"
              >
                Analytics
              </Button>
              {user?.role === 'COACH' && (
                <Button
                  variant="text"
                  color="primary"
                  aria-label="Team Management"
                  className="md-header__nav-item"
                >
                  Team
                </Button>
              )}
            </>
          )}
        </nav>

        {/* Actions section */}
        <div className="md-header__actions">
          {/* Theme toggle */}
          <Button
            variant="outlined"
            size="small"
            aria-label={`Switch to ${theme.mode === 'light' ? 'dark' : 'light'} theme`}
            onClick={handleThemeToggle}
            className="md-header__theme-toggle"
          >
            {theme.mode === 'light' ? '🌙' : '☀️'}
          </Button>

          {/* User menu */}
          {isAuthenticated && user && (
            <div className="md-header__user">
              <Button
                variant="text"
                aria-label="Open user menu"
                aria-expanded={isMenuOpen}
                aria-haspopup="true"
                onClick={handleMenuToggle}
                className="md-header__user-button"
              >
                <span className="md-header__user-name">{user.name}</span>
                {sessionWarning && (
                  <span className="md-header__session-warning" role="alert">
                    Session expiring soon
                  </span>
                )}
              </Button>

              {isMenuOpen && (
                <div 
                  className="md-header__menu"
                  role="menu"
                  aria-label="User menu"
                >
                  <Button
                    variant="text"
                    fullWidth
                    aria-label="View profile"
                    className="md-header__menu-item"
                    role="menuitem"
                  >
                    Profile
                  </Button>
                  <Button
                    variant="text"
                    fullWidth
                    aria-label="View settings"
                    className="md-header__menu-item"
                    role="menuitem"
                  >
                    Settings
                  </Button>
                  <Button
                    variant="text"
                    fullWidth
                    color="error"
                    aria-label="Log out"
                    onClick={handleLogout}
                    className="md-header__menu-item"
                    role="menuitem"
                  >
                    Logout
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Login button for unauthenticated users */}
          {!isAuthenticated && (
            <Button
              variant="contained"
              color="primary"
              aria-label="Log in"
              className="md-header__login"
            >
              Login
            </Button>
          )}
        </div>
      </div>

      {/* Session warning banner */}
      {sessionWarning && (
        <div 
          className="md-header__warning-banner" 
          role="alert"
          aria-live="polite"
        >
          Your session will expire soon. Please save your work.
        </div>
      )}
    </header>
  );
};

export default Header;