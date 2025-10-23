import { supabase } from '@/lib/supabase';
import type { AppealDecision, ModerationAction } from '@/types/moderation';

import type { ModerationMetric } from './moderation-metrics-types';

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
 * Track appeal decision outcome
 */
export function trackAppealDecision(
  appealId: string,
  decision: AppealDecision,
  metricsData: {
    originalAction: ModerationAction;
    timeToResolutionHours?: number;
  }
): void {
  const metric: ModerationMetric = {
    metricName: 'appeal_decision',
    value: decision === 'upheld' ? 1 : 0,
    timestamp: new Date(),
    metadata: {
      appealId,
      decision,
      originalAction: metricsData.originalAction,
      timeToResolutionHours: metricsData.timeToResolutionHours,
    },
  };

  console.log('[ModerationMetrics] Appeal decision tracked:', metric);
  void persistMetric(metric);

  if (decision === 'upheld') {
    const reversalMetric: ModerationMetric = {
      metricName: 'appeal_reversal_rate',
      value: 1,
      timestamp: new Date(),
      metadata: {
        appealId,
        originalAction: metricsData.originalAction,
      },
    };
    console.log('[ModerationMetrics] Reversal rate updated:', reversalMetric);
    void persistMetric(reversalMetric);
  }
}

/**
 * Track ODS escalation outcome
 */
export function trackODSOutcome(
  escalationId: string,
  outcome: 'upheld' | 'rejected' | 'partial' | 'no_decision',
  metricsData: { odsBodyId: string; resolutionDays?: number }
): void {
  const metric: ModerationMetric = {
    metricName: 'ods_escalation_outcome',
    value: outcome === 'upheld' ? 1 : 0,
    timestamp: new Date(),
    metadata: {
      escalationId,
      outcome,
      odsBodyId: metricsData.odsBodyId,
      resolutionDays: metricsData.resolutionDays,
    },
  };

  console.log('[ModerationMetrics] ODS outcome tracked:', metric);
  void persistMetric(metric);
}

/**
 * Track SoR submission latency
 */
export function trackSoRSubmissionLatency(
  statementId: string,
  latencyMinutes: number,
  success: boolean
): void {
  const metric: ModerationMetric = {
    metricName: 'sor_submission_latency',
    value: latencyMinutes,
    timestamp: new Date(),
    metadata: {
      statementId,
      success,
      latencyMinutes,
    },
  };

  console.log('[ModerationMetrics] SoR submission latency tracked:', metric);
  void persistMetric(metric);
}

/**
 * Track trusted flagger handling time
 */
export function trackTrustedFlaggerHandling(
  reportId: string,
  flaggerId: string,
  metricsData: { handlingTimeHours: number; actionTaken?: ModerationAction }
): void {
  const metric: ModerationMetric = {
    metricName: 'trusted_flagger_handling_time',
    value: metricsData.handlingTimeHours,
    timestamp: new Date(),
    metadata: {
      reportId,
      flaggerId,
      actionTaken: metricsData.actionTaken,
    },
  };

  console.log('[ModerationMetrics] Trusted flagger handling tracked:', metric);
  void persistMetric(metric);
}

/**
 * Track false positive rate
 */
export function trackFalsePositive(
  decisionId: string,
  originalAction: ModerationAction,
  appealUpheld: boolean
): void {
  if (appealUpheld) {
    const metric: ModerationMetric = {
      metricName: 'false_positive_rate',
      value: 1,
      timestamp: new Date(),
      metadata: {
        decisionId,
        originalAction,
      },
    };

    console.log('[ModerationMetrics] False positive tracked:', metric);
    void persistMetric(metric);
  }
}

/**
 * Track SLA breach
 */
export function trackSLABreach(
  reportId: string,
  reportType: 'illegal' | 'policy_violation',
  breachDurationHours: number
): void {
  const metric: ModerationMetric = {
    metricName: 'sla_breach',
    value: breachDurationHours,
    timestamp: new Date(),
    metadata: {
      reportId,
      reportType,
      breachDurationHours,
    },
  };

  console.log('[ModerationMetrics] SLA breach tracked:', metric);
  void persistMetric(metric);
}
