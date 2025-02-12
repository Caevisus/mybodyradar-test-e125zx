import { interpolateRgb } from 'd3'; // d3: ^7.8.0

/**
 * Update intervals (in milliseconds) for different chart refresh modes
 * Ensures <100ms latency requirement for real-time updates
 */
export const UPDATE_INTERVALS = {
  REAL_TIME: 100,    // For real-time performance monitoring
  STANDARD: 1000,    // Default refresh rate
  SLOW: 5000,       // For less critical updates
  BACKGROUND: 10000  // For background data synchronization
} as const;

/**
 * Standard chart dimensions and responsive breakpoints
 * Ensures consistent visualization across different screen sizes
 */
export const CHART_DIMENSIONS = {
  DEFAULT_WIDTH: 800,
  DEFAULT_HEIGHT: 400,
  MINIMUM_WIDTH: 320,
  MINIMUM_HEIGHT: 200,
  DEFAULT_MARGIN: {
    top: 20,
    right: 30,
    bottom: 40,
    left: 50
  },
  RESPONSIVE_BREAKPOINTS: {
    mobile: 320,
    tablet: 768,
    desktop: 1024
  }
} as const;

/**
 * Heat map configuration constants
 * Optimized for muscle activity visualization with ±1% accuracy
 */
export const HEAT_MAP_CONSTANTS = {
  MIN_INTENSITY: 0,
  MAX_INTENSITY: 100,
  CELL_SIZE: 20,
  CELL_PADDING: 1,
  COLOR_RANGE: ['#f7fbff', '#2171b5'] as const,
  INTERPOLATION_STEPS: 50,
  HOVER_OPACITY: 0.8,
  TRANSITION_DURATION: 150,
  ACCESSIBILITY_PATTERNS: ['solid', 'stripe', 'dot'] as const
} as const;

/**
 * Performance chart configuration for accurate data representation
 * Includes error margin and smoothing factors for precise visualization
 */
export const PERFORMANCE_CHART_CONSTANTS = {
  LINE_WIDTH: 2,
  POINT_RADIUS: 4,
  SMOOTHING_FACTOR: 0.3,
  Y_AXIS_PRECISION: 1,
  ANIMATION_DURATION: 300,
  ERROR_MARGIN: 0.01,        // Ensures ±1% accuracy requirement
  DATA_POINTS_THRESHOLD: 1000, // Optimization threshold
  TOOLTIP_DELAY: 100
} as const;

/**
 * Supported chart types for visualization components
 */
export enum ChartTypes {
  LINE = 'line',
  BAR = 'bar',
  HEAT_MAP = 'heatMap',
  SCATTER = 'scatter',
  AREA = 'area'
}

/**
 * Available scale types for chart axes
 */
export enum ChartScaleTypes {
  LINEAR = 'linear',
  TIME = 'time',
  LOG = 'log',
  POWER = 'power'
}

/**
 * Chart update modes for different refresh rate requirements
 */
export enum ChartUpdateModes {
  REAL_TIME = 'realTime',   // Uses UPDATE_INTERVALS.REAL_TIME
  STANDARD = 'standard',    // Uses UPDATE_INTERVALS.STANDARD
  MANUAL = 'manual',        // Manual refresh only
  BACKGROUND = 'background' // Uses UPDATE_INTERVALS.BACKGROUND
}

/**
 * Type definitions for chart configuration
 */
export type ChartMargin = typeof CHART_DIMENSIONS.DEFAULT_MARGIN;
export type ColorRange = typeof HEAT_MAP_CONSTANTS.COLOR_RANGE;
export type AccessibilityPattern = typeof HEAT_MAP_CONSTANTS.ACCESSIBILITY_PATTERNS[number];

/**
 * Utility function for color interpolation
 * @param start Starting color in hex format
 * @param end Ending color in hex format
 * @param steps Number of interpolation steps
 * @returns Array of interpolated colors
 */
export const generateColorScale = (
  start: string = HEAT_MAP_CONSTANTS.COLOR_RANGE[0],
  end: string = HEAT_MAP_CONSTANTS.COLOR_RANGE[1],
  steps: number = HEAT_MAP_CONSTANTS.INTERPOLATION_STEPS
): string[] => {
  const interpolator = interpolateRgb(start, end);
  return Array.from({ length: steps }, (_, i) => interpolator(i / (steps - 1)));
};