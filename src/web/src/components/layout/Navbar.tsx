import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; // ^6.0.0
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { SENSOR_STATUS } from '../../constants/sensor.constants';

// Interface definitions
interface NavbarProps {
  className?: string;
  children?: React.ReactNode;
  mfaStatus?: string;
  sensorStatus?: SENSOR_STATUS;
  isLoading?: boolean;
}

interface NavItem {
  label: string;
  path: string;
  icon: string;
  roles: string[];
  requiresMFA: boolean;
  requiredSensors?: SENSOR_STATUS[];
}

// Navigation items with role-based access and MFA requirements
const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: 'dashboard',
    roles: ['athlete', 'coach', 'medical'],
    requiresMFA: false
  },
  {
    label: 'Real-time View',
    path: '/realtime',
    icon: 'sensors',
    roles: ['athlete', 'coach', 'medical'],
    requiresMFA: true,
    requiredSensors: [SENSOR_STATUS.ACTIVE]
  },
  {
    label: 'Analytics',
    path: '/analytics',
    icon: 'analytics',
    roles: ['coach', 'medical'],
    requiresMFA: true
  },
  {
    label: 'Team',
    path: '/team',
    icon: 'groups',
    roles: ['coach'],
    requiresMFA: true
  },
  {
    label: 'Profile',
    path: '/profile',
    icon: 'person',
    roles: ['athlete', 'coach', 'medical'],
    requiresMFA: false
  }
];

const Navbar: React.FC<NavbarProps> = ({
  className = '',
  children,
  mfaStatus,
  sensorStatus = SENSOR_STATUS.DISCONNECTED,
  isLoading = false
}) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, user, logout } = useAuth();

  // State management
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeRoute, setActiveRoute] = useState(window.location.pathname);
  const [isNavigating, setIsNavigating] = useState(false);

  // Compute authorized navigation items based on user role
  const authorizedNavItems = useMemo(() => {
    if (!user?.role) return [];
    return NAV_ITEMS.filter(item => item.roles.includes(user.role));
  }, [user?.role]);

  // Enhanced navigation handler with security checks
  const handleNavigation = useCallback(async (path: string) => {
    try {
      setIsNavigating(true);
      const navItem = NAV_ITEMS.find(item => item.path === path);

      if (!navItem) return false;

      // Validate MFA requirement
      if (navItem.requiresMFA && mfaStatus !== 'verified') {
        navigate('/mfa-verification', { state: { returnPath: path } });
        return false;
      }

      // Validate sensor requirements
      if (navItem.requiredSensors?.length && !navItem.requiredSensors.includes(sensorStatus)) {
        // Show sensor status warning
        return false;
      }

      setActiveRoute(path);
      setIsMobileMenuOpen(false);
      navigate(path);
      return true;
    } catch (error) {
      console.error('Navigation error:', error);
      return false;
    } finally {
      setIsNavigating(false);
    }
  }, [navigate, mfaStatus, sensorStatus]);

  // Enhanced logout handler with session cleanup
  const handleLogout = useCallback(async () => {
    try {
      setIsNavigating(true);
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsNavigating(false);
    }
  }, [logout, navigate]);

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Render navigation items with accessibility support
  const renderNavItems = () => (
    <ul className="nav-items" role="menubar">
      {authorizedNavItems.map((item) => (
        <li
          key={item.path}
          role="menuitem"
          className={`nav-item ${activeRoute === item.path ? 'active' : ''}`}
        >
          <button
            onClick={() => handleNavigation(item.path)}
            className="nav-button"
            aria-current={activeRoute === item.path ? 'page' : undefined}
            disabled={isNavigating}
          >
            <span className="material-icons" aria-hidden="true">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {item.requiresMFA && (
              <span className="mfa-indicator" aria-label="Requires MFA verification">
                <span className="material-icons">security</span>
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <nav
      className={`navbar ${className} ${theme.mode}`}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="navbar-brand">
        <button
          className="mobile-menu-button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-expanded={isMobileMenuOpen}
          aria-controls="navigation-menu"
          aria-label="Toggle navigation menu"
        >
          <span className="material-icons">
            {isMobileMenuOpen ? 'close' : 'menu'}
          </span>
        </button>
        <img
          src="/logo.svg"
          alt="Smart Apparel Logo"
          className="brand-logo"
          width="32"
          height="32"
        />
      </div>

      <div
        id="navigation-menu"
        className={`navigation-menu ${isMobileMenuOpen ? 'open' : ''}`}
        aria-hidden={!isMobileMenuOpen}
      >
        {renderNavItems()}
      </div>

      <div className="navbar-actions" role="group" aria-label="User actions">
        <div className="sensor-status" aria-live="polite">
          <span className="material-icons" aria-hidden="true">
            {sensorStatus === SENSOR_STATUS.ACTIVE ? 'sensors' : 'sensors_off'}
          </span>
          <span className="status-label">
            {SENSOR_STATUS[sensorStatus]}
          </span>
        </div>

        <button
          onClick={toggleTheme}
          className="theme-toggle"
          aria-label={`Switch to ${theme.mode === 'light' ? 'dark' : 'light'} mode`}
        >
          <span className="material-icons">
            {theme.mode === 'light' ? 'dark_mode' : 'light_mode'}
          </span>
        </button>

        {isAuthenticated && (
          <button
            onClick={handleLogout}
            className="logout-button"
            disabled={isNavigating}
            aria-label="Log out"
          >
            <span className="material-icons">logout</span>
          </button>
        )}
      </div>

      {children}
    </nav>
  );
};

export default React.memo(Navbar);