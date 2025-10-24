/**
 * React Query hooks for moderation queue management
 * Implements data fetching and mutations for moderator console
 * Requirements: 2.1, 2.2, 2.3
 */

import { createMutation, createQuery } from 'react-query-kit';

import type { QueueFilters } from '@/types/moderation';

import { claimReport, getModeratorQueue, releaseReport } from './queue-service';

/**
 * Fetch moderation queue with optional filters
 */
export const useModeratorQueue = createQuery({
  queryKey: ['moderation', 'queue'],
  fetcher: (variables: { moderator_id: string; filters?: QueueFilters }) => {
    return getModeratorQueue(variables.moderator_id, variables.filters);
  },
  refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  staleTime: 10000, // Consider data stale after 10 seconds
});

/**
 * Claim a report for exclusive review (4-hour lock)
 */
export const useClaimReport = createMutation({
  mutationFn: async (variables: { report_id: string; moderator_id: string }) =>
    claimReport(variables.report_id, variables.moderator_id),
});

/**
 * Release a claimed report back to the queue
 */
export const useReleaseReport = createMutation({
  mutationFn: async (variables: { report_id: string; moderator_id: string }) =>
    releaseReport(variables.report_id, variables.moderator_id),
});

/**
 * Hook to get queue metrics and SLA status
 */
export function useQueueMetrics(moderatorId: string) {
  const { data: queue, isLoading } = useModeratorQueue({
    variables: { moderator_id: moderatorId },
  });

  if (isLoading || !queue) {
    return {
      totalReports: 0,
      pendingCount: 0,
      overdueCount: 0,
      averageAgeHours: 0,
      isLoading,
    };
  }

  return {
    totalReports: queue.total_count || 0,
    pendingCount: queue.pending_count || 0,
    overdueCount: queue.overdue_count || 0,
    averageAgeHours: queue.average_age_hours || 0,
    isLoading,
  };
}
