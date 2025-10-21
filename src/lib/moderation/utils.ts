import type { ContentReport } from '@/types/moderation';

/**
 * Groups reports by content hash
 *
 * @param reports - Array of reports
 * @returns Map of content hash to reports
 */
export function groupByContent<T extends ContentReport>(
  reports: T[]
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const report of reports) {
    const existing = grouped.get(report.content_hash) || [];
    existing.push(report);
    grouped.set(report.content_hash, existing);
  }

  return grouped;
}
