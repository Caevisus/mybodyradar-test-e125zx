/**
 * Route Constants
 * Version: 1.0.0
 * 
 * Defines all application routes and path configurations for the smart apparel web application.
 * Ensures consistent navigation and route management across different user roles and features.
 */

// Base route configuration
export const BASE_ROUTE = '/';
export const API_VERSION = 'v1';

// Authentication routes
export const AUTH = {
    ROOT: '/auth',
    LOGIN: '/auth/login',
    SIGNUP: '/auth/signup',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password/:token',
    VERIFY_EMAIL: '/auth/verify-email/:token',
    MFA: '/auth/mfa'
} as const;

// Main dashboard routes
export const DASHBOARD = {
    ROOT: '/dashboard',
    OVERVIEW: '/dashboard/overview',
    REAL_TIME: '/dashboard/real-time',
    PERFORMANCE: '/dashboard/performance',
    ACTIVITY: '/dashboard/activity',
    SUMMARY: '/dashboard/summary'
} as const;

// Analytics and data visualization routes
export const ANALYTICS = {
    ROOT: '/analytics',
    HEATMAP: '/analytics/heatmap/:sessionId?',
    BIOMECHANICS: '/analytics/biomechanics',
    PERFORMANCE: '/analytics/performance',
    TRENDS: '/analytics/trends',
    REPORTS: '/analytics/reports',
    EXPORT: '/analytics/export'
} as const;

// Alert system routes
export const ALERTS = {
    ROOT: '/alerts',
    DETAILS: '/alerts/:alertId',
    SETTINGS: '/alerts/settings',
    HISTORY: '/alerts/history',
    CONFIGURE: '/alerts/configure'
} as const;

// Team management routes
export const TEAM = {
    ROOT: '/team',
    ROSTER: '/team/roster',
    ATHLETE: '/team/athlete/:athleteId',
    COMPARISON: '/team/comparison',
    STATISTICS: '/team/statistics',
    MANAGEMENT: '/team/management'
} as const;

// Medical staff routes
export const MEDICAL = {
    ROOT: '/medical',
    INJURY_RISK: '/medical/injury-risk',
    TREATMENT: '/medical/treatment/:athleteId?',
    HISTORY: '/medical/history/:athleteId?',
    ASSESSMENT: '/medical/assessment',
    REPORTS: '/medical/reports'
} as const;

// User settings routes
export const SETTINGS = {
    ROOT: '/settings',
    PROFILE: '/settings/profile',
    NOTIFICATIONS: '/settings/notifications',
    SECURITY: '/settings/security',
    INTEGRATIONS: '/settings/integrations',
    DEVICES: '/settings/devices',
    PREFERENCES: '/settings/preferences'
} as const;

// Error page routes
export const ERROR = {
    NOT_FOUND: '/404',
    UNAUTHORIZED: '/401',
    FORBIDDEN: '/403',
    SERVER_ERROR: '/500'
} as const;

// Export all routes as a single object for convenience
export const ROUTES = {
    AUTH,
    DASHBOARD,
    ANALYTICS,
    ALERTS,
    TEAM,
    MEDICAL,
    SETTINGS,
    ERROR
} as const;

// Type for all available routes
export type AppRoutes = typeof ROUTES;

// Type for specific route sections
export type AuthRoutes = typeof AUTH;
export type DashboardRoutes = typeof DASHBOARD;
export type AnalyticsRoutes = typeof ANALYTICS;
export type AlertRoutes = typeof ALERTS;
export type TeamRoutes = typeof TEAM;
export type MedicalRoutes = typeof MEDICAL;
export type SettingsRoutes = typeof SETTINGS;
export type ErrorRoutes = typeof ERROR;