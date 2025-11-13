/**
 * Trusted flagger analytics service
 * Tracks quality metrics and performance for trusted flaggers (DSA Art. 22)
 * Requirements: 11.1-11.7
 */

import { supabase } from '@/lib/supabase';
import type {
  TrustedFlagger,
  TrustedFlaggerAnalytics,
  TrustedFlaggerMetrics,
} from '@/types/moderation';

type ReportWithDecision = {
  id: string;
  created_at: string;
  moderation_decisions: { created_at: string }[];
};

type RawFlaggerData = {
  certification_date: string;
  review_date: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
};

/**
 * Calculate accuracy rate for a trusted flagger
 * Based on decisions upheld vs total decisions
 */
export async function calculateAccuracyRate(
  flaggerId: string,
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  // Get all reports from this flagger in the date range
  let reportsQuery = supabase
    .from('content_reports')
    .select('id, status')
    .eq('reporter_id', flaggerId)
    .eq('trusted_flagger', true);

  if (startDate) {
    reportsQuery = reportsQuery.gte('created_at', startDate.toISOString());
  }

  if (endDate) {
    reportsQuery = reportsQuery.lte('created_at', endDate.toISOString());
  }

  const { data: reports, error: reportsError } = await reportsQuery;

  if (reportsError) {
    throw new Error(`Failed to fetch flagger reports: ${reportsError.message}`);
  }

  if (!reports || reports.length === 0) {
    return 0;
  }

  // Get moderation decisions for these reports
  const reportIds = reports.map((r) => r.id);

  const { data: decisions, error: decisionsError } = await supabase
    .from('moderation_decisions')
    .select('report_id, action')
    .in('report_id', reportIds);

  if (decisionsError) {
    throw new Error(`Failed to fetch decisions: ${decisionsError.message}`);
  }

  // Count reports that resulted in action (upheld)
  const upheldCount =
    decisions?.filter((d) => d.action !== 'no_action').length || 0;

  return upheldCount / reports.length;
}

/**
 * Calculate average handling time for a flagger's reports
 */
export async function calculateAverageHandlingTime(
  flaggerId: string,
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  // Get reports with their decision timestamps
  let query = supabase
    .from('content_reports')
    .select(
      `
      id,
      created_at,
      moderation_decisions!inner(created_at)
    `
    )
    .eq('reporter_id', flaggerId)
    .eq('trusted_flagger', true);

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString());
  }

  if (endDate) {
    query = query.lte('created_at', endDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to calculate handling time: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return 0;
  }

  // Calculate time differences in hours
  const totalHours = data.reduce((sum: number, report: ReportWithDecision) => {
    const reportTime = new Date(report.created_at).getTime();
    const decisionTime = new Date(
      report.moderation_decisions[0].created_at
    ).getTime();
    const hoursToDecision = (decisionTime - reportTime) / (1000 * 60 * 60);
    return sum + hoursToDecision;
  }, 0);

  return totalHours / data.length;
}

/**
 * Calculate detailed metrics for a single flagger
 */
async function calculateFlaggerMetrics(
  flagger: TrustedFlagger,
  monthStart: Date,
  weekStart: Date
): Promise<TrustedFlaggerMetrics> {
  const accuracyRate = await calculateAccuracyRate(flagger.id);
  const handlingTimeHours = await calculateAverageHandlingTime(flagger.id);

  // Get report counts for different time periods
  const { count: totalReports } = await supabase
    .from('content_reports')
    .select('*', { count: 'exact', head: true })
    .eq('reporter_id', flagger.id)
    .eq('trusted_flagger', true);

  const { count: thisWeekReports } = await supabase
    .from('content_reports')
    .select('*', { count: 'exact', head: true })
    .eq('reporter_id', flagger.id)
    .eq('trusted_flagger', true)
    .gte('created_at', weekStart.toISOString());

  const { count: thisMonthReports } = await supabase
    .from('content_reports')
    .select('*', { count: 'exact', head: true })
    .eq('reporter_id', flagger.id)
    .eq('trusted_flagger', true)
    .gte('created_at', monthStart.toISOString());

  // Calculate false positive rate
  const { data: decisions } = await supabase
    .from('moderation_decisions')
    .select('action')
    .eq('reporter_id', flagger.id);

  const falsePositiveRate = decisions
    ? decisions.filter((d) => d.action === 'no_action').length /
      decisions.length
    : 0;

  return {
    flagger_id: flagger.id,
    flagger_name: flagger.organization_name,
    accuracy_rate: accuracyRate,
    false_positive_rate: falsePositiveRate,
    average_response_time_ms: handlingTimeHours * 60 * 60 * 1000,
    report_volume: {
      total: totalReports || 0,
      this_week: thisWeekReports || 0,
      this_month: thisMonthReports || 0,
    },
    quality_trend: 'stable' as const,
    last_reviewed_at: new Date(flagger.review_date),
    status: flagger.status as 'active' | 'warning' | 'suspended',
  };
}

/**
 * Get analytics for all trusted flaggers
 */
export async function getTrustedFlaggerAnalytics(): Promise<TrustedFlaggerAnalytics> {
  const { data: flaggers, error } = await supabase
    .from('trusted_flaggers')
    .select('*')
    .eq('status', 'active')
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to fetch trusted flaggers: ${error.message}`);
  }

  if (!flaggers || flaggers.length === 0) {
    return {
      total_flaggers: 0,
      active_flaggers: 0,
      flaggers: [],
      aggregate_metrics: {
        average_accuracy: 0,
        average_response_time_ms: 0,
        total_reports_this_month: 0,
      },
    };
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const flaggerMetrics = await Promise.all(
    flaggers.map((flagger) =>
      calculateFlaggerMetrics(flagger, monthStart, weekStart)
    )
  );

  const aggregate_metrics = {
    average_accuracy:
      flaggerMetrics.reduce((sum, f) => sum + f.accuracy_rate, 0) /
      flaggerMetrics.length,
    average_response_time_ms:
      flaggerMetrics.reduce((sum, f) => sum + f.average_response_time_ms, 0) /
      flaggerMetrics.length,
    total_reports_this_month: flaggerMetrics.reduce(
      (sum, f) => sum + f.report_volume.this_month,
      0
    ),
  };

  return {
    total_flaggers: flaggers.length,
    active_flaggers: flaggerMetrics.filter((f) => f.status === 'active').length,
    flaggers: flaggerMetrics,
    aggregate_metrics,
  };
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

  const rawData = await response.json();

  // Convert date string to Date object
  return {
    ...rawData,
    last_reviewed_at: rawData.last_reviewed_at
      ? new Date(rawData.last_reviewed_at)
      : undefined,
  } as TrustedFlaggerMetrics;
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

  const rawData = await response.json();

  // Convert date strings to Date objects for each flagger
  return rawData.map(
    (
      flagger: RawFlaggerData &
        Omit<
          TrustedFlagger,
          | 'certification_date'
          | 'review_date'
          | 'created_at'
          | 'updated_at'
          | 'deleted_at'
        >
    ) => ({
      ...flagger,
      certification_date: new Date(flagger.certification_date),
      review_date: new Date(flagger.review_date),
      created_at: new Date(flagger.created_at),
      updated_at: new Date(flagger.updated_at),
      deleted_at: flagger.deleted_at ? new Date(flagger.deleted_at) : undefined,
    })
  ) as TrustedFlagger[];
}

/**
 * Calculate quality trend based on recent performance
 */
export function calculateQualityTrend(
  recentAccuracy: number[],
  currentAccuracy: number
): 'improving' | 'stable' | 'degrading' {
  if (recentAccuracy.length === 0) return 'stable';

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

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }

  if (hours > 0) {
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
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
