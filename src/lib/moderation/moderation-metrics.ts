// Re-export types and functions from focused modules to preserve the original
// public surface while keeping implementation split into smaller files.

import * as queries from './moderation-metrics-queries';
import * as trackers from './moderation-metrics-trackers';

export {
  calculateAppealReversalRate,
  getAppealMetrics,
  getODSMetrics,
} from './moderation-metrics-queries';
export {
  trackAppealDecision,
  trackFalsePositive,
  trackODSOutcome,
  trackSLABreach,
  trackSoRSubmissionLatency,
  trackTrustedFlaggerHandling,
} from './moderation-metrics-trackers';
export type {
  AppealMetrics,
  ModerationMetric,
  ODSMetrics,
} from './moderation-metrics-types';

export const moderationMetrics = {
  // Trackers
  trackAppealDecision: trackers.trackAppealDecision,
  trackODSOutcome: trackers.trackODSOutcome,
  trackSoRSubmissionLatency: trackers.trackSoRSubmissionLatency,
  trackTrustedFlaggerHandling: trackers.trackTrustedFlaggerHandling,
  trackFalsePositive: trackers.trackFalsePositive,
  trackSLABreach: trackers.trackSLABreach,
  // Queries
  calculateAppealReversalRate: queries.calculateAppealReversalRate,
  getAppealMetrics: queries.getAppealMetrics,
  getODSMetrics: queries.getODSMetrics,
} as const;
