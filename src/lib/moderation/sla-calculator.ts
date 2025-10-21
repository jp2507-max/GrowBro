/**
 * SLA (Service Level Agreement) calculation and monitoring utilities
 * Implements SLA deadline calculation, status determination, and visual indicators
 * Requirements: 2.3, 5.1, 5.2
 */

import type {
  ModerationPriority,
  ReportType,
  SLAStatus,
} from '@/types/moderation';

/**
 * SLA target windows in milliseconds by priority
 * Based on DSA "act expeditiously" requirement with internal targets
 */
export const SLA_WINDOWS_MS: Record<ModerationPriority, number> = {
  immediate: 0, // CSAM/self-harm: immediate action required
  illegal: 24 * 60 * 60 * 1000, // 24 hours for illegal content
  trusted: 48 * 60 * 60 * 1000, // 48 hours for trusted flaggers
  standard: 72 * 60 * 60 * 1000, // 72 hours for standard reports
};

/**
 * Calculate SLA deadline based on report type and priority
 */
export function calculateSLADeadline(
  reportCreatedAt: Date,
  priority: ModerationPriority
): Date {
  const window = SLA_WINDOWS_MS[priority];
  return new Date(reportCreatedAt.getTime() + window);
}

/**
 * Calculate SLA status based on time remaining until deadline
 * Visual indicator mapping:
 * - green: <50% of time used
 * - yellow: 50-75% of time used
 * - orange: 75-90% of time used
 * - red: >90% of time used
 * - critical: deadline breached (>100%)
 */
export function calculateSLAStatus(
  reportCreatedAt: Date,
  slaDeadline: Date,
  _priority: ModerationPriority
): SLAStatus {
  const now = new Date();
  const created = reportCreatedAt.getTime();
  const deadline = slaDeadline.getTime();
  const current = now.getTime();

  // Calculate time windows
  const totalWindow = deadline - created;
  const timeElapsed = current - created;
  const timeRemaining = deadline - current;

  // Already breached
  if (timeRemaining <= 0) {
    return 'critical';
  }

  // Guard against zero-length SLA windows
  if (totalWindow <= 0) {
    return 'red';
  }

  // Calculate percentage of time used
  const percentUsed = (timeElapsed / totalWindow) * 100;

  if (percentUsed >= 90) return 'red';
  if (percentUsed >= 75) return 'orange';
  if (percentUsed >= 50) return 'yellow';
  return 'green';
}

/**
 * Get time remaining until SLA deadline in milliseconds
 */
export function getTimeRemainingMs(slaDeadline: Date): number {
  const now = new Date();
  return Math.max(0, slaDeadline.getTime() - now.getTime());
}

/**
 * Format time remaining as human-readable string
 */
export function formatTimeRemaining(ms: number): string {
  if (ms === 0) return 'Overdue';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

/**
 * Determine priority based on report type and flags
 */
export function determinePriority(
  reportType: ReportType,
  isTrustedFlagger: boolean,
  category?: string
): ModerationPriority {
  // CSAM or self-harm always gets immediate priority
  if (
    category?.toLowerCase().includes('csam') ||
    category?.toLowerCase().includes('self_harm') ||
    category?.toLowerCase().includes('self-harm')
  ) {
    return 'immediate';
  }

  // Illegal content gets high priority
  if (reportType === 'illegal') {
    return 'illegal';
  }

  // Trusted flaggers get elevated priority
  if (isTrustedFlagger) {
    return 'trusted';
  }

  // Default to standard priority
  return 'standard';
}

/**
 * Check if SLA alert should be triggered
 * Alerts at 75% and 90% thresholds
 */
export function shouldTriggerSLAAlert(
  reportCreatedAt: Date,
  slaDeadline: Date,
  lastAlertLevel?: 75 | 90
): { shouldAlert: boolean; alertLevel: 75 | 90 | null } {
  const now = new Date();
  const created = reportCreatedAt.getTime();
  const deadline = slaDeadline.getTime();
  const current = now.getTime();

  const totalWindow = deadline - created;
  const timeElapsed = current - created;

  // Guard against zero-length SLA windows
  if (totalWindow <= 0) {
    // Immediate expiry: alert at 90 unless already alerted at 90 or higher
    if (!lastAlertLevel || lastAlertLevel < 90) {
      return { shouldAlert: true, alertLevel: 90 };
    } else {
      return { shouldAlert: false, alertLevel: null };
    }
  }

  const percentUsed = (timeElapsed / totalWindow) * 100;

  // Check 90% threshold
  if (percentUsed >= 90 && (!lastAlertLevel || lastAlertLevel < 90)) {
    return { shouldAlert: true, alertLevel: 90 };
  }

  // Check 75% threshold
  if (percentUsed >= 75 && (!lastAlertLevel || lastAlertLevel < 75)) {
    return { shouldAlert: true, alertLevel: 75 };
  }

  return { shouldAlert: false, alertLevel: null };
}

/**
 * Calculate average response time from a set of reports
 */
export function calculateAverageResponseTime(
  reports: { created_at: Date; resolved_at?: Date }[]
): number {
  const resolvedReports = reports.filter((r) => r.resolved_at);

  if (resolvedReports.length === 0) return 0;

  const totalResponseTime = resolvedReports.reduce((sum, report) => {
    const responseTime =
      report.resolved_at!.getTime() - report.created_at.getTime();
    return sum + responseTime;
  }, 0);

  return totalResponseTime / resolvedReports.length;
}

/**
 * Get SLA compliance percentage
 */
export function getSLACompliance(
  totalReports: number,
  withinSLA: number
): number {
  if (totalReports === 0) return 100;
  return (withinSLA / totalReports) * 100;
}
