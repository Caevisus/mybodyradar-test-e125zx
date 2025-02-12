/**
 * @fileoverview Chart interfaces and types for real-time performance visualization
 * Provides comprehensive type definitions for interactive charts, heat maps,
 * and statistical displays with high-precision data handling
 * @version 1.0.0
 */

import { ScaleLinear } from 'd3'; // ^7.8.0
import { BaseEntity } from './common.interface';

/**
 * Supported chart types for performance visualization
 */
export enum ChartTypes {
  HEAT_MAP = 'heatmap',
  LINE_GRAPH = 'line',
  BAR_CHART = 'bar',
  SCATTER_PLOT = 'scatter',
  STATISTICAL_PLOT = 'statistical'
}

/**
 * Chart margin configuration interface
 */
export interface ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Chart dimensions with responsive layout support
 */
export interface ChartDimensions {
  width: number;
  height: number;
  margin: ChartMargin;
  aspectRatio: number;
  padding?: number;
  responsive?: boolean;
}

/**
 * Animation configuration for smooth transitions
 */
export interface AnimationOptions {
  duration: number;
  easing: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
  delay?: number;
  staggerDelay?: number;
}

/**
 * Interactive chart features configuration
 */
export interface InteractionOptions {
  zoomEnabled: boolean;
  panEnabled: boolean;
  tooltipEnabled: boolean;
  selectionEnabled: boolean;
  brushEnabled?: boolean;
  zoomExtent?: [number, number];
  highlightOnHover?: boolean;
}

/**
 * Comprehensive chart configuration options
 */
export interface ChartOptions extends BaseEntity {
  type: ChartTypes;
  dimensions: ChartDimensions;
  updateInterval: number; // Milliseconds
  precision: number; // Decimal places for data values
  colorScale: string[];
  animationConfig: AnimationOptions;
  interactionConfig: InteractionOptions;
  axes?: {
    x: {
      label: string;
      scale: ScaleLinear<number, number>;
      tickFormat?: string;
      gridLines?: boolean;
    };
    y: {
      label: string;
      scale: ScaleLinear<number, number>;
      tickFormat?: string;
      gridLines?: boolean;
    };
  };
  legend?: {
    position: 'top' | 'right' | 'bottom' | 'left';
    orientation: 'horizontal' | 'vertical';
    title?: string;
  };
}

/**
 * Enhanced data point interface with high-precision support
 */
export interface ChartDataPoint extends BaseEntity {
  x: number | Date;
  y: number;
  value: number;
  precision: number; // For ±1% accuracy requirement
  confidence: number; // Confidence level for statistical plots
  metadata?: Record<string, any>;
  anomaly?: boolean;
  timestamp?: Date;
}

/**
 * Heat map cell interface with intensity mapping
 */
export interface HeatMapCell extends BaseEntity {
  row: number;
  col: number;
  value: number;
  precision: number; // For ±1% accuracy requirement
  intensity: number; // Normalized intensity value (0-1)
  metadata?: Record<string, any>;
  anomaly?: boolean;
  timestamp?: Date;
}

/**
 * Statistical visualization options
 */
export interface StatisticalOptions {
  confidenceInterval: number;
  showOutliers: boolean;
  distributionType: 'normal' | 'custom';
  kernelDensity?: boolean;
  bandwidth?: number;
}

/**
 * Real-time data update configuration
 */
export interface UpdateConfig {
  bufferSize: number;
  throttleInterval: number;
  aggregationType: 'mean' | 'median' | 'max' | 'min';
  smoothing?: boolean;
  interpolation?: 'linear' | 'cubic' | 'step';
}

/**
 * Chart event handler types
 */
export type ChartEventHandler = (event: MouseEvent, data?: ChartDataPoint | HeatMapCell) => void;

/**
 * Chart scale configuration
 */
export interface ScaleConfig {
  type: 'linear' | 'log' | 'time';
  domain: [number, number] | [Date, Date];
  range: [number, number];
  clamp?: boolean;
  nice?: boolean;
}

/**
 * Chart theme configuration
 */
export interface ChartTheme {
  backgroundColor: string;
  textColor: string;
  axisColor: string;
  gridColor: string;
  tooltipTheme: 'light' | 'dark';
  fontFamily: string;
  fontSize: number;
}