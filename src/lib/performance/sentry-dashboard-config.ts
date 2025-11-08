/**
 * Sentry Performance Dashboard Configuration
 *
 * Defines dashboard IDs and alert thresholds for performance monitoring.
 * Dashboards track key metrics: Startup, Navigation, Scroll, and Sync.
 *
 * Requirements: Spec 21, Task 12 - Performance Trend Analysis
 */

import { Env } from '@env';

import { PERFORMANCE_THRESHOLDS } from './constants';

/**
 * Sentry dashboard configuration for performance monitoring
 * Dashboard IDs should be configured in Sentry UI and set via environment variables
 */
export const SENTRY_DASHBOARD_CONFIG = {
  /**
   * Dashboard IDs for each performance category
   * These should be created in Sentry and configured via environment variables
   */
  dashboards: {
    startup: Env.SENTRY_DASHBOARD_STARTUP || '',
    navigation: Env.SENTRY_DASHBOARD_NAVIGATION || '',
    scroll: Env.SENTRY_DASHBOARD_SCROLL || '',
    sync: Env.SENTRY_DASHBOARD_SYNC || '',
  },

  /**
   * Alert thresholds for performance metrics
   * Alerts trigger when metrics exceed these values
   */
  alertThresholds: {
    // Startup thresholds (in milliseconds)
    'startup.tti.pixel6a': PERFORMANCE_THRESHOLDS.TTI_PIXEL_6A,
    'startup.tti.iphone12': PERFORMANCE_THRESHOLDS.TTI_IPHONE_12,

    // Navigation thresholds (in milliseconds)
    'navigation.p95': PERFORMANCE_THRESHOLDS.NAVIGATION_P95,

    // Scroll thresholds
    'scroll.p95FrameTime': PERFORMANCE_THRESHOLDS.FRAME_TIME_TARGET,
    'scroll.avgFps': PERFORMANCE_THRESHOLDS.MIN_FPS,
    'scroll.droppedFramesPct':
      PERFORMANCE_THRESHOLDS.MAX_DROPPED_FRAMES_PERCENT,

    // Sync thresholds (in milliseconds)
    'sync.p95': PERFORMANCE_THRESHOLDS.SYNC_500_ITEMS_P95,

    // Gesture thresholds (in milliseconds)
    'gesture.inputToRenderP95': PERFORMANCE_THRESHOLDS.INPUT_TO_RENDER_P95,
  },

  /**
   * Trend analysis configuration
   */
  trendAnalysis: {
    // Number of days for moving average calculation
    windowDays: 7,

    // Percentage threshold for triggering investigation (10%)
    deltaThreshold: 0.1,

    // Metrics to track for trend analysis
    metrics: ['startup', 'navigation', 'scroll', 'sync'] as const,
  },
} as const;

/**
 * Performance metric categories for dashboard organization
 */
export type PerformanceMetricCategory =
  (typeof SENTRY_DASHBOARD_CONFIG.trendAnalysis.metrics)[number];

/**
 * Dashboard configuration for a specific metric category
 */
export interface DashboardConfig {
  id: string;
  name: string;
  category: PerformanceMetricCategory;
  url: string;
}

/**
 * Get dashboard URL for a specific category
 */
export function getDashboardUrl(
  category: PerformanceMetricCategory
): string | null {
  const dashboardId = SENTRY_DASHBOARD_CONFIG.dashboards[category];

  if (!dashboardId || !Env.SENTRY_ORG || !Env.SENTRY_PROJECT) {
    return null;
  }

  return `https://sentry.io/organizations/${Env.SENTRY_ORG}/dashboards/${dashboardId}/?project=${Env.SENTRY_PROJECT}`;
}

/**
 * Get all configured dashboard URLs
 */
export function getAllDashboardUrls(): Record<
  PerformanceMetricCategory,
  string | null
> {
  return {
    startup: getDashboardUrl('startup'),
    navigation: getDashboardUrl('navigation'),
    scroll: getDashboardUrl('scroll'),
    sync: getDashboardUrl('sync'),
  };
}

/**
 * Check if Sentry dashboards are configured
 */
export function areDashboardsConfigured(): boolean {
  return (
    !!Env.SENTRY_ORG &&
    !!Env.SENTRY_PROJECT &&
    Object.values(SENTRY_DASHBOARD_CONFIG.dashboards).some((id) => !!id)
  );
}
