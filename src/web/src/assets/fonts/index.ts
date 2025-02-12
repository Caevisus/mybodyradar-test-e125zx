/**
 * @fileoverview Font asset management for smart apparel web application
 * @version 1.0.0
 * 
 * Implements Material Design 3.0 typography system with WCAG 2.1 Level AA compliance
 * Provides font configurations for optimal readability and accessibility
 */

// @fontsource/roboto v5.0.0 - Primary system font
import '@fontsource/roboto/300.css'; // Light
import '@fontsource/roboto/400.css'; // Regular
import '@fontsource/roboto/500.css'; // Medium
import '@fontsource/roboto/700.css'; // Bold

/**
 * Font family configurations with fallback chains
 * Primary: Roboto for Material Design compliance
 * Secondary: System fonts for fallback
 */
export const fontFamilies = {
  primary: '"Roboto", "Helvetica", "Arial", sans-serif',
  secondary: '"Helvetica", "Arial", sans-serif',
} as const;

/**
 * Semantic font weights aligned with Material Design standards
 * Ensures consistent typography across platforms
 */
export const fontWeights = {
  light: 300,    // Light weight for large headings
  regular: 400,  // Regular weight for body text
  medium: 500,   // Medium weight for emphasis
  bold: 700,     // Bold weight for strong emphasis
} as const;

/**
 * Responsive font size scale using rem units
 * Ensures minimum size of 12px (0.75rem) for WCAG compliance
 * Maintains readable text at all viewport sizes
 */
export const fontSizes = {
  xs: '0.75rem',   // 12px - Minimum size for WCAG compliance
  sm: '0.875rem',  // 14px - Small text, secondary information
  md: '1rem',      // 16px - Base body text size
  lg: '1.125rem',  // 18px - Large text, important content
  xl: '1.25rem',   // 20px - Headings
  xxl: '1.5rem',   // 24px - Major headings
} as const;

/**
 * Line height ratios optimized for readability
 * Based on Material Design specifications and WCAG guidelines
 * Ensures sufficient spacing between lines of text
 */
export const lineHeights = {
  xs: 1.2,  // Compact - for short text elements
  sm: 1.4,  // Moderate - for general text
  md: 1.6,  // Standard - for body text
  lg: 1.8,  // Relaxed - for improved readability
} as const;

// Type exports for TypeScript support
export type FontFamily = keyof typeof fontFamilies;
export type FontWeight = keyof typeof fontWeights;
export type FontSize = keyof typeof fontSizes;
export type LineHeight = keyof typeof lineHeights;