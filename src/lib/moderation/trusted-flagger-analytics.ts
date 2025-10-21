/**
 * Trusted flagger analytics service
 * Tracks quality metrics and performance for trusted flaggers (DSA Art. 22)
 * Requirements: 11.1-11.7
 */

import type {
  TrustedFlagger,
  TrustedFlaggerAnalytics,
  TrustedFlaggerMetrics,
} from '@/types/moderation';

/**
 * Get analytics for all trusted flaggers
 */
export async function getTrustedFlaggerAnalytics(): Promise<TrustedFlaggerAnalytics> {
  // TODO: Replace with actual Supabase aggregation query
  const response = await fetch('/api/moderation/trusted-flaggers/analytics');

  if (!response.ok) {
    throw new Error(
      `Failed to fetch trusted flagger analytics: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Get metrics for a specific trusted flagger
 */
export async function getTrustedFlaggerMetrics(
  flaggerId: string
): Promise<TrustedFlaggerMetrics> {
  // TODO: Replace with actual Supabase query
  const response = await fetch(
    `/api/moderation/trusted-flaggers/${flaggerId}/metrics`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch trusted flagger metrics: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Get all trusted flaggers with status filter
 */
export async function getTrustedFlaggers(
  status?: 'active' | 'warning' | 'suspended'
): Promise<TrustedFlagger[]> {
  // TODO: Replace with actual Supabase query
  const url = status
    ? `/api/moderation/trusted-flaggers?status=${status}`
    : '/api/moderation/trusted-flaggers';

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch trusted flaggers: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Calculate quality trend based on recent performance
 */
export function calculateQualityTrend(
  recentAccuracy: number[],
  currentAccuracy: number
): 'improving' | 'stable' | 'degrading' {
  if (recentAccuracy.length < 2) return 'stable';

  const avgRecent =
    recentAccuracy.reduce((sum, acc) => sum + acc, 0) / recentAccuracy.length;

  const diff = currentAccuracy - avgRecent;

  if (diff > 0.05) return 'improving'; // More than 5% improvement
  if (diff < -0.05) return 'degrading'; // More than 5% decline

  return 'stable';
}

/**
 * Determine if flagger should receive warning based on metrics
 */
export function shouldWarnFlagger(metrics: TrustedFlaggerMetrics): boolean {
  // Warn if accuracy drops below 70%
  if (metrics.accuracy_rate < 0.7) return true;

  // Warn if false positive rate exceeds 30%
  if (metrics.false_positive_rate > 0.3) return true;

  // Warn if quality is degrading
  if (metrics.quality_trend === 'degrading') return true;

  return false;
}

/**
 * Determine if flagger should be suspended
 */
export function shouldSuspendFlagger(metrics: TrustedFlaggerMetrics): boolean {
  // Suspend if accuracy drops below 50%
  if (metrics.accuracy_rate < 0.5) return true;

  // Suspend if false positive rate exceeds 50%
  if (metrics.false_positive_rate > 0.5) return true;

  // Suspend if already on warning and still degrading
  if (metrics.status === 'warning' && metrics.quality_trend === 'degrading') {
    return true;
  }

  return false;
}

/**
 * Calculate aggregate metrics for all trusted flaggers
 */
export function calculateAggregateMetrics(flaggers: TrustedFlaggerMetrics[]): {
  averageAccuracy: number;
  averageResponseTime: number;
  totalReportsThisMonth: number;
} {
  if (flaggers.length === 0) {
    return {
      averageAccuracy: 0,
      averageResponseTime: 0,
      totalReportsThisMonth: 0,
    };
  }

  const totalAccuracy = flaggers.reduce((sum, f) => sum + f.accuracy_rate, 0);
  const totalResponseTime = flaggers.reduce(
    (sum, f) => sum + f.average_response_time_ms,
    0
  );
  const totalReports = flaggers.reduce(
    (sum, f) => sum + f.report_volume.this_month,
    0
  );

  return {
    averageAccuracy: totalAccuracy / flaggers.length,
    averageResponseTime: totalResponseTime / flaggers.length,
    totalReportsThisMonth: totalReports,
  };
}

/**
 * Get flaggers requiring review (warning or suspension)
 */
export function getFlaggersRequiringReview(
  flaggers: TrustedFlaggerMetrics[]
): TrustedFlaggerMetrics[] {
  return flaggers.filter(
    (f) => shouldWarnFlagger(f) || shouldSuspendFlagger(f)
  );
}

/**
 * Format response time for display
 */
export function formatResponseTime(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

/**
 * Get performance badge color based on accuracy
 */
export function getPerformanceBadgeColor(accuracy: number): string {
  if (accuracy >= 0.9) return 'success'; // Green
  if (accuracy >= 0.7) return 'warning'; // Yellow
  return 'danger'; // Red
}

/**
 * Export flagger metrics for transparency reporting
 */
export async function exportFlaggerMetrics(
  startDate: Date,
  endDate: Date
): Promise<Blob> {
  // TODO: Replace with actual Supabase query and CSV generation
  const response = await fetch(
    `/api/moderation/trusted-flaggers/export?start=${startDate.toISOString()}&end=${endDate.toISOString()}`
  );

  if (!response.ok) {
    throw new Error(`Failed to export flagger metrics: ${response.statusText}`);
  }

  return response.blob();
}
