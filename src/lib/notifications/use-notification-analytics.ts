/**
 * React Hooks for Notification Analytics
 *
 * Provides hooks for accessing notification delivery stats, performance metrics,
 * and delivery rate alerts. Used by analytics dashboards and monitoring UIs.
 */

import { useQuery } from '@tanstack/react-query';

import { notificationAnalytics } from './notification-analytics';
import { getNotificationMetrics } from './notification-monitor';

/**
 * Hook to fetch notification analytics dashboard stats
 *
 * Returns aggregated delivery rate, engagement rate, opt-in rate,
 * recent failures count, and active alerts.
 */
export function useNotificationAnalytics() {
  return useQuery({
    queryKey: ['notification-analytics', 'dashboard'],
    queryFn: () => notificationAnalytics.getDashboardStats(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });
}

/**
 * Hook to fetch delivery rate alerts
 *
 * Returns notification types that have delivery rates below the threshold (default 95%).
 */
export function useDeliveryRateAlerts(threshold = 95.0) {
  return useQuery({
    queryKey: ['notification-analytics', 'alerts', threshold],
    queryFn: () => notificationAnalytics.checkDeliveryRateAlerts(threshold),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

/**
 * Hook to fetch notification delivery stats for a date range
 *
 * Returns daily delivery and engagement statistics by notification type and platform.
 */
export function useDeliveryStats(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['notification-analytics', 'delivery-stats', startDate, endDate],
    queryFn: () => notificationAnalytics.getDeliveryStats(startDate, endDate),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: true,
  });
}

/**
 * Hook to fetch opt-in rates by notification type
 *
 * Returns current opt-in/opt-out rates across all users with preferences set.
 */
export function useOptInRates() {
  return useQuery({
    queryKey: ['notification-analytics', 'opt-in-rates'],
    queryFn: () => notificationAnalytics.getOptInRates(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch recent delivery failures (last 24 hours)
 *
 * Returns list of recent notification delivery failures for debugging.
 */
export function useDeliveryFailures() {
  return useQuery({
    queryKey: ['notification-analytics', 'delivery-failures'],
    queryFn: () => notificationAnalytics.getDeliveryFailures(),
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
  });
}

/**
 * Hook to fetch engagement tracking events
 *
 * Returns recent notification open events with time-to-open metrics.
 */
export function useEngagementEvents(limit = 100) {
  return useQuery({
    queryKey: ['notification-analytics', 'engagement', limit],
    queryFn: () => notificationAnalytics.getEngagementEvents(limit),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to access client-side notification performance metrics
 *
 * Returns latency metrics (p50/p95), delivery rate, and alert status.
 * This data is calculated from in-memory latency records on the client.
 */
export function useNotificationMetrics() {
  return useQuery({
    queryKey: ['notification-monitor', 'metrics'],
    queryFn: () => getNotificationMetrics(),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}
