/**
 * @fileoverview Profile Page Component with Material Design 3.0
 * Implements secure user profile management with comprehensive accessibility
 * features and role-based access control for the smart-apparel system.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from '@emotion/styled';
import MainLayout from '../components/layout/MainLayout';
import ProfileSettings from '../components/settings/ProfileSettings';
import { useAuth } from '../hooks/useAuth';
import type { IApiResponse } from '../interfaces/common.interface';

// Styled components implementing Material Design 3.0
const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.base.lg};
  max-width: 800px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.base.xl};
  
  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    padding: ${({ theme }) => theme.spacing.base.md};
  }
`;

const PageTitle = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize.display.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.primary.main};
  margin-bottom: ${({ theme }) => theme.spacing.base.lg};
  
  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    font-size: ${({ theme }) => theme.typography.fontSize.xl};
  }
`;

const ErrorMessage = styled.div`
  color: ${({ theme }) => theme.colors.feedback.error};
  padding: ${({ theme }) => theme.spacing.base.md};
  border-radius: 4px;
  background-color: ${({ theme }) => theme.colors.feedback.error}10;
  margin-bottom: ${({ theme }) => theme.spacing.base.md};
`;

/**
 * Profile page component with secure profile management functionality
 */
const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshSession, validateSession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSessionValid, setIsSessionValid] = useState(true);

  // Session validation effect
  useEffect(() => {
    const checkSession = async () => {
      try {
        const isValid = await validateSession();
        setIsSessionValid(isValid);
        if (!isValid) {
          navigate('/login', { replace: true });
        }
      } catch (error) {
        setError('Session validation failed. Please log in again.');
        navigate('/login', { replace: true });
      }
    };

    checkSession();
  }, [validateSession, navigate]);

  /**
   * Handles profile update with security validation
   */
  const handleProfileUpdate = useCallback(async (formData: any): Promise<void> => {
    try {
      if (!isSessionValid) {
        throw new Error('Invalid session. Please log in again.');
      }

      // Validate and sanitize form data
      const sanitizedData = {
        ...formData,
        email: formData.email.trim().toLowerCase(),
        name: formData.name.trim(),
        phoneNumber: formData.phoneNumber?.trim() || null
      };

      // Submit update to API
      const response: IApiResponse = await fetch('/api/v1/profile/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify(sanitizedData)
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Profile update failed');
      }

      // Refresh session after successful update
      await refreshSession();
      
      // Navigate to dashboard
      navigate('/dashboard');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Profile update failed');
    }
  }, [isSessionValid, refreshSession, navigate]);

  /**
   * Handles cancellation of profile editing
   */
  const handleCancel = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  /**
   * Handles validation errors
   */
  const handleValidationError = useCallback((error: Error) => {
    setError(error.message);
  }, []);

  if (!user || !isSessionValid) {
    return null; // Prevent rendering while redirecting
  }

  return (
    <MainLayout
      requireAuth={true}
      securityContext={{
        allowedRoles: ['ATHLETE', 'COACH', 'MEDICAL', 'ADMIN'],
        requireMfa: true
      }}
    >
      <PageContainer role="main" aria-label="Profile Settings">
        <PageTitle>Profile Settings</PageTitle>

        {error && (
          <ErrorMessage role="alert" aria-live="polite">
            {error}
          </ErrorMessage>
        )}

        <ProfileSettings
          onSave={handleProfileUpdate}
          onCancel={handleCancel}
          onError={handleValidationError}
        />

        {/* Hidden live region for screen readers */}
        <div 
          className="sr-only" 
          role="status" 
          aria-live="polite"
        >
          {error ? 'Profile update failed. Please try again.' : ''}
        </div>
      </PageContainer>
    </MainLayout>
  );
};

export default ProfilePage;