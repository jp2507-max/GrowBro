/**
 * Queue management API service for moderator console
 * Implements queue fetching, claiming, releasing, and priority sorting
 * Requirements: 2.1, 2.2, 2.3
 */

import { client } from '@/api/common';
import { checkConflictOfInterest } from '@/lib/moderation/conflict-of-interest';
import {
  calculateSLAStatus,
  determinePriority,
} from '@/lib/moderation/sla-calculator';
import { groupByContent } from '@/lib/moderation/utils';
import type {
  ClaimResult,
  ModerationQueue,
  ModerationQueueItem,
  QueuedReport,
  QueueFilters,
} from '@/types/moderation';

/**
 * Extract error message from API response or fallback
 */
function extractErrorMessage(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    (error as { response?: { data?: unknown } }).response?.data
  ) {
    const data = (error as { response: { data: unknown } }).response.data;
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object') {
      const message =
        (data as { message?: unknown }).message ??
        (data as { error?: { message?: unknown } }).error?.message;
      if (message) return String(message);
    }
  }
  return error instanceof Error ? error.message : fallback;
}

/**
 * Transform ModerationQueueItem to QueuedReport for UI consumption
 */
export function transformQueueItem(item: ModerationQueueItem): QueuedReport {
  const priority = determinePriority(
    item.report.report_type,
    item.report.trusted_flagger
  );
  return {
    ...item.report,
    report_age_ms: Date.now() - new Date(item.report.created_at).getTime(),
    sla_status: calculateSLAStatus(
      item.report.created_at,
      item.report.sla_deadline,
      priority
    ),
    content_snapshot: item.content_snapshot,
    policy_links: [], // TODO: Fetch from policy catalog
    similar_decisions: [],
  };
}

/**
 * Get moderation queue with filters and sorting
 */
export async function getModeratorQueue(
  moderatorId: string,
  filters?: QueueFilters
): Promise<ModerationQueue> {
  // TODO: Replace with actual Supabase query
  // This is a stub implementation for now

  try {
    const response = await client.post<ModerationQueue>('/moderation/queue', {
      moderator_id: moderatorId,
      filters,
    });
    return response.data;
  } catch (error) {
    const message = extractErrorMessage(
      error,
      'Failed to fetch moderation queue'
    );
    console.error('[getModeratorQueue] Error:', error);
    throw new Error(message);
  }
}

// TODO: Implement actual Supabase mutation instead of stub endpoint
// TODO: Normalize Date fields (created_at, sla_deadline) to Date objects for type safety
/**
 * Claim a report for review (exclusive 4-hour lock)
 */
export async function claimReport(
  reportId: string,
  moderatorId: string
): Promise<ClaimResult> {
  // Check for conflict of interest first
  const coi = await checkConflictOfInterest(reportId, moderatorId);

  if (coi.has_conflict) {
    return {
      success: false,
      report_id: reportId,
      error: 'Conflict of interest detected',
      conflict_of_interest: coi,
    };
  }

  try {
    const response = await client.post<{
      claimed_by: string;
      claim_expires_at: string;
    }>(`/moderation/reports/${reportId}/claim`, {
      moderator_id: moderatorId,
    });

    return {
      success: true,
      report_id: reportId,
      claimed_by: response.data.claimed_by,
      claim_expires_at: new Date(response.data.claim_expires_at),
    };
  } catch (error) {
    const message = extractErrorMessage(error, 'Failed to claim report');
    console.error('[claimReport] Error:', error);

    return {
      success: false,
      report_id: reportId,
      error: message,
    };
  }
}

/**
 * Release a claimed report back to the queue
 */
export async function releaseReport(
  reportId: string,
  moderatorId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await client.post(`/moderation/reports/${reportId}/release`, {
      moderator_id: moderatorId,
    });
    return { success: true };
  } catch (error) {
    const message = extractErrorMessage(error, 'Failed to release report');
    return { success: false, error: message };
  }
}

// Removed: use shared implementation from @/lib/moderation/conflict-of-interest

/**
 * Sort queue reports by priority
 * Order: higher numeric priority first (100 > 75 > 50 > 25 > 10)
 * Within each priority: older reports first (FIFO)
 */
export function sortQueueByPriority(reports: QueuedReport[]): QueuedReport[] {
  return [...reports].sort((a, b) => {
    // First sort by priority level (higher numeric values = higher priority)
    const priorityDiff = b.priority - a.priority;
    if (priorityDiff !== 0) return priorityDiff;

    // Then by age (older first)
    return b.report_age_ms - a.report_age_ms;
  });
}

/**
 * Filter queue reports based on criteria
 */
export function filterQueue(
  reports: QueuedReport[],
  filters: QueueFilters
): QueuedReport[] {
  let filtered = [...reports];

  if (filters.status?.length) {
    filtered = filtered.filter((r) => filters.status!.includes(r.status));
  }

  if (filters.priority_min !== undefined) {
    filtered = filtered.filter((r) => r.priority >= filters.priority_min!);
  }

  if (filters.report_type?.length) {
    filtered = filtered.filter((r) =>
      filters.report_type!.includes(r.report_type)
    );
  }

  if (filters.trusted_flagger !== undefined) {
    filtered = filtered.filter(
      (r) => r.trusted_flagger === filters.trusted_flagger
    );
  }

  if (filters.overdue_only) {
    filtered = filtered.filter((r) =>
      ['red', 'critical'].includes(r.sla_status)
    );
  }

  return filtered;
}

/**
 * Group reports by content hash (aggregate duplicate reports)
 */
export function groupReportsByContent(
  reports: QueuedReport[]
): Map<string, QueuedReport[]> {
  return groupByContent(reports);
}

/**
 * Get aggregated report (primary report + reporter count)
 */
export function getAggregatedReport(reports: QueuedReport[]): QueuedReport {
  // Use the earliest report as primary
  const primary = reports.reduce((earliest, current) =>
    current.created_at < earliest.created_at ? current : earliest
  );

  // TODO: Aggregate reporter count and store in metadata
  // TODO: Store all reporter IDs in metadata if needed for aggregation

  return {
    ...primary,
  };
}
