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
import type {
  ClaimResult,
  ModerationQueue,
  ModerationQueueItem,
  QueuedReport,
  QueueFilters,
} from '@/types/moderation';
export {
  filterQueue,
  getAggregatedReport,
  groupReportsByContent,
  sortQueueByPriority,
} from '@/lib/moderation/queue-utils';

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
    console.error('[releaseReport] Error:', error);
    return { success: false, error: message };
  }
}

// Removed: use shared implementation from @/lib/moderation/conflict-of-interest
