/**
 * @fileoverview Enhanced Security Settings Component for Smart Apparel System
 * @version 1.0.0
 * 
 * Implements comprehensive security settings management with role-based authentication,
 * multi-factor authentication, biometric verification, and session control features.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'; // v7.2.0
import { Button } from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import type { IApiResponse } from '../../interfaces/common.interface';

interface SecuritySettingsProps {
  showTwoFactor?: boolean;
  showBiometric?: boolean;
  showHardwareKey?: boolean;
  userRole?: string;
  sessionDuration?: number;
}

interface SecurityPreferences {
  twoFactorEnabled: boolean;
  biometricEnabled: boolean;
  hardwareKeyEnabled: boolean;
  activeSessions: string[];
  preferredAuthMethod: string;
  sessionTimeout: number;
  lastSecurityUpdate: Date;
}

/**
 * Enhanced Security Settings component with comprehensive security features
 */
export const SecuritySettings: React.FC<SecuritySettingsProps> = ({
  showTwoFactor = true,
  showBiometric = true,
  showHardwareKey = true,
  userRole,
  sessionDuration
}) => {
  const { user, updateSecuritySettings, sessionInfo } = useAuth();
  const [preferences, setPreferences] = useState<SecurityPreferences>({
    twoFactorEnabled: false,
    biometricEnabled: false,
    hardwareKeyEnabled: false,
    activeSessions: [],
    preferredAuthMethod: 'password',
    sessionTimeout: sessionDuration || 3600000,
    lastSecurityUpdate: new Date()
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches current security preferences on component mount
   */
  useEffect(() => {
    const loadSecurityPreferences = async () => {
      try {
        setLoading(true);
        const response = await updateSecuritySettings({ action: 'GET' });
        if (response.success) {
          setPreferences(response.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load security preferences');
      } finally {
        setLoading(false);
      }
    };

    loadSecurityPreferences();
  }, [updateSecuritySettings]);

  /**
   * Handles changes to authentication methods based on user role
   */
  const handleAuthMethodChange = useCallback(async (method: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await updateSecuritySettings({
        action: 'UPDATE_AUTH_METHOD',
        method,
        userRole
      });

      if (response.success) {
        setPreferences(prev => ({
          ...prev,
          preferredAuthMethod: method,
          lastSecurityUpdate: new Date()
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update authentication method');
    } finally {
      setLoading(false);
    }
  }, [updateSecuritySettings, userRole]);

  /**
   * Configures biometric authentication for supported devices
   */
  const setupBiometric = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // Check device compatibility
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) {
        throw new Error('Biometric authentication not supported on this device');
      }

      const response = await updateSecuritySettings({
        action: 'SETUP_BIOMETRIC',
        userId: user?.id
      });

      if (response.success) {
        const credential = await startRegistration(response.data);
        
        const verificationResponse = await updateSecuritySettings({
          action: 'VERIFY_BIOMETRIC',
          credential
        });

        if (verificationResponse.success) {
          setPreferences(prev => ({
            ...prev,
            biometricEnabled: true,
            lastSecurityUpdate: new Date()
          }));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup biometric authentication');
    } finally {
      setLoading(false);
    }
  }, [updateSecuritySettings, user]);

  /**
   * Manages FIDO2 hardware key registration and verification
   */
  const manageHardwareKey = useCallback(async (isRegistration: boolean): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const action = isRegistration ? 'REGISTER_HARDWARE_KEY' : 'REMOVE_HARDWARE_KEY';
      const response = await updateSecuritySettings({
        action,
        userId: user?.id
      });

      if (response.success && isRegistration) {
        const credential = await startRegistration(response.data);
        
        const verificationResponse = await updateSecuritySettings({
          action: 'VERIFY_HARDWARE_KEY',
          credential
        });

        if (verificationResponse.success) {
          setPreferences(prev => ({
            ...prev,
            hardwareKeyEnabled: true,
            lastSecurityUpdate: new Date()
          }));
        }
      } else if (response.success) {
        setPreferences(prev => ({
          ...prev,
          hardwareKeyEnabled: false,
          lastSecurityUpdate: new Date()
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to manage hardware key');
    } finally {
      setLoading(false);
    }
  }, [updateSecuritySettings, user]);

  /**
   * Updates session timeout settings
   */
  const updateSessionTimeout = useCallback(async (timeout: number): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await updateSecuritySettings({
        action: 'UPDATE_SESSION_TIMEOUT',
        timeout
      });

      if (response.success) {
        setPreferences(prev => ({
          ...prev,
          sessionTimeout: timeout,
          lastSecurityUpdate: new Date()
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update session timeout');
    } finally {
      setLoading(false);
    }
  }, [updateSecuritySettings]);

  return (
    <div className="security-settings" data-testid="security-settings">
      <h2>Security Settings</h2>
      
      {error && (
        <div className="security-settings__error" role="alert">
          {error}
        </div>
      )}

      <section className="security-settings__section">
        <h3>Authentication Methods</h3>
        
        {showTwoFactor && (
          <div className="security-settings__option">
            <h4>Two-Factor Authentication</h4>
            <Button
              variant="outlined"
              color={preferences.twoFactorEnabled ? 'success' : 'primary'}
              onClick={() => handleAuthMethodChange('2fa')}
              disabled={loading}
              ariaLabel="Toggle two-factor authentication"
            >
              {preferences.twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
            </Button>
          </div>
        )}

        {showBiometric && (
          <div className="security-settings__option">
            <h4>Biometric Authentication</h4>
            <Button
              variant="outlined"
              color={preferences.biometricEnabled ? 'success' : 'primary'}
              onClick={setupBiometric}
              disabled={loading}
              ariaLabel="Setup biometric authentication"
            >
              {preferences.biometricEnabled ? 'Update Biometric' : 'Setup Biometric'}
            </Button>
          </div>
        )}

        {showHardwareKey && (
          <div className="security-settings__option">
            <h4>Security Key</h4>
            <Button
              variant="outlined"
              color={preferences.hardwareKeyEnabled ? 'success' : 'primary'}
              onClick={() => manageHardwareKey(!preferences.hardwareKeyEnabled)}
              disabled={loading}
              ariaLabel="Manage security key"
            >
              {preferences.hardwareKeyEnabled ? 'Remove Security Key' : 'Add Security Key'}
            </Button>
          </div>
        )}
      </section>

      <section className="security-settings__section">
        <h3>Session Management</h3>
        <div className="security-settings__option">
          <h4>Session Timeout</h4>
          <select
            value={preferences.sessionTimeout}
            onChange={(e) => updateSessionTimeout(Number(e.target.value))}
            disabled={loading}
          >
            <option value={1800000}>30 Minutes</option>
            <option value={3600000}>1 Hour</option>
            <option value={7200000}>2 Hours</option>
            <option value={14400000}>4 Hours</option>
          </select>
        </div>

        <div className="security-settings__option">
          <h4>Active Sessions</h4>
          <ul className="security-settings__sessions">
            {preferences.activeSessions.map((session) => (
              <li key={session}>
                <span>{session}</span>
                <Button
                  variant="text"
                  color="error"
                  onClick={() => updateSecuritySettings({
                    action: 'TERMINATE_SESSION',
                    sessionId: session
                  })}
                  disabled={loading}
                  ariaLabel="Terminate session"
                >
                  Terminate
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="security-settings__section">
        <h3>Security Status</h3>
        <div className="security-settings__status">
          <p>Last Security Update: {preferences.lastSecurityUpdate.toLocaleString()}</p>
          <p>Current Authentication Method: {preferences.preferredAuthMethod}</p>
          <p>Session Expires: {sessionInfo?.expiresAt ? new Date(sessionInfo.expiresAt).toLocaleString() : 'N/A'}</p>
        </div>
      </section>
    </div>
  );
};

export default SecuritySettings;