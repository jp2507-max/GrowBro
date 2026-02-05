import { groupByContent } from '@/lib/moderation/utils';
import type { QueuedReport, QueueFilters } from '@/types/moderation';

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
export function getAggregatedReport(
  reports: QueuedReport[]
): QueuedReport | null {
  if (reports.length === 0) {
    return null;
  }

  // Use the earliest report as primary
  const primary = reports.reduce((earliest, current) =>
    current.created_at < earliest.created_at ? current : earliest
  );

  // TODO: Aggregate reporter count and store in metadata
  // TODO: Store all reporter IDs in metadata if needed for aggregation
  // Note: Current data model needs to support aggregation fields to implement this fully.
  // Pending follow-up task to update QueuedReport interface.

  return {
    ...primary,
  };
}
