/**
 * @fileoverview AthleteCard component for displaying athlete information with security controls
 * Implements Material Design card layout with comprehensive security, accessibility,
 * and real-time update features for team management views
 * @version 1.0.0
 */

import React, { useEffect, useMemo, useCallback, useState } from 'react';
import classNames from 'classnames'; // ^2.3.0
import { useDataSecurity } from '@athlete/security'; // ^1.0.0

import Card from '../common/Card';
import { IAthlete } from '../../interfaces/athlete.interface';
import { useTeam } from '../../hooks/useTeam';

/**
 * Props interface for the AthleteCard component with enhanced security
 * and accessibility features
 */
interface IAthleteCardProps {
  athlete: IAthlete;
  className?: string;
  onSelect?: (athlete: IAthlete, trackingData: ITrackingData) => void;
  showActions?: boolean;
  securityContext: ISecurityContext;
  realTimeUpdate?: boolean;
  accessibilityLabel?: string;
}

/**
 * Interface for performance tracking data
 */
interface ITrackingData {
  timestamp: Date;
  interactionType: string;
  metrics: {
    renderTime: number;
    updateCount: number;
  };
}

/**
 * Formats and secures athlete metrics for display
 * @param baselineData - Raw athlete baseline data
 * @param securityContext - Security context for access control
 * @returns Secured and formatted metrics object
 */
const formatMetrics = (
  baselineData: IAthlete['baselineData'],
  securityContext: ISecurityContext
) => {
  const { encryptData, hasAccess } = useDataSecurity();

  // Verify access permissions for each metric type
  const metrics = {
    muscleActivity: hasAccess('muscleActivity') 
      ? encryptData(baselineData.muscleProfiles)
      : null,
    symmetry: hasAccess('symmetry')
      ? encryptData(baselineData.symmetryMetrics)
      : null,
    forceDistribution: hasAccess('forceDistribution')
      ? encryptData(baselineData.forceDistribution)
      : null
  };

  return Object.entries(metrics).reduce((acc, [key, value]) => ({
    ...acc,
    [key]: value ? {
      value,
      lastUpdated: baselineData.lastUpdated,
      accessLevel: securityContext.accessLevel
    } : { restricted: true }
  }), {});
};

/**
 * AthleteCard component that displays athlete information with comprehensive
 * security controls and real-time updates
 */
const AthleteCard: React.FC<IAthleteCardProps> = React.memo(({
  athlete,
  className,
  onSelect,
  showActions = true,
  securityContext,
  realTimeUpdate = false,
  accessibilityLabel
}) => {
  const [metrics, setMetrics] = useState(formatMetrics(athlete.baselineData, securityContext));
  const [updateCount, setUpdateCount] = useState(0);
  const renderStartTime = useMemo(() => performance.now(), []);

  const { addMember, removeMember, subscribeToUpdates } = useTeam();

  // Handle real-time updates subscription
  useEffect(() => {
    if (!realTimeUpdate) return;

    let subscription: ZenObservable.Subscription;

    const setupSubscription = async () => {
      try {
        subscription = await subscribeToUpdates(athlete.id, (updatedData) => {
          setMetrics(formatMetrics(updatedData.baselineData, securityContext));
          setUpdateCount(prev => prev + 1);
        });
      } catch (error) {
        console.error('Subscription error:', error);
      }
    };

    setupSubscription();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [athlete.id, realTimeUpdate, securityContext]);

  // Handle athlete selection with tracking data
  const handleSelect = useCallback(() => {
    if (!onSelect) return;

    const trackingData: ITrackingData = {
      timestamp: new Date(),
      interactionType: 'select',
      metrics: {
        renderTime: performance.now() - renderStartTime,
        updateCount
      }
    };

    onSelect(athlete, trackingData);
  }, [athlete, onSelect, renderStartTime, updateCount]);

  // Memoized card classes
  const cardClasses = useMemo(() => classNames(
    'athlete-card',
    {
      'athlete-card--interactive': !!onSelect,
      'athlete-card--restricted': !securityContext.hasFullAccess
    },
    className
  ), [className, onSelect, securityContext.hasFullAccess]);

  return (
    <Card
      className={cardClasses}
      elevation={2}
      onClick={handleSelect}
      role="article"
      ariaLabel={accessibilityLabel || `Athlete card for ${athlete.name}`}
    >
      <div className="athlete-card__content">
        <div className="athlete-card__header">
          <h3 className="athlete-card__name">{athlete.name}</h3>
          {securityContext.hasFullAccess && (
            <div className="athlete-card__security-badge" aria-label="Full access granted">
              <span className="material-icons">verified</span>
            </div>
          )}
        </div>

        <div className="athlete-card__metrics" aria-live="polite">
          {Object.entries(metrics).map(([key, data]) => (
            data.restricted ? (
              <div 
                key={key}
                className="athlete-card__metric athlete-card__metric--restricted"
                aria-label={`${key} data restricted`}
              >
                <span className="material-icons">lock</span>
                <p>Access Restricted</p>
              </div>
            ) : (
              <div 
                key={key}
                className="athlete-card__metric"
                aria-label={`${key} metrics`}
              >
                <h4>{key}</h4>
                <p>{data.value}</p>
                <small>Last updated: {new Date(data.lastUpdated).toLocaleString()}</small>
              </div>
            )
          ))}
        </div>

        {showActions && securityContext.hasFullAccess && (
          <div 
            className="athlete-card__actions"
            role="group"
            aria-label="Athlete card actions"
          >
            <button
              onClick={() => addMember(athlete.id)}
              aria-label="Add to team"
              className="athlete-card__action-btn"
            >
              <span className="material-icons">person_add</span>
            </button>
            <button
              onClick={() => removeMember(athlete.id)}
              aria-label="Remove from team"
              className="athlete-card__action-btn"
            >
              <span className="material-icons">person_remove</span>
            </button>
          </div>
        )}
      </div>
    </Card>
  );
});

// Display name for debugging
AthleteCard.displayName = 'AthleteCard';

export default AthleteCard;