/**
 * React Query hooks for trusted flagger analytics
 * Requirements: 11.1-11.7
 */

import { createQuery } from 'react-query-kit';

import {
  getTrustedFlaggerAnalytics,
  getTrustedFlaggerMetrics,
  getTrustedFlaggers,
} from '@/lib/moderation/trusted-flagger-analytics';

/**
 * Get all trusted flagger analytics
 */
export const useTrustedFlaggerAnalytics = createQuery({
  queryKey: ['moderation', 'trusted-flaggers', 'analytics'],
  fetcher: () => getTrustedFlaggerAnalytics(),
  refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  staleTime: 2 * 60 * 1000, // 2 minutes
});

/**
 * Get metrics for specific trusted flagger
 */
export const useTrustedFlaggerMetrics = createQuery<
  ReturnType<typeof getTrustedFlaggerMetrics>,
  { flaggerId: string },
  Error
>({
  queryKey: ['moderation', 'trusted-flaggers', 'metrics', 'flaggerId'],
  fetcher: (variables: { flaggerId: string }) =>
    getTrustedFlaggerMetrics(variables.flaggerId),
  staleTime: 60 * 1000, // 1 minute
});

/**
 * Get all trusted flaggers with optional status filter
 */
export const useTrustedFlaggers = createQuery<
  ReturnType<typeof getTrustedFlaggers>,
  { status?: 'active' | 'warning' | 'suspended' },
  Error
>({
  queryKey: ['moderation', 'trusted-flaggers', 'status'],
  fetcher: (variables: { status?: 'active' | 'warning' | 'suspended' }) =>
    getTrustedFlaggers(variables?.status),
  staleTime: 5 * 60 * 1000, // 5 minutes
});

/**
 * Hook to get summary stats for trusted flaggers
 */
export function useTrustedFlaggerSummary() {
  const { data: analytics, isLoading } = useTrustedFlaggerAnalytics({
    variables: undefined,
  });

  if (isLoading || !analytics) {
    return {
      totalFlaggers: 0,
      activeFlaggers: 0,
      averageAccuracy: 0,
      totalReports: 0,
      isLoading,
    };
  }

  return {
    totalFlaggers: analytics.total_flaggers,
    activeFlaggers: analytics.active_flaggers,
    averageAccuracy: analytics.aggregate_metrics.average_accuracy,
    totalReports: analytics.aggregate_metrics.total_reports_this_month,
    isLoading,
  };
}
