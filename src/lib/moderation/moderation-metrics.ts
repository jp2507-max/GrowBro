/**
 * Moderation Metrics Tracking Service
 *
 * Tracks key metrics for DSA compliance and operational monitoring:
 * - Appeal reversal rates
 * - False positive rates
 * - Trusted flagger handling times
 * - SoR submission latency
 * - ODS escalation outcomes
 *
 * Requirements: 5.1, 5.2, 6.5, 13.1
 */

import type { AppealDecision, ModerationAction } from '@/types/moderation';

// ============================================================================
// Types
// ============================================================================

export interface ModerationMetric {
  metricName: string;
  value: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AppealMetrics {
  totalAppeals: number;
  upheldAppeals: number;
  rejectedAppeals: number;
  reversalRate: number;
}

export interface ODSMetrics {
  totalEscalations: number;
  upheldByODS: number;
  rejectedByODS: number;
  averageResolutionDays: number;
}

// ============================================================================
// Metric Tracking Functions
// ============================================================================

/**
 * Track appeal decision outcome
 *
 * Records:
 * - Appeal decision (upheld/rejected/partial)
 * - Time to resolution
 * - Original action type
 * - Reversal rate impact
 *
 * Requirement: 5.2
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

  // In production, send to metrics service (e.g., DataDog, Prometheus, CloudWatch)
  console.log('[ModerationMetrics] Appeal decision tracked:', metric);

  // Update reversal rate metrics
  if (decision === 'upheld') {
    const reversalMetric: ModerationMetric = {
      metricName: 'appeal_reversal_rate',
      value: 1,
      timestamp: new Date(),
      metadata: {
        appealId,
        originalAction,
      },
    };
    console.log('[ModerationMetrics] Reversal rate updated:', reversalMetric);
  }
}

/**
 * Track ODS escalation outcome
 *
 * Requirement: 13.1
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
}

/**
 * Track SoR submission latency
 *
 * Measures time from decision to EC Transparency DB submission
 *
 * Requirement: 6.5
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
}

/**
 * Track trusted flagger handling time
 *
 * Requirement: 5.2
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
}

/**
 * Track false positive rate
 *
 * Calculated based on appeals upheld / total decisions
 *
 * Requirement: 5.2
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
  }
}

/**
 * Track SLA breach
 *
 * Requirement: 5.1
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
}

/**
 * Calculate and track appeal reversal rate
 *
 * Requirement: 5.2
 */
export async function calculateAppealReversalRate(period: {
  startDate: Date;
  endDate: Date;
}): Promise<number> {
  // In production, query actual appeal data from database
  // For now, return placeholder
  console.log(
    '[ModerationMetrics] Calculating appeal reversal rate for period:',
    period
  );

  // Placeholder calculation
  const totalAppeals = 100;
  const upheldAppeals = 15;
  const reversalRate = (upheldAppeals / totalAppeals) * 100;

  const metric: ModerationMetric = {
    metricName: 'appeal_reversal_rate_period',
    value: reversalRate,
    timestamp: new Date(),
    metadata: {
      startDate: period.startDate,
      endDate: period.endDate,
      totalAppeals,
      upheldAppeals,
    },
  };

  console.log('[ModerationMetrics] Appeal reversal rate calculated:', metric);

  return reversalRate;
}

/**
 * Get appeal metrics summary
 *
 * Requirement: 5.2
 */
export async function getAppealMetrics(period: {
  startDate: Date;
  endDate: Date;
}): Promise<AppealMetrics> {
  // In production, query actual data from database
  console.log('[ModerationMetrics] Getting appeal metrics for period:', period);

  // Placeholder data
  return {
    totalAppeals: 100,
    upheldAppeals: 15,
    rejectedAppeals: 85,
    reversalRate: 15.0,
  };
}

/**
 * Get ODS metrics summary
 *
 * Requirement: 13.1
 */
export async function getODSMetrics(period: {
  startDate: Date;
  endDate: Date;
}): Promise<ODSMetrics> {
  // In production, query actual data from database
  console.log('[ModerationMetrics] Getting ODS metrics for period:', period);

  // Placeholder data
  return {
    totalEscalations: 10,
    upheldByODS: 4,
    rejectedByODS: 6,
    averageResolutionDays: 75,
  };
}

// ============================================================================
// Exports
// ============================================================================

export const moderationMetrics = {
  trackAppealDecision,
  trackODSOutcome,
  trackSoRSubmissionLatency,
  trackTrustedFlaggerHandling,
  trackFalsePositive,
  trackSLABreach,
  calculateAppealReversalRate,
  getAppealMetrics,
  getODSMetrics,
};
