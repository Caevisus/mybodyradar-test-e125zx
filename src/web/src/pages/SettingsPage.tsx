/**
 * @fileoverview Settings Page Component for Smart Apparel System
 * Implements Material Design 3.0 and WCAG 2.1 Level AA accessibility standards
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import NotificationSettings from '../components/settings/NotificationSettings';
import ProfileSettings from '../components/settings/ProfileSettings';
import SecuritySettings from '../components/settings/SecuritySettings';
import Tabs from '../components/common/Tabs';
import { useAuth } from '../hooks/useAuth';

// Interface for settings tab configuration
interface ISettingsTab {
  id: string;
  label: string;
  component: React.ReactNode;
  requiredRole: string[];
  ariaLabel: string;
  icon: string;
}

/**
 * Settings page component with role-based access control and accessibility features
 */
const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, refreshSession, userRole, permissions } = useAuth();
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('tab') || 'profile');
  const [error, setError] = useState<string | null>(null);

  // Settings tabs configuration with role-based access control
  const settingsTabs: ISettingsTab[] = [
    {
      id: 'profile',
      label: 'Profile',
      component: (
        <ProfileSettings
          onSave={async (data) => {
            try {
              await handleSettingsSave('profile', data);
              await refreshSession();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to save profile settings');
            }
          }}
          onCancel={() => navigate('/dashboard')}
          onError={setError}
        />
      ),
      requiredRole: ['ATHLETE', 'COACH', 'MEDICAL', 'ADMIN'],
      ariaLabel: 'Profile settings tab',
      icon: 'person'
    },
    {
      id: 'security',
      label: 'Security',
      component: (
        <SecuritySettings
          showTwoFactor={true}
          showBiometric={true}
          showHardwareKey={userRole === 'ADMIN' || userRole === 'MEDICAL'}
          userRole={userRole || undefined}
          sessionDuration={getSessionDurationByRole(userRole)}
        />
      ),
      requiredRole: ['ATHLETE', 'COACH', 'MEDICAL', 'ADMIN'],
      ariaLabel: 'Security settings tab',
      icon: 'security'
    },
    {
      id: 'notifications',
      label: 'Notifications',
      component: (
        <NotificationSettings
          onSettingsChange={async (settings) => {
            try {
              await handleSettingsSave('notifications', settings);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to save notification settings');
            }
          }}
          userId={user?.id || ''}
        />
      ),
      requiredRole: ['ATHLETE', 'COACH', 'MEDICAL', 'ADMIN'],
      ariaLabel: 'Notification settings tab',
      icon: 'notifications'
    }
  ];

  // Filter tabs based on user role and permissions
  const availableTabs = settingsTabs.filter(tab => 
    tab.requiredRole.includes(userRole || '') && 
    tab.requiredRole.every(role => permissions?.includes(role))
  );

  /**
   * Handles tab changes with URL synchronization and accessibility announcements
   */
  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
    
    // Announce tab change to screen readers
    const announcer = document.getElementById('settings-announcer');
    if (announcer) {
      announcer.textContent = `${tabId} settings tab selected`;
    }

    // Update document title for accessibility
    document.title = `${tabId.charAt(0).toUpperCase() + tabId.slice(1)} Settings - Smart Apparel`;
  }, [setSearchParams]);

  /**
   * Handles settings updates with validation and error handling
   */
  const handleSettingsSave = async (settingType: string, data: any): Promise<void> => {
    try {
      // Validate user permissions
      if (!permissions?.includes(userRole || '')) {
        throw new Error('Insufficient permissions');
      }

      // Update settings based on type
      switch (settingType) {
        case 'profile':
          // Handle profile settings update
          break;
        case 'security':
          // Handle security settings update
          break;
        case 'notifications':
          // Handle notification settings update
          break;
        default:
          throw new Error('Invalid settings type');
      }

      // Clear any existing errors
      setError(null);

      // Announce success to screen readers
      const announcer = document.getElementById('settings-announcer');
      if (announcer) {
        announcer.textContent = `${settingType} settings saved successfully`;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      throw err;
    }
  };

  // Initialize page title and validate session on mount
  useEffect(() => {
    document.title = 'Settings - Smart Apparel';
    
    const validateSession = async () => {
      try {
        await refreshSession();
      } catch (err) {
        setError('Session expired. Please log in again.');
        navigate('/login');
      }
    };

    validateSession();
  }, [navigate, refreshSession]);

  return (
    <div className="settings-page" role="main" aria-label="Settings page">
      {error && (
        <div 
          role="alert" 
          className="settings-page__error"
          aria-live="polite"
        >
          {error}
        </div>
      )}

      <h1 className="settings-page__title">Settings</h1>

      <Tabs
        tabs={availableTabs.map(tab => ({
          id: tab.id,
          label: tab.label,
          content: tab.component,
          ariaLabel: tab.ariaLabel,
          icon: tab.icon
        }))}
        activeTabId={activeTab}
        onTabChange={handleTabChange}
        orientation="horizontal"
        fullWidth={false}
        ariaLabel="Settings navigation"
        lazyLoad={true}
      />

      {/* Hidden live region for screen reader announcements */}
      <div
        id="settings-announcer"
        className="sr-only"
        role="status"
        aria-live="polite"
      />
    </div>
  );
};

/**
 * Helper function to get session duration based on user role
 */
const getSessionDurationByRole = (role: string | null): number => {
  switch (role) {
    case 'ADMIN':
      return 4 * 60 * 60 * 1000; // 4 hours
    case 'MEDICAL':
      return 8 * 60 * 60 * 1000; // 8 hours
    case 'COACH':
      return 12 * 60 * 60 * 1000; // 12 hours
    default:
      return 24 * 60 * 60 * 1000; // 24 hours
  }
};

export default SettingsPage;