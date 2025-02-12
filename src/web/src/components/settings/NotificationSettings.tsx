/**
 * @fileoverview Notification settings component for smart apparel system
 * Implements Material Design 3.0 and WCAG 2.1 Level AA accessibility standards
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react'; // ^18.0.0
import { Switch, FormGroup, FormControlLabel, Radio, RadioGroup, Typography, Alert } from '@mui/material'; // ^5.0.0
import { debounce } from 'lodash'; // ^4.17.21
import Card from '../common/Card';
import { IBaseProps } from '../../interfaces/common.interface';
import { StorageService } from '../../services/storage.service';

// Storage key for notification preferences
const STORAGE_KEY = 'notification_preferences';
const storageService = new StorageService(process.env.REACT_APP_ENCRYPTION_KEY || '');

/**
 * Enum for notification delivery methods
 */
export enum NotificationMethod {
  APP = 'APP',
  EMAIL = 'EMAIL',
  BOTH = 'BOTH'
}

/**
 * Interface for notification preferences
 */
export interface INotificationPreferences {
  highImpactAlerts: boolean;
  performanceUpdates: boolean;
  teamMessages: boolean;
  notificationMethod: NotificationMethod;
  lastUpdated: Date;
  userId: string;
}

/**
 * Props interface extending base props
 */
export interface INotificationSettingsProps extends IBaseProps {
  onSettingsChange: (settings: INotificationPreferences) => void;
  userId: string;
  initialSettings?: INotificationPreferences;
}

/**
 * Default notification preferences
 */
const defaultPreferences: INotificationPreferences = {
  highImpactAlerts: true,
  performanceUpdates: true,
  teamMessages: true,
  notificationMethod: NotificationMethod.APP,
  lastUpdated: new Date(),
  userId: ''
};

/**
 * NotificationSettings component for managing user notification preferences
 * Implements WCAG 2.1 Level AA accessibility standards
 */
export const NotificationSettings: React.FC<INotificationSettingsProps> = ({
  onSettingsChange,
  userId,
  initialSettings,
  className,
  testId = 'notification-settings'
}) => {
  // State for preferences and loading status
  const [preferences, setPreferences] = useState<INotificationPreferences>({
    ...defaultPreferences,
    userId
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounced save function to prevent excessive storage operations
  const debouncedSave = useCallback(
    debounce((newPreferences: INotificationPreferences) => {
      try {
        storageService.setItem(
          `${STORAGE_KEY}_${userId}`,
          newPreferences,
          true
        );
        onSettingsChange(newPreferences);
      } catch (err) {
        setError('Failed to save preferences. Please try again.');
        console.error('Storage error:', err);
      }
    }, 500),
    [userId, onSettingsChange]
  );

  // Load saved preferences on component mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const saved = storageService.getItem<INotificationPreferences>(
          `${STORAGE_KEY}_${userId}`,
          true
        );
        
        if (saved) {
          setPreferences(saved);
        } else if (initialSettings) {
          setPreferences(initialSettings);
        }
      } catch (err) {
        setError('Failed to load preferences');
        console.error('Preference loading error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [userId, initialSettings]);

  // Handle preference changes
  const handlePreferenceChange = (
    preferenceName: keyof INotificationPreferences,
    value: boolean | NotificationMethod
  ) => {
    const newPreferences = {
      ...preferences,
      [preferenceName]: value,
      lastUpdated: new Date()
    };
    
    setPreferences(newPreferences);
    debouncedSave(newPreferences);
  };

  if (isLoading) {
    return (
      <Card
        testId={`${testId}-loading`}
        className={className}
        role="status"
        ariaLabel="Loading notification preferences"
      >
        <Typography>Loading preferences...</Typography>
      </Card>
    );
  }

  return (
    <Card
      testId={testId}
      className={className}
      role="form"
      ariaLabel="Notification preferences"
    >
      {error && (
        <Alert 
          severity="error" 
          onClose={() => setError(null)}
          sx={{ marginBottom: 2 }}
        >
          {error}
        </Alert>
      )}

      <Typography variant="h6" component="h2" gutterBottom>
        Notification Preferences
      </Typography>

      <FormGroup>
        <FormControlLabel
          control={
            <Switch
              checked={preferences.highImpactAlerts}
              onChange={(e) => handlePreferenceChange('highImpactAlerts', e.target.checked)}
              inputProps={{
                'aria-label': 'High impact alerts toggle',
                'role': 'switch'
              }}
            />
          }
          label="High Impact Alerts"
        />

        <FormControlLabel
          control={
            <Switch
              checked={preferences.performanceUpdates}
              onChange={(e) => handlePreferenceChange('performanceUpdates', e.target.checked)}
              inputProps={{
                'aria-label': 'Performance updates toggle',
                'role': 'switch'
              }}
            />
          }
          label="Performance Updates"
        />

        <FormControlLabel
          control={
            <Switch
              checked={preferences.teamMessages}
              onChange={(e) => handlePreferenceChange('teamMessages', e.target.checked)}
              inputProps={{
                'aria-label': 'Team messages toggle',
                'role': 'switch'
              }}
            />
          }
          label="Team Messages"
        />
      </FormGroup>

      <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>
        Notification Method
      </Typography>

      <RadioGroup
        value={preferences.notificationMethod}
        onChange={(e) => handlePreferenceChange('notificationMethod', e.target.value as NotificationMethod)}
        aria-label="notification method selection"
      >
        <FormControlLabel
          value={NotificationMethod.APP}
          control={<Radio />}
          label="App Only"
        />
        <FormControlLabel
          value={NotificationMethod.EMAIL}
          control={<Radio />}
          label="Email Only"
        />
        <FormControlLabel
          value={NotificationMethod.BOTH}
          control={<Radio />}
          label="Both App and Email"
        />
      </RadioGroup>

      <Typography 
        variant="caption" 
        color="textSecondary"
        sx={{ mt: 2, display: 'block' }}
      >
        Last updated: {preferences.lastUpdated.toLocaleString()}
      </Typography>
    </Card>
  );
};

export default NotificationSettings;