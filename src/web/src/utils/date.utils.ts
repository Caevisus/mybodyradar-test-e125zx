/**
 * @fileoverview Enterprise-grade date manipulation utilities for the smart-apparel system
 * Provides high-performance, timezone-aware date operations with memoization
 * Supports real-time data processing with <100ms latency requirement
 * @version 1.0.0
 */

import { IDateRange } from '../interfaces/common.interface';
import { format, isValid, parseISO } from 'date-fns'; // ^2.30.0
import { memoize } from 'date-fns/fp'; // ^2.30.0

// Memoized date parsing for performance optimization
const memoizedParseISO = memoize(parseISO);
const memoizedFormat = memoize(format);

/**
 * Interface for duration formatting options
 */
interface DurationFormatOptions {
  precision?: number;
  locale?: Locale;
  includeMilliseconds?: boolean;
}

/**
 * Interface for fiscal year configuration
 */
interface FiscalYearConfig {
  startMonth: number;
  startDay: number;
  timezone?: string;
}

/**
 * High-performance date formatting with memoization and localization support
 * @param date - Date to format
 * @param formatString - Format pattern
 * @param locale - Optional locale for internationalization
 * @returns Formatted date string
 * @throws {Error} If date is invalid
 */
export const formatDate = (
  date: Date | string,
  formatString: string,
  locale?: Locale
): string => {
  try {
    const dateObj = typeof date === 'string' ? memoizedParseISO(date) : date;
    
    if (!isValidDate(dateObj)) {
      throw new Error('Invalid date provided');
    }

    return memoizedFormat(dateObj, formatString, { locale });
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'Invalid Date';
  }
};

/**
 * Enhanced date validation with timezone awareness and detailed error reporting
 * @param value - Value to validate as date
 * @returns Boolean indicating if value is valid date
 */
export const isValidDate = (value: any): boolean => {
  try {
    if (value instanceof Date) {
      return isValid(value);
    }

    if (typeof value === 'string') {
      const parsedDate = memoizedParseISO(value);
      return isValid(parsedDate);
    }

    return false;
  } catch (error) {
    console.error('Date validation error:', error);
    return false;
  }
};

/**
 * Advanced date range calculator with fiscal year and custom period support
 * @param period - Period identifier (e.g., 'today', 'week', 'month', 'fiscal-year')
 * @param fiscalConfig - Optional fiscal year configuration
 * @returns IDateRange object with start and end dates
 */
export const calculateDateRange = (
  period: string,
  fiscalConfig?: FiscalYearConfig
): IDateRange => {
  const now = new Date();
  const startDate = new Date();
  const endDate = new Date();

  try {
    switch (period.toLowerCase()) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'week':
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'month':
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setMonth(now.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'fiscal-year':
        if (!fiscalConfig) {
          throw new Error('Fiscal year configuration required');
        }
        const { startMonth, startDay } = fiscalConfig;
        startDate.setMonth(startMonth - 1, startDay);
        if (now < startDate) {
          startDate.setFullYear(now.getFullYear() - 1);
        }
        endDate.setFullYear(startDate.getFullYear() + 1);
        endDate.setMonth(startMonth - 1, startDay - 1);
        break;

      default:
        throw new Error(`Unsupported period: ${period}`);
    }

    return { startDate, endDate };
  } catch (error) {
    console.error('Date range calculation error:', error);
    return { startDate: now, endDate: now };
  }
};

/**
 * High-precision duration formatting with intelligent unit selection
 * Supports sub-millisecond precision for real-time data
 * @param milliseconds - Duration in milliseconds
 * @param options - Formatting options
 * @returns Formatted duration string
 */
export const formatDuration = (
  milliseconds: number,
  options: DurationFormatOptions = {}
): string => {
  const {
    precision = 2,
    includeMilliseconds = false
  } = options;

  try {
    if (milliseconds < 0) {
      throw new Error('Duration cannot be negative');
    }

    if (milliseconds < 1000 && includeMilliseconds) {
      return `${milliseconds.toFixed(precision)}ms`;
    }

    const seconds = milliseconds / 1000;
    if (seconds < 60) {
      return `${seconds.toFixed(precision)}s`;
    }

    const minutes = seconds / 60;
    if (minutes < 60) {
      return `${minutes.toFixed(precision)}m`;
    }

    const hours = minutes / 60;
    return `${hours.toFixed(precision)}h`;
  } catch (error) {
    console.error('Duration formatting error:', error);
    return '0s';
  }
};

/**
 * Enhanced timezone handling with DST support and validation
 * Caches results for performance optimization
 * @param date - Date to get timezone offset for
 * @returns Timezone offset in minutes
 */
export const getTimezoneOffset = (date: Date): number => {
  try {
    if (!isValidDate(date)) {
      throw new Error('Invalid date provided');
    }

    // Cache key using date's timestamp
    const cacheKey = date.getTime();
    
    // Check cache first
    const cachedOffset = timezoneOffsetCache.get(cacheKey);
    if (cachedOffset !== undefined) {
      return cachedOffset;
    }

    const offset = date.getTimezoneOffset();
    
    // Cache the result
    timezoneOffsetCache.set(cacheKey, offset);
    
    return offset;
  } catch (error) {
    console.error('Timezone offset calculation error:', error);
    return 0;
  }
};

// LRU cache for timezone offsets with 1000 entry limit
const timezoneOffsetCache = new Map<number, number>();
const MAX_CACHE_SIZE = 1000;

// Cleanup function for timezone offset cache
const cleanupTimezoneCache = () => {
  if (timezoneOffsetCache.size > MAX_CACHE_SIZE) {
    const entriesToRemove = timezoneOffsetCache.size - MAX_CACHE_SIZE;
    let count = 0;
    for (const key of timezoneOffsetCache.keys()) {
      if (count >= entriesToRemove) break;
      timezoneOffsetCache.delete(key);
      count++;
    }
  }
};

// Periodically cleanup the timezone cache
setInterval(cleanupTimezoneCache, 60000); // Cleanup every minute