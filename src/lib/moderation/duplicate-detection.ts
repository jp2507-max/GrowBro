/**
 * Duplicate detection engine for content reports
 *
 * Prevents duplicate reports using composite key:
 * (content_hash, reporter_id, category) + time window
 *
 * Requirements: 1.7
 */

import type { ContentReport, ReportType } from '@/types/moderation';

import { groupByContent } from './utils';

// ============================================================================
// Duplicate Detection Configuration
// ============================================================================

/**
 * Time window for duplicate detection (24 hours)
 */
export const DUPLICATE_DETECTION_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Composite key for duplicate detection
 */
export interface DuplicateDetectionKey {
  content_hash: string;
  reporter_id: string;
  report_type: ReportType;
}

/**
 * Duplicate detection result
 */
export interface DuplicateDetectionResult {
  is_duplicate: boolean;
  existing_report_id?: string;
  existing_report?: ContentReport;
  time_since_last_report_ms?: number;
}

// ============================================================================
// Duplicate Detection Functions
// ============================================================================

/**
 * Generates a composite key for duplicate detection
 *
 * @param contentHash - SHA-256 hash of content
 * @param reporterId - ID of the reporter
 * @param reportType - Type of report
 * @returns Composite key string
 */
export function generateDuplicateKey(
  contentHash: string,
  reporterId: string,
  reportType: ReportType
): string {
  return `${contentHash}:${reporterId}:${reportType}`;
}

/**
 * Checks if a report is a duplicate within the time window
 *
 * @param key - Duplicate detection key
 * @param existingReports - Array of existing reports
 * @param timeWindowMs - Time window in milliseconds (default: 24 hours)
 * @returns Duplicate detection result
 */
export function checkDuplicateReport(
  key: DuplicateDetectionKey,
  existingReports: ContentReport[],
  timeWindowMs: number = DUPLICATE_DETECTION_WINDOW_MS
): DuplicateDetectionResult {
  const now = new Date().getTime();
  const windowStart = now - timeWindowMs;

  // Find matching reports within time window
  const matchingReports = existingReports.filter((report) => {
    const reportTime = new Date(report.created_at).getTime();
    const isWithinWindow = reportTime >= windowStart;
    const matchesKey =
      report.content_hash === key.content_hash &&
      report.reporter_id === key.reporter_id &&
      report.report_type === key.report_type;

    return isWithinWindow && matchesKey;
  });

  if (matchingReports.length === 0) {
    return {
      is_duplicate: false,
    };
  }

  // Return the most recent matching report
  const mostRecent = matchingReports.reduce((prev, current) =>
    new Date(current.created_at).getTime() > new Date(prev.created_at).getTime()
      ? current
      : prev
  );

  const timeSinceLastReport = now - new Date(mostRecent.created_at).getTime();

  return {
    is_duplicate: true,
    existing_report_id: mostRecent.id,
    existing_report: mostRecent,
    time_since_last_report_ms: timeSinceLastReport,
  };
}

/**
 * Formats time since last report in human-readable format
 *
 * @param milliseconds - Time in milliseconds
 * @returns Human-readable time string
 */
export function formatTimeSinceLastReport(milliseconds: number): string {
  const hours = Math.floor(milliseconds / (60 * 60 * 1000));
  const minutes = Math.floor((milliseconds % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return 'just now';
  }
}

/**
 * Determines if duplicate reports should be grouped
 *
 * Multiple users reporting the same content should be grouped
 * into a single moderation queue item
 *
 * @param reports - Array of reports for the same content
 * @returns True if reports should be grouped
 */
export function shouldGroupReports(reports: ContentReport[]): boolean {
  if (reports.length === 0) {
    return false;
  }

  // Group if multiple reports target the same content hash
  const contentHashes = new Set(reports.map((r) => r.content_hash));
  return contentHashes.size === 1 && reports.length > 1;
}

/**
 * Groups reports by content hash
 *
 * @param reports - Array of reports
 * @returns Map of content hash to reports
 */
export function groupReportsByContent(
  reports: ContentReport[]
): Map<string, ContentReport[]> {
  return groupByContent(reports);
}

/**
 * Calculates aggregate priority for grouped reports
 *
 * When multiple users report the same content, priority increases
 *
 * @param reports - Array of grouped reports
 * @returns Aggregate priority (0-100)
 */
export function calculateAggregatePriority(reports: ContentReport[]): number {
  if (reports.length === 0) {
    return 0;
  }

  // Base priority is the highest individual priority
  const maxPriority = Math.max(...reports.map((r) => r.priority));

  // Boost priority by 10 for each additional reporter (max +30)
  const reporterBoost = Math.min((reports.length - 1) * 10, 30);

  // Boost priority if any reporter is a trusted flagger
  const trustedFlaggerBoost = reports.some((r) => r.trusted_flagger) ? 20 : 0;

  // Cap at 100
  return Math.min(maxPriority + reporterBoost + trustedFlaggerBoost, 100);
}
