/**
 * @fileoverview Real-time activity feed component with virtualized rendering
 * Implements real-time monitoring and team-wide analytics with Material Design 3.0
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { VariableSizeList as VirtualList } from 'react-window'; // ^1.8.9
import classNames from 'classnames'; // ^2.3.0
import { format } from 'date-fns'; // ^2.30.0
import Card from '../common/Card';
import { useWebSocket } from '../../hooks/useWebSocket';

// Activity type definitions
export type ActivityType = 'sensor_event' | 'performance_update' | 'alert' | 'system_status';
export type ActivityPriority = 'low' | 'medium' | 'high' | 'critical';
export type TimeframeGroup = '24h' | 'today' | 'week' | 'custom';

/**
 * Interface for activity feed component props with enhanced customization
 */
export interface IActivityFeedProps {
  maxItems?: number;
  autoUpdate?: boolean;
  onActivityClick?: (activity: IActivity) => void;
  filterType?: ActivityType[];
  athleteIds?: string[];
  groupBy?: TimeframeGroup;
  virtualScrollProps?: {
    height: number;
    width: number | string;
    itemSize?: number;
    overscanCount?: number;
  };
  className?: string;
  testId?: string;
}

/**
 * Interface for individual activity items with comprehensive metadata
 */
export interface IActivity {
  id: string;
  type: ActivityType;
  timestamp: Date;
  title: string;
  description: string;
  athleteId: string;
  sessionId: string;
  metadata: Record<string, any>;
  priority: ActivityPriority;
  readStatus: boolean;
  interactionCount: number;
}

/**
 * Interface for grouped activities with statistics
 */
interface IActivityGroup {
  title: string;
  activities: IActivity[];
  stats: {
    total: number;
    priority: Record<ActivityPriority, number>;
  };
}

/**
 * Custom hook for activity grouping with memoization
 */
const useActivityGroups = (
  activities: IActivity[],
  groupBy: TimeframeGroup
): IActivityGroup[] => {
  return useMemo(() => {
    const sortedActivities = [...activities].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    const groups: IActivityGroup[] = [];
    let currentGroup: IActivityGroup | null = null;

    sortedActivities.forEach(activity => {
      const groupTitle = getGroupTitle(activity.timestamp, groupBy);
      
      if (!currentGroup || currentGroup.title !== groupTitle) {
        currentGroup = {
          title: groupTitle,
          activities: [],
          stats: {
            total: 0,
            priority: {
              low: 0,
              medium: 0,
              high: 0,
              critical: 0
            }
          }
        };
        groups.push(currentGroup);
      }

      currentGroup.activities.push(activity);
      currentGroup.stats.total++;
      currentGroup.stats.priority[activity.priority]++;
    });

    return groups;
  }, [activities, groupBy]);
};

/**
 * Helper function to generate group titles based on timeframe
 */
const getGroupTitle = (timestamp: Date, groupBy: TimeframeGroup): string => {
  switch (groupBy) {
    case '24h':
      return format(timestamp, 'HH:00');
    case 'today':
      return format(timestamp, 'HH:mm');
    case 'week':
      return format(timestamp, 'EEEE');
    case 'custom':
      return format(timestamp, 'PP');
    default:
      return format(timestamp, 'PP');
  }
};

/**
 * ActivityFeed component with virtualization and real-time updates
 */
const ActivityFeed: React.FC<IActivityFeedProps> = React.memo(({
  maxItems = 100,
  autoUpdate = true,
  onActivityClick,
  filterType,
  athleteIds,
  groupBy = '24h',
  virtualScrollProps,
  className,
  testId
}) => {
  const [activities, setActivities] = useState<IActivity[]>([]);
  const { isConnected, subscribe, lastMessage } = useWebSocket();

  // Configure virtual list defaults
  const virtualListConfig = {
    height: 400,
    width: '100%',
    itemSize: 72,
    overscanCount: 5,
    ...virtualScrollProps
  };

  // Group activities based on timeframe
  const activityGroups = useActivityGroups(activities, groupBy);

  // Filter activities based on props
  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      const typeMatch = !filterType || filterType.includes(activity.type);
      const athleteMatch = !athleteIds || athleteIds.includes(activity.athleteId);
      return typeMatch && athleteMatch;
    });
  }, [activities, filterType, athleteIds]);

  // Handle real-time activity updates
  useEffect(() => {
    if (!isConnected || !autoUpdate) return;

    const handleActivity = (newActivity: IActivity) => {
      setActivities(prev => {
        const updated = [newActivity, ...prev];
        return updated.slice(0, maxItems);
      });
    };

    const unsubscribe = subscribe('activity_feed', handleActivity);
    return () => {
      unsubscribe();
    };
  }, [isConnected, autoUpdate, maxItems, subscribe]);

  // Handle new WebSocket messages
  useEffect(() => {
    if (lastMessage && 'type' in lastMessage) {
      const activity = lastMessage as unknown as IActivity;
      setActivities(prev => {
        const updated = [activity, ...prev];
        return updated.slice(0, maxItems);
      });
    }
  }, [lastMessage, maxItems]);

  // Render individual activity item
  const renderActivity = useCallback((activity: IActivity) => {
    const activityClasses = classNames(
      'activity-item',
      `activity-priority-${activity.priority}`,
      {
        'activity-unread': !activity.readStatus,
        'activity-interactive': !!onActivityClick
      }
    );

    return (
      <Card
        className={activityClasses}
        elevation={activity.priority === 'critical' ? 3 : 1}
        onClick={() => onActivityClick?.(activity)}
        role="listitem"
        ariaLabel={`${activity.title} - ${format(activity.timestamp, 'PPp')}`}
      >
        <div className="activity-content">
          <h3 className="activity-title">{activity.title}</h3>
          <p className="activity-description">{activity.description}</p>
          <time className="activity-time">
            {format(activity.timestamp, 'HH:mm')}
          </time>
        </div>
      </Card>
    );
  }, [onActivityClick]);

  // Render group header
  const renderGroupHeader = useCallback((group: IActivityGroup) => (
    <div className="activity-group-header" role="heading" aria-level={2}>
      <h2>{group.title}</h2>
      <div className="activity-group-stats">
        <span>Total: {group.stats.total}</span>
        {group.stats.priority.critical > 0 && (
          <span className="critical-count">
            Critical: {group.stats.priority.critical}
          </span>
        )}
      </div>
    </div>
  ), []);

  // Virtual list row renderer
  const rowRenderer = useCallback(({ index, style }) => {
    const group = activityGroups[index];
    return (
      <div style={style} className="activity-group">
        {renderGroupHeader(group)}
        {group.activities.map(activity => renderActivity(activity))}
      </div>
    );
  }, [activityGroups, renderGroupHeader, renderActivity]);

  return (
    <div
      className={classNames('activity-feed', className)}
      data-testid={testId}
      role="feed"
      aria-busy={!isConnected}
    >
      <VirtualList
        height={virtualListConfig.height}
        width={virtualListConfig.width}
        itemCount={activityGroups.length}
        itemSize={() => virtualListConfig.itemSize}
        overscanCount={virtualListConfig.overscanCount}
      >
        {rowRenderer}
      </VirtualList>
    </div>
  );
});

ActivityFeed.displayName = 'ActivityFeed';

export default ActivityFeed;