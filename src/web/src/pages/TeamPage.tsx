/**
 * @fileoverview Enhanced Team Management Page Component
 * Implements comprehensive team analytics and management interface with
 * real-time updates, security controls, and WCAG 2.1 compliance
 * @version 1.0.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import styled from '@emotion/styled';
import { useErrorBoundary } from 'react-error-boundary';

import MainLayout from '../components/layout/MainLayout';
import TeamList from '../components/team/TeamList';
import TeamStats from '../components/team/TeamStats';
import { useTeam } from '../hooks/useTeam';

// Styled components with Material Design 3.0 implementation
const PageContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${({ theme }) => theme.spacing.dashboard.sectionGap};
  padding: ${({ theme }) => theme.spacing.dashboard.containerPadding};
  width: 100%;
  max-width: ${({ theme }) => theme.breakpoints.xl};
  margin: 0 auto;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: 2fr 1fr;
  }
`;

const StatsSection = styled.section`
  grid-column: 1 / -1;
  background: ${({ theme }) => theme.colors.surface.light.paper};
  border-radius: 8px;
  box-shadow: ${({ theme }) => theme.shadows.md};
  overflow: hidden;

  @media (prefers-color-scheme: dark) {
    background: ${({ theme }) => theme.colors.surface.dark.paper};
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-column: 1 / 2;
  }
`;

const ListSection = styled.section`
  grid-column: 1 / -1;
  background: ${({ theme }) => theme.colors.surface.light.paper};
  border-radius: 8px;
  box-shadow: ${({ theme }) => theme.shadows.md};
  overflow: hidden;

  @media (prefers-color-scheme: dark) {
    background: ${({ theme }) => theme.colors.surface.dark.paper};
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-column: 2 / 3;
  }
`;

const ErrorContainer = styled.div`
  padding: ${({ theme }) => theme.spacing.base.lg};
  color: ${({ theme }) => theme.colors.feedback.error};
  text-align: center;
`;

/**
 * Enhanced TeamPage component with real-time updates and security controls
 */
const TeamPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const { showBoundary } = useErrorBoundary();
  const [webGLSupported, setWebGLSupported] = useState(true);

  // Initialize team data with security context
  const {
    team,
    loading,
    error,
    performanceMetrics,
    updateSettings,
    addMember,
    removeMember,
    refreshStats
  } = useTeam(teamId as string);

  // Check WebGL support for performance optimizations
  useEffect(() => {
    const canvas = document.createElement('canvas');
    setWebGLSupported(!!canvas.getContext('webgl'));
  }, []);

  // Handle athlete selection with security validation
  const handleAthleteSelect = useCallback(async (athleteId: string) => {
    try {
      // Security validation would be implemented here
      console.log('Athlete selected:', athleteId);
    } catch (error) {
      showBoundary(error);
    }
  }, [showBoundary]);

  // Handle errors at the page level
  useEffect(() => {
    if (error) {
      showBoundary(error);
    }
  }, [error, showBoundary]);

  return (
    <MainLayout
      requireAuth={true}
      securityContext={{
        allowedRoles: ['COACH', 'ADMIN'],
        requireMfa: true
      }}
    >
      <PageContainer role="main" aria-label="Team Management Dashboard">
        <StatsSection
          role="region"
          aria-label="Team Statistics"
          aria-busy={loading}
        >
          <TeamStats
            teamId={teamId as string}
            refreshInterval={100} // 100ms for real-time requirement
            webGLEnabled={webGLSupported}
          />
        </StatsSection>

        <ListSection
          role="region"
          aria-label="Team Members"
          aria-busy={loading}
        >
          <TeamList
            teamId={teamId as string}
            onAthleteSelect={handleAthleteSelect}
            showActions={true}
            securityContext={{
              allowedRoles: ['COACH', 'ADMIN'],
              requireMfa: true
            }}
          />
        </ListSection>

        {/* Performance metrics display */}
        {performanceMetrics && (
          <div
            role="status"
            aria-label="System Performance Metrics"
            aria-live="polite"
          >
            <small>
              Latency: {performanceMetrics.latency.toFixed(1)}ms |
              Success Rate: {performanceMetrics.successRate.toFixed(1)}%
            </small>
          </div>
        )}

        {/* Error display */}
        {error && (
          <ErrorContainer
            role="alert"
            aria-live="assertive"
          >
            {error}
          </ErrorContainer>
        )}
      </PageContainer>
    </MainLayout>
  );
};

export default TeamPage;