import { supabase } from '../supabase';
import type {
  AppealMetrics,
  ModerationMetric,
  ODSMetrics,
} from './moderation-metrics-types';

type DbAppealRecord = {
  decision: string | null;
};

type DbODSEscalationRecord = {
  outcome: string | null;
  submitted_at: string;
  actual_resolution_date: string | null;
};

/**
 * Persist a metric to the database for observability
 */
async function persistMetric(metric: ModerationMetric): Promise<void> {
  try {
    const { error } = await supabase.from('moderation_metrics').insert({
      metric_name: metric.metricName,
      value: metric.value,
      timestamp: metric.timestamp.toISOString(),
      metadata: metric.metadata || {},
    });

    if (error) {
      console.error('[ModerationMetrics] Failed to persist metric:', error);
    }
  } catch (err) {
    console.error('[ModerationMetrics] Error persisting metric:', err);
  }
}

/**
 * Calculate and track appeal reversal rate
 */
export async function calculateAppealReversalRate(period: {
  startDate: Date;
  endDate: Date;
}): Promise<number> {
  console.log(
    '[ModerationMetrics] Calculating appeal reversal rate for period:',
    period
  );

  try {
    // Query total resolved appeals within the period
    const { data: appeals, error } = await supabase
      .from('appeals')
      .select('decision')
      .gte('submitted_at', period.startDate.toISOString())
      .lte('submitted_at', period.endDate.toISOString())
      .not('decision', 'is', null)
      .is('deleted_at', null);

    if (error) {
      console.error('[ModerationMetrics] Failed to query appeals:', error);
      return 0;
    }

    const totalAppeals = appeals.length;
    if (totalAppeals === 0) {
      return 0;
    }

    // Count appeals where decision was reversed (rejected = original decision overturned)
    const reversedAppeals = appeals.filter(
      (appeal) => appeal.decision === 'rejected'
    ).length;
    const reversalRate = (reversedAppeals / totalAppeals) * 100;

    const metric: ModerationMetric = {
      metricName: 'appeal_reversal_rate_period',
      value: reversalRate,
      timestamp: new Date(),
      metadata: {
        startDate: period.startDate,
        endDate: period.endDate,
        totalAppeals,
        reversedAppeals,
      },
    };

    console.log('[ModerationMetrics] Appeal reversal rate calculated:', metric);
    void persistMetric(metric);

    return reversalRate;
  } catch (error) {
    console.error(
      '[ModerationMetrics] Error calculating appeal reversal rate:',
      error
    );
    return 0;
  }
}

/**
 * Get appeal metrics summary
 */
export async function getAppealMetrics(period: {
  startDate: Date;
  endDate: Date;
}): Promise<AppealMetrics> {
  console.log('[ModerationMetrics] Getting appeal metrics for period:', period);

  try {
    const appeals = await queryResolvedAppeals(period);
    if (!appeals) {
      return {
        totalAppeals: 0,
        upheldAppeals: 0,
        rejectedAppeals: 0,
        reversalRate: 0,
      };
    }

    const totalAppeals = appeals.length;
    if (totalAppeals === 0) {
      return {
        totalAppeals: 0,
        upheldAppeals: 0,
        rejectedAppeals: 0,
        reversalRate: 0,
      };
    }

    const upheldAppeals = countByDecision(appeals, 'rejected');
    const rejectedAppeals = countByDecision(appeals, 'upheld');
    const reversalRate = (upheldAppeals / totalAppeals) * 100;

    console.log('[ModerationMetrics] Appeal metrics calculated:', {
      totalAppeals,
      upheldAppeals,
      rejectedAppeals,
      reversalRate,
    });

    persistAppealMetrics(period, totalAppeals, upheldAppeals);

    return {
      totalAppeals,
      upheldAppeals,
      rejectedAppeals,
      reversalRate,
    };
  } catch (error) {
    console.error('[ModerationMetrics] Error getting appeal metrics:', error);
    return {
      totalAppeals: 0,
      upheldAppeals: 0,
      rejectedAppeals: 0,
      reversalRate: 0,
    };
  }
}

async function queryResolvedAppeals(period: {
  startDate: Date;
  endDate: Date;
}): Promise<DbAppealRecord[] | null> {
  const { data: appeals, error } = await supabase
    .from('appeals')
    .select('decision')
    .gte('submitted_at', period.startDate.toISOString())
    .lte('submitted_at', period.endDate.toISOString())
    .eq('status', 'resolved')
    .is('deleted_at', null);

  if (error) {
    console.error('[ModerationMetrics] Failed to query appeals:', error);
    return null;
  }

  return appeals;
}

function countByDecision(appeals: DbAppealRecord[], decision: string): number {
  return appeals.filter((a) => a.decision === decision).length;
}

function persistAppealMetrics(
  period: { startDate: Date; endDate: Date },
  totalAppeals: number,
  upheldAppeals: number
) {
  const metrics: ModerationMetric[] = [
    {
      metricName: 'total_appeals_period',
      value: totalAppeals,
      timestamp: new Date(),
      metadata: {
        startDate: period.startDate,
        endDate: period.endDate,
      },
    },
    {
      metricName: 'appeal_upheld_rate_period',
      value: (upheldAppeals / totalAppeals) * 100,
      timestamp: new Date(),
      metadata: {
        startDate: period.startDate,
        endDate: period.endDate,
        upheldAppeals,
        totalAppeals,
      },
    },
    {
      metricName: 'appeal_reversal_rate_period',
      value: (upheldAppeals / totalAppeals) * 100,
      timestamp: new Date(),
      metadata: {
        startDate: period.startDate,
        endDate: period.endDate,
        upheldAppeals,
        totalAppeals,
      },
    },
  ];

  for (const metric of metrics) {
    void persistMetric(metric);
  }
}

/**
 * Get ODS metrics summary
 */
export async function getODSMetrics(period: {
  startDate: Date;
  endDate: Date;
}): Promise<ODSMetrics> {
  console.log('[ModerationMetrics] Getting ODS metrics for period:', period);

  try {
    const escalations = await queryODSEscalations(period);
    if (!escalations) {
      return {
        totalEscalations: 0,
        upheldByODS: 0,
        rejectedByODS: 0,
        averageResolutionDays: 0,
      };
    }

    const totalEscalations = escalations.length;
    const upheldByODS = countByOutcome(escalations, 'upheld');
    const rejectedByODS = countByOutcome(escalations, 'rejected');
    const averageResolutionDays = calculateAverageResolutionDays(escalations);

    const metrics: ODSMetrics = {
      totalEscalations,
      upheldByODS,
      rejectedByODS,
      averageResolutionDays,
    };

    console.log('[ModerationMetrics] ODS metrics calculated:', metrics);

    persistODSMetrics({ period, escalations, totalEscalations, upheldByODS });

    return metrics;
  } catch (error) {
    console.error('[ModerationMetrics] Error getting ODS metrics:', error);
    return {
      totalEscalations: 0,
      upheldByODS: 0,
      rejectedByODS: 0,
      averageResolutionDays: 0,
    };
  }
}

async function queryODSEscalations(period: {
  startDate: Date;
  endDate: Date;
}): Promise<DbODSEscalationRecord[] | null> {
  const { data: escalations, error } = await supabase
    .from('ods_escalations')
    .select('outcome, submitted_at, actual_resolution_date')
    .gte('submitted_at', period.startDate.toISOString())
    .lte('submitted_at', period.endDate.toISOString())
    .is('deleted_at', null);

  if (error) {
    console.error(
      '[ModerationMetrics] Failed to query ODS escalations:',
      error
    );
    return null;
  }

  return escalations;
}

function countByOutcome(
  escalations: DbODSEscalationRecord[],
  outcome: string
): number {
  return escalations.filter((e) => e.outcome === outcome).length;
}

function calculateAverageResolutionDays(
  escalations: DbODSEscalationRecord[]
): number {
  const resolvedEscalations = escalations.filter(
    (escalation) =>
      escalation.actual_resolution_date &&
      escalation.outcome &&
      escalation.outcome !== 'no_decision'
  );

  if (resolvedEscalations.length === 0) return 0;

  const totalResolutionDays = resolvedEscalations.reduce((sum, escalation) => {
    const submittedDate = new Date(escalation.submitted_at);
    const resolvedDate = new Date(escalation.actual_resolution_date!);
    const daysDiff = Math.ceil(
      (resolvedDate.getTime() - submittedDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return sum + daysDiff;
  }, 0);

  return Math.round(totalResolutionDays / resolvedEscalations.length);
}

function persistODSMetrics(opts: {
  period: { startDate: Date; endDate: Date };
  escalations: DbODSEscalationRecord[];
  totalEscalations: number;
  upheldByODS: number;
}) {
  const { period, escalations, totalEscalations, upheldByODS } = opts;

  const persistedMetrics: ModerationMetric[] = [
    {
      metricName: 'ods_total_escalations_period',
      value: totalEscalations,
      timestamp: new Date(),
      metadata: {
        startDate: period.startDate,
        endDate: period.endDate,
      },
    },
    {
      metricName: 'ods_upheld_rate_period',
      value: totalEscalations > 0 ? (upheldByODS / totalEscalations) * 100 : 0,
      timestamp: new Date(),
      metadata: {
        startDate: period.startDate,
        endDate: period.endDate,
        upheldByODS,
        totalEscalations,
      },
    },
    {
      metricName: 'ods_average_resolution_days_period',
      value: calculateAverageResolutionDays(escalations),
      timestamp: new Date(),
      metadata: {
        startDate: period.startDate,
        endDate: period.endDate,
        resolvedCases: escalations.filter(
          (e) =>
            e.actual_resolution_date && e.outcome && e.outcome !== 'no_decision'
        ).length,
      },
    },
  ];

  for (const metric of persistedMetrics) {
    void persistMetric(metric);
  }
}
