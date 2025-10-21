/**
 * Queue management API service for moderator console
 * Implements queue fetching, claiming, releasing, and priority sorting
 * Requirements: 2.1, 2.2, 2.3
 */

import type {
  ClaimResult,
  ConflictOfInterest,
  ModerationQueue,
  ModerationQueueItem,
  QueuedReport,
  QueueFilters,
  SLAStatus,
} from '@/types/moderation';

/**
 * Transform ModerationQueueItem to QueuedReport for UI consumption
 */
export function transformQueueItem(item: ModerationQueueItem): QueuedReport {
  return {
    ...item.report,
    report_age_ms: Date.now() - new Date(item.report.created_at).getTime(),
    sla_status: calculateSLAStatus(item.report.sla_deadline),
    content_snapshot: item.content_snapshot,
    policy_links: [], // TODO: Fetch from policy catalog
    similar_decisions:
      item.similar_decisions?.map((d) => ({
        id: d.decision_id,
        content_id: '',
        category: '',
        action: d.action,
        reason_code: d.policy_violations.join(', '),
        decided_at: d.created_at,
        moderator_id: '',
        outcome: 'upheld' as const,
        similarity: 0.8,
      })) || [],
  };
}

/**
 * Calculate SLA status based on time remaining until deadline
 */
export function calculateSLAStatus(slaDeadline: Date): SLAStatus {
  const now = new Date();
  const deadline = new Date(slaDeadline);
  const totalTime = deadline.getTime() - now.getTime();

  // Already breached
  if (totalTime <= 0) {
    return 'critical';
  }

  // Calculate original SLA window based on deadline
  // We'll use a heuristic: illegal content = 24h, trusted = 48h, standard = 72h
  // For now, assume a standard window and calculate percentage
  const standardWindow = 72 * 60 * 60 * 1000; // 72 hours in ms
  const elapsed = standardWindow - totalTime;
  const percentUsed = (elapsed / standardWindow) * 100;

  if (percentUsed >= 90) return 'red';
  if (percentUsed >= 75) return 'orange';
  if (percentUsed >= 50) return 'yellow';
  return 'green';
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

  const response = await fetch('/api/moderation/queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ moderator_id: moderatorId, filters }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch queue: ${response.statusText}`);
  }

  return response.json();
}

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

  // TODO: Replace with actual Supabase mutation
  const response = await fetch(`/api/moderation/reports/${reportId}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ moderator_id: moderatorId }),
  });

  if (!response.ok) {
    const error = await response.json();
    return {
      success: false,
      report_id: reportId,
      error: error.message || 'Failed to claim report',
    };
  }

  const data = await response.json();

  return {
    success: true,
    report_id: reportId,
    claimed_by: data.claimed_by,
    claim_expires_at: new Date(data.claim_expires_at),
  };
}

/**
 * Release a claimed report back to the queue
 */
export async function releaseReport(
  reportId: string,
  moderatorId: string
): Promise<{ success: boolean; error?: string }> {
  // TODO: Replace with actual Supabase mutation
  const response = await fetch(`/api/moderation/reports/${reportId}/release`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ moderator_id: moderatorId }),
  });

  if (!response.ok) {
    const error = await response.json();
    return {
      success: false,
      error: error.message || 'Failed to release report',
    };
  }

  return { success: true };
}

/**
 * Check for conflict of interest
 * Prevents moderators from reviewing content they previously decided on
 */
async function checkConflictOfInterest(
  reportId: string,
  moderatorId: string
): Promise<ConflictOfInterest> {
  // TODO: Replace with actual Supabase query
  const response = await fetch(
    `/api/moderation/reports/${reportId}/conflict-check?moderator_id=${moderatorId}`
  );

  if (!response.ok) {
    return {
      has_conflict: false,
      reasons: [],
    };
  }

  return response.json();
}

/**
 * Sort queue reports by priority
 * Order: immediate > illegal > trusted > standard
 * Within each priority: older reports first (FIFO)
 */
export function sortQueueByPriority(reports: QueuedReport[]): QueuedReport[] {
  const priorityOrder: Record<string, number> = {
    immediate: 0,
    illegal: 1,
    trusted: 2,
    standard: 3,
  };

  return [...reports].sort((a, b) => {
    // First sort by priority level
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
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
  const grouped = new Map<string, QueuedReport[]>();

  for (const report of reports) {
    const hash = report.content_hash;
    if (!grouped.has(hash)) {
      grouped.set(hash, []);
    }
    grouped.get(hash)!.push(report);
  }

  return grouped;
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

  return {
    ...primary,
    // Override reporter count with aggregated value
    reporter_id: primary.reporter_id,
    // Store all reporter IDs in metadata if needed
  };
}
