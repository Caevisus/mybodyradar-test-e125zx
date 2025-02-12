/**
 * @fileoverview Main Layout Component with Material Design 3.0
 * Implements core layout structure with enhanced security, accessibility,
 * and responsive design features for the smart-apparel web application
 * @version 1.0.0
 */

import React, { useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import { ErrorBoundary } from 'react-error-boundary';
import Header from './Header';
import Footer from './Footer';
import { useAuth } from '../../contexts/AuthContext';

// Styled components implementing Material Design 3.0
const LayoutContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: ${({ theme }) => theme.colors.surface.light.background};
  transition: background-color 0.3s ease;

  @media (prefers-color-scheme: dark) {
    background-color: ${({ theme }) => theme.colors.surface.dark.background};
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const MainContent = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: ${({ theme }) => theme.breakpoints.xl};
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.base.lg};
  position: relative;

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    padding: ${({ theme }) => theme.spacing.base.md};
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing.base.sm};
  }
`;

const SkipLink = styled.a`
  position: absolute;
  left: -9999px;
  top: auto;
  width: 1px;
  height: 1px;
  overflow: hidden;

  &:focus {
    position: fixed;
    top: ${({ theme }) => theme.spacing.base.sm};
    left: ${({ theme }) => theme.spacing.base.sm};
    width: auto;
    height: auto;
    padding: ${({ theme }) => theme.spacing.base.sm};
    background: ${({ theme }) => theme.colors.primary.main};
    color: ${({ theme }) => theme.colors.primary.contrast};
    z-index: 9999;
    border-radius: 4px;
    outline: none;
  }
`;

// Props interface with security and accessibility features
interface MainLayoutProps {
  children: React.ReactNode;
  className?: string;
  requireAuth?: boolean;
  themeMode?: 'light' | 'dark' | 'system';
  securityContext?: {
    allowedRoles?: string[];
    requireMfa?: boolean;
    requireBiometric?: boolean;
  };
}

/**
 * Error Fallback component for ErrorBoundary
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert" aria-live="assertive">
    <h2>An error occurred</h2>
    <pre>{error.message}</pre>
  </div>
);

/**
 * MainLayout component implementing Material Design 3.0 with
 * enhanced security and accessibility features
 */
const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  className,
  requireAuth = false,
  themeMode = 'system',
  securityContext = {}
}) => {
  const { 
    isAuthenticated, 
    user, 
    sessionInfo,
    refreshSession,
    logout 
  } = useAuth();

  /**
   * Enhanced security check with session validation
   */
  const checkAuth = useCallback(async () => {
    if (requireAuth && !isAuthenticated) {
      await logout();
      return false;
    }

    if (securityContext.allowedRoles && 
        !securityContext.allowedRoles.includes(user?.role || '')) {
      await logout();
      return false;
    }

    if (securityContext.requireMfa && 
        !sessionInfo?.mfaVerified) {
      await logout();
      return false;
    }

    if (securityContext.requireBiometric && 
        !sessionInfo?.biometricVerified) {
      await logout();
      return false;
    }

    return true;
  }, [
    requireAuth, 
    isAuthenticated, 
    user, 
    sessionInfo, 
    securityContext, 
    logout
  ]);

  /**
   * Session monitoring and refresh
   */
  useEffect(() => {
    if (requireAuth && isAuthenticated) {
      const sessionCheck = setInterval(async () => {
        await refreshSession();
      }, 5 * 60 * 1000); // Check every 5 minutes

      return () => clearInterval(sessionCheck);
    }
  }, [requireAuth, isAuthenticated, refreshSession]);

  /**
   * Security validation on mount and updates
   */
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <LayoutContainer className={className}>
        {/* Accessibility skip link */}
        <SkipLink href="#main-content">
          Skip to main content
        </SkipLink>

        <Header 
          securityContext={securityContext}
        />

        <MainContent 
          id="main-content"
          role="main"
          aria-label="Main content"
        >
          {children}
        </MainContent>

        <Footer 
          companyName="Smart Apparel"
          version="1.0.0"
          socialLinks={[]}
          legalLinks={[]}
        />
      </LayoutContainer>
    </ErrorBoundary>
  );
};

export default MainLayout;