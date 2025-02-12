/**
 * @fileoverview High-precision React component for real-time session duration tracking
 * Implements performance-optimized timer with sub-millisecond precision and accessibility
 * @version 1.0.0
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ISession } from '../../interfaces/session.interface';
import { useSession } from '../../hooks/useSession';

interface SessionTimerProps {
  /** Optional callback for time updates */
  onTimeUpdate?: (elapsedTime: number) => void;
  /** Optional className for styling */
  className?: string;
  /** Optional precision level in milliseconds */
  precision?: number;
  /** Optional ARIA label for accessibility */
  ariaLabel?: string;
}

/**
 * Formats milliseconds into human-readable time string
 * @param ms - Time in milliseconds
 * @returns Formatted time string (HH:MM:SS.mmm)
 */
const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor((ms % 1000) / 10);

  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds
    .toString()
    .padStart(2, '0')}`;
}

/**
 * High-precision session timer component with performance optimization
 * Implements <100ms latency requirement for real-time monitoring
 */
export const SessionTimer: React.FC<SessionTimerProps> = ({
  onTimeUpdate,
  className = '',
  precision = 10, // Default 10ms precision
  ariaLabel = 'Session duration timer'
}) => {
  // Session state from context
  const { currentSession } = useSession();
  
  // Timer state
  const [displayTime, setDisplayTime] = useState<string>('00:00:00.00');
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  
  // Performance optimization refs
  const animationFrameRef = useRef<number>();
  const startTimeRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);

  /**
   * High-precision timer update using requestAnimationFrame
   */
  const updateTimer = useCallback(() => {
    if (!startTimeRef.current) return;

    const now = performance.now();
    const elapsed = now - startTimeRef.current;
    
    // Update display if precision threshold is met
    if (now - lastUpdateRef.current >= precision) {
      setElapsedTime(elapsed);
      setDisplayTime(formatTime(elapsed));
      onTimeUpdate?.(elapsed);
      lastUpdateRef.current = now;
    }

    animationFrameRef.current = requestAnimationFrame(updateTimer);
  }, [precision, onTimeUpdate]);

  /**
   * Starts the timer with performance optimization
   */
  const startTimer = useCallback(() => {
    startTimeRef.current = performance.now();
    lastUpdateRef.current = startTimeRef.current;
    animationFrameRef.current = requestAnimationFrame(updateTimer);
  }, [updateTimer]);

  /**
   * Stops the timer and cleans up resources
   */
  const stopTimer = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  /**
   * Resets timer state
   */
  const resetTimer = useCallback(() => {
    stopTimer();
    startTimeRef.current = 0;
    lastUpdateRef.current = 0;
    setElapsedTime(0);
    setDisplayTime('00:00:00.00');
  }, [stopTimer]);

  // Handle session state changes
  useEffect(() => {
    if (currentSession?.startTime && !currentSession?.endTime) {
      startTimer();
    } else {
      stopTimer();
    }

    // Cleanup on unmount
    return () => {
      stopTimer();
    };
  }, [currentSession?.startTime, currentSession?.endTime, startTimer, stopTimer]);

  // Calculate initial time if session exists
  useEffect(() => {
    if (currentSession?.startTime) {
      const initialTime = new Date(currentSession.startTime).getTime();
      startTimeRef.current = performance.now() - (Date.now() - initialTime);
    }
  }, [currentSession?.startTime]);

  return (
    <div 
      className={`session-timer ${className}`}
      role="timer"
      aria-label={ariaLabel}
      aria-live="polite"
    >
      <time dateTime={new Date(elapsedTime).toISOString()}>
        {displayTime}
      </time>
    </div>
  );
};

// Export timer component and utility functions
export default SessionTimer;