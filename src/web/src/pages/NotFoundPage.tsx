/**
 * @fileoverview 404 Not Found page component implementing Material Design 3.0
 * Provides an accessible and user-friendly error page with clear navigation options
 * @version 1.0.0
 */

import React, { useEffect } from 'react';
import styled from '@emotion/styled';
import { Link } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import { ROUTES } from '../constants/route.constants';

// Styled components implementing Material Design 3.0
const NotFoundContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.base.xl};
  text-align: center;
  min-height: 60vh;
  gap: ${({ theme }) => theme.spacing.base.lg};

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    padding: ${({ theme }) => theme.spacing.base.lg};
    gap: ${({ theme }) => theme.spacing.base.md};
  }
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize.display.md};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.primary.main};
  margin: 0;
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  line-height: 1.2;

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    font-size: ${({ theme }) => theme.typography.fontSize.display.sm};
  }
`;

const ErrorCode = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.display.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.primary.light};
  display: block;
  margin-bottom: ${({ theme }) => theme.spacing.base.md};

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    font-size: ${({ theme }) => theme.typography.fontSize.display.md};
  }
`;

const Description = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  color: ${({ theme }) => theme.colors.primary.dark};
  max-width: 600px;
  margin: 0;
  line-height: 1.6;
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    font-size: ${({ theme }) => theme.typography.fontSize.md};
  }
`;

const StyledLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => `${theme.spacing.base.md} ${theme.spacing.base.lg}`};
  background-color: ${({ theme }) => theme.colors.primary.main};
  color: ${({ theme }) => theme.colors.primary.contrast};
  border-radius: ${({ theme }) => theme.spacing.base.xs};
  text-decoration: none;
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  transition: all 0.2s ease;
  min-width: 200px;

  &:hover {
    background-color: ${({ theme }) => theme.colors.primary.dark};
    transform: translateY(-2px);
  }

  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.primary.main};
    outline-offset: 2px;
  }

  &:active {
    transform: translateY(0);
  }

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    width: 100%;
    max-width: 300px;
  }
`;

/**
 * NotFoundPage component providing a user-friendly 404 error page
 * with enhanced accessibility features
 */
const NotFoundPage: React.FC = () => {
  useEffect(() => {
    // Update document title for accessibility
    document.title = '404 - Page Not Found | Smart Apparel';

    // Log 404 occurrence for monitoring
    console.error('404 Error: Page not found', {
      path: window.location.pathname,
      timestamp: new Date().toISOString()
    });
  }, []);

  return (
    <MainLayout>
      <NotFoundContainer role="main" aria-labelledby="error-title">
        <div>
          <ErrorCode aria-hidden="true">404</ErrorCode>
          <Title id="error-title">Page Not Found</Title>
        </div>
        
        <Description>
          The page you're looking for doesn't exist or has been moved.
          Please check the URL or return to the dashboard.
        </Description>

        <StyledLink 
          to={ROUTES.DASHBOARD.ROOT}
          aria-label="Return to dashboard"
          role="button"
        >
          Return to Dashboard
        </StyledLink>
      </NotFoundContainer>
    </MainLayout>
  );
};

export default NotFoundPage;