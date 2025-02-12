/**
 * @fileoverview Enhanced TeamList component for displaying team members with real-time updates
 * Implements Material Design 3.0, WCAG 2.1 Level AA accessibility, and comprehensive security controls
 * @version 1.0.0
 */

import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import classNames from 'classnames';
import { usePerformanceTracking } from '@performance/tracking';
import type { UUID } from 'crypto';

import { ITeam } from '../../interfaces/team.interface';
import { useTeam } from '../../hooks/useTeam';

// Constants for virtualization and performance
const ITEM_SIZE = 72; // Material Design 3.0 list item height
const OVERSCAN = 5;

interface ITeamListProps {
  teamId: UUID;
  className?: string;
  onAthleteSelect?: (athleteId: UUID) => void;
  showActions?: boolean;
  filterBy?: string;
  sortBy?: 'name' | 'performance' | 'status';
  securityContext?: ISecurityContext;
  performanceTracking?: IPerformanceConfig;
  accessibilityConfig?: IAccessibilityConfig;
}

/**
 * Enhanced TeamList component with real-time updates and accessibility features
 */
const TeamList: React.FC<ITeamListProps> = ({
  teamId,
  className,
  onAthleteSelect,
  showActions = true,
  filterBy = '',
  sortBy = 'name',
  securityContext,
  performanceTracking,
  accessibilityConfig
}) => {
  // Initialize hooks and state
  const {
    team,
    loading,
    error,
    addMember,
    removeMember,
    refreshStats
  } = useTeam(teamId);

  const [listRef, setListRef] = useState<HTMLDivElement | null>(null);
  const { trackEvent, trackTiming } = usePerformanceTracking(performanceTracking);

  // Virtual list configuration
  const rowVirtualizer = useVirtualizer({
    count: team?.athleteIds?.length || 0,
    getScrollElement: () => listRef,
    estimateSize: () => ITEM_SIZE,
    overscan: OVERSCAN
  });

  // Memoized filtered and sorted athlete list
  const athletes = useMemo(() => {
    if (!team?.athleteIds) return [];

    let filtered = team.athleteIds;

    // Apply filtering
    if (filterBy) {
      filtered = filtered.filter(id => 
        team.stats?.performanceMetrics[id]?.toString().includes(filterBy)
      );
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'performance':
          return (team.stats?.performanceMetrics[b] || 0) - 
                 (team.stats?.performanceMetrics[a] || 0);
        case 'status':
          return (team.stats?.activeSessions[b] ? 1 : 0) - 
                 (team.stats?.activeSessions[a] ? 1 : 0);
        case 'name':
        default:
          return 0; // Maintain original order
      }
    });
  }, [team?.athleteIds, team?.stats, filterBy, sortBy]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent, athleteId: UUID) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        onAthleteSelect?.(athleteId);
        break;
      case 'ArrowDown':
        event.preventDefault();
        const nextElement = document.querySelector(`[data-athlete-index="${rowVirtualizer.getVirtualItems().findIndex(item => item.index === athleteId) + 1}"]`);
        (nextElement as HTMLElement)?.focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        const prevElement = document.querySelector(`[data-athlete-index="${rowVirtualizer.getVirtualItems().findIndex(item => item.index === athleteId) - 1}"]`);
        (prevElement as HTMLElement)?.focus();
        break;
    }
  }, [onAthleteSelect, rowVirtualizer]);

  // Set up real-time updates subscription
  useEffect(() => {
    const startTime = performance.now();
    let subscription: ZenObservable.Subscription;

    const setupSubscription = async () => {
      try {
        subscription = await team?.subscribeToUpdates((updatedStats) => {
          refreshStats();
          trackEvent('teamStatsUpdate', { teamId });
        });
      } catch (error) {
        console.error('Failed to subscribe to team updates:', error);
      }
    };

    setupSubscription();
    trackTiming('teamListMount', performance.now() - startTime);

    return () => {
      subscription?.unsubscribe();
    };
  }, [team, teamId, refreshStats, trackEvent, trackTiming]);

  if (loading) {
    return (
      <div 
        className={classNames('team-list-loading', className)}
        role="progressbar"
        aria-busy="true"
        aria-label="Loading team members"
      >
        <div className="team-list-loading-indicator" />
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className={classNames('team-list-error', className)}
        role="alert"
        aria-live="polite"
      >
        <p>Failed to load team members. Please try again.</p>
        <button 
          onClick={() => refreshStats()}
          aria-label="Retry loading team members"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      ref={setListRef}
      className={classNames('team-list', className)}
      role="list"
      aria-label="Team members list"
      style={{
        height: '100%',
        overflow: 'auto'
      }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const athleteId = athletes[virtualRow.index];
          const isActive = team?.stats?.activeSessions[athleteId];
          const performance = team?.stats?.performanceMetrics[athleteId];

          return (
            <div
              key={athleteId}
              data-athlete-index={virtualRow.index}
              className={classNames('team-list-item', {
                'team-list-item-active': isActive
              })}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${ITEM_SIZE}px`,
                transform: `translateY(${virtualRow.start}px)`
              }}
              role="listitem"
              tabIndex={0}
              onClick={() => onAthleteSelect?.(athleteId)}
              onKeyDown={(e) => handleKeyDown(e, athleteId)}
              aria-selected={false}
            >
              <div className="team-list-item-content">
                <span className="team-list-item-name">
                  {/* Name would be fetched from a user store */}
                  Athlete {athleteId.slice(0, 8)}
                </span>
                {performance !== undefined && (
                  <span 
                    className="team-list-item-performance"
                    aria-label={`Performance: ${performance}`}
                  >
                    {performance}
                  </span>
                )}
                {isActive && (
                  <span 
                    className="team-list-item-status"
                    aria-label="Active session in progress"
                  >
                    Active
                  </span>
                )}
                {showActions && (
                  <div className="team-list-item-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeMember(athleteId);
                      }}
                      aria-label="Remove team member"
                      className="team-list-item-remove"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TeamList;