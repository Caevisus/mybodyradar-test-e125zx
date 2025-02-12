/**
 * @fileoverview Chart Configuration
 * @version 1.0.0
 * 
 * Configures visualization settings and defaults for real-time analytics
 * and performance monitoring displays. Implements specifications for heat maps,
 * biomechanical graphs, and performance metrics with ±1% accuracy requirement.
 */

import { scaleLinear, interpolateRgb } from 'd3'; // ^7.8.0
import { ChartDimensions, ChartOptions, ChartTypes } from '../interfaces/chart.interface';
import { themeConfig } from './theme.config';

/**
 * Default chart dimensions with responsive layout support
 */
export const defaultDimensions: ChartDimensions = {
  width: 800,
  height: 400,
  margin: {
    top: 20,
    right: 30,
    bottom: 40,
    left: 50
  },
  aspectRatio: 16/9,
  responsive: true,
  padding: 10
};

/**
 * Heat map configuration for muscle activity visualization
 */
const heatMapConfig = {
  colorRange: themeConfig.colors.visualization.heatmap,
  cellPadding: 1,
  updateInterval: 100, // Meets <100ms latency requirement
  interpolation: 'basis',
  accessibility: {
    colorBlindSafe: true,
    ariaLabels: true
  },
  performance: {
    throttleInterval: 16, // 60fps rendering
    maxDataPoints: 1000,
    bufferSize: 1024
  }
};

/**
 * Performance metrics chart configuration
 */
const performanceConfig = {
  lineWidth: 2,
  pointRadius: 4,
  smoothing: 0.3,
  updateInterval: 100, // Meets <100ms latency requirement
  precision: {
    accuracy: 0.01, // Ensures ±1% accuracy requirement
    decimalPlaces: 2
  },
  animation: {
    duration: 300,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
  }
};

/**
 * Statistical analysis visualization configuration
 */
const statisticalConfig = {
  confidenceInterval: 0.95,
  outlierThreshold: 2.5,
  kernelDensity: {
    bandwidth: 0.5,
    smoothing: true
  },
  boxplot: {
    showOutliers: true,
    whiskerQuantiles: [0.1, 0.9]
  }
};

/**
 * Scale configurations for different chart types
 */
export const scales = {
  linear: scaleLinear()
    .clamp(true)
    .nice()
    .precision(0.01), // Ensures ±1% accuracy requirement

  heatmap: {
    intensity: scaleLinear()
      .domain([0, 1])
      .range([0, 1])
      .clamp(true),
    color: interpolateRgb(themeConfig.colors.visualization.heatmap[0], 
                         themeConfig.colors.visualization.heatmap[7])
  },

  performance: scaleLinear()
    .domain([0, 100])
    .range([0, 1])
    .clamp(true)
    .nice()
};

/**
 * Default chart options by chart type
 */
export const defaultOptions: Record<ChartTypes, ChartOptions> = {
  [ChartTypes.HEAT_MAP]: {
    type: ChartTypes.HEAT_MAP,
    dimensions: defaultDimensions,
    updateInterval: heatMapConfig.updateInterval,
    precision: performanceConfig.precision.accuracy,
    colorScale: themeConfig.colors.visualization.heatmap,
    animationConfig: {
      duration: performanceConfig.animation.duration,
      easing: performanceConfig.animation.easing
    },
    interactionConfig: {
      zoomEnabled: true,
      panEnabled: true,
      tooltipEnabled: true,
      selectionEnabled: true,
      highlightOnHover: true
    }
  },

  [ChartTypes.LINE_GRAPH]: {
    type: ChartTypes.LINE_GRAPH,
    dimensions: defaultDimensions,
    updateInterval: performanceConfig.updateInterval,
    precision: performanceConfig.precision.accuracy,
    colorScale: themeConfig.colors.visualization.performance,
    animationConfig: {
      duration: performanceConfig.animation.duration,
      easing: performanceConfig.animation.easing
    },
    interactionConfig: {
      zoomEnabled: true,
      panEnabled: true,
      tooltipEnabled: true,
      selectionEnabled: true,
      brushEnabled: true
    }
  },

  [ChartTypes.STATISTICAL_PLOT]: {
    type: ChartTypes.STATISTICAL_PLOT,
    dimensions: defaultDimensions,
    updateInterval: performanceConfig.updateInterval,
    precision: performanceConfig.precision.accuracy,
    colorScale: themeConfig.colors.visualization.intensity,
    animationConfig: {
      duration: performanceConfig.animation.duration,
      easing: performanceConfig.animation.easing
    },
    interactionConfig: {
      zoomEnabled: false,
      panEnabled: false,
      tooltipEnabled: true,
      selectionEnabled: true,
      highlightOnHover: true
    }
  }
};

/**
 * Comprehensive chart configuration object
 */
export const chartConfig = {
  defaultDimensions,
  defaultOptions,
  scales,
  heatMap: heatMapConfig,
  performance: performanceConfig,
  statistical: statisticalConfig,
  updateInterval: 100, // Global update interval meeting <100ms requirement
  precision: 0.01, // Global precision for ±1% accuracy
  accessibility: {
    ariaLabels: true,
    colorBlindSafe: true,
    keyboardNavigation: true
  },
  responsiveBreakpoints: {
    small: 320,
    medium: 768,
    large: 1024,
    xlarge: 1440
  }
};