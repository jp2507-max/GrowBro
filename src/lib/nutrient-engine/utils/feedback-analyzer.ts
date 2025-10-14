import type { DiagnosticFeedbackSummary } from '../types';

/**
 * Placeholder for future ML-based threshold optimization
 *
 * Planned approach:
 * 1. Aggregate feedback (helpful/not helpful) by confidence buckets (0.0-0.1, 0.1-0.2, ..., 0.9-1.0)
 * 2. Calculate precision and recall for each bucket
 * 3. Find optimal threshold that maximizes F1 score
 * 4. Adjust AI confidence threshold dynamically based on feedback patterns
 * 5. Consider separate thresholds per issue type (deficiency, toxicity, lockout, drift)
 *
 * Requirements:
 * - Minimum sample size per bucket (e.g., 30 feedbacks) before adjusting
 * - Gradual threshold updates to avoid oscillation
 * - A/B testing framework to validate threshold changes
 * - User-level overrides for growers who prefer different sensitivity
 *
 * TODO: Implement this as part of future iteration when sufficient feedback data exists
 */

type FeedbackBucket = {
  confidenceRange: [number, number];
  helpfulCount: number;
  notHelpfulCount: number;
  precision: number;
};

/**
 * Stub function for analyzing feedback to suggest threshold adjustments
 * @returns Suggested new threshold or null if insufficient data
 */
export function analyzeFeedbackForThresholdAdjustment(
  feedbackByDiagnostic: Map<
    string,
    DiagnosticFeedbackSummary & { confidence: number }
  >
): number | null {
  // Placeholder implementation
  // TODO: Implement actual analysis when feedback data is available

  const buckets = createFeedbackBuckets(feedbackByDiagnostic);

  // Need minimum sample size before suggesting changes
  const MINIMUM_SAMPLES_PER_BUCKET = 30;
  const insufficientData = buckets.some(
    (bucket) =>
      bucket.helpfulCount + bucket.notHelpfulCount < MINIMUM_SAMPLES_PER_BUCKET
  );

  if (insufficientData) {
    return null;
  }

  // Find bucket with highest precision while maintaining reasonable recall
  const optimalBucket = findOptimalBucket(buckets);

  if (!optimalBucket) {
    return null;
  }

  // Return midpoint of optimal confidence range
  return (
    (optimalBucket.confidenceRange[0] + optimalBucket.confidenceRange[1]) / 2
  );
}

function createFeedbackBuckets(
  feedbackByDiagnostic: Map<
    string,
    DiagnosticFeedbackSummary & { confidence: number }
  >
): FeedbackBucket[] {
  const buckets: FeedbackBucket[] = [];

  for (let i = 0; i < 10; i++) {
    const rangeStart = i * 0.1;
    const rangeEnd = (i + 1) * 0.1;

    let helpfulCount = 0;
    let notHelpfulCount = 0;

    for (const [, feedback] of feedbackByDiagnostic) {
      if (feedback.confidence >= rangeStart && feedback.confidence < rangeEnd) {
        helpfulCount += feedback.helpfulCount;
        notHelpfulCount += feedback.notHelpfulCount;
      }
    }

    const total = helpfulCount + notHelpfulCount;
    const precision = total > 0 ? helpfulCount / total : 0;

    buckets.push({
      confidenceRange: [rangeStart, rangeEnd],
      helpfulCount,
      notHelpfulCount,
      precision,
    });
  }

  return buckets;
}

function findOptimalBucket(buckets: FeedbackBucket[]): FeedbackBucket | null {
  // Target precision >= 0.75
  const TARGET_PRECISION = 0.75;

  const candidateBuckets = buckets.filter(
    (bucket) => bucket.precision >= TARGET_PRECISION
  );

  if (candidateBuckets.length === 0) {
    return null;
  }

  // Return bucket with lowest threshold (more permissive) among candidates
  return candidateBuckets.reduce((lowest, current) =>
    current.confidenceRange[0] < lowest.confidenceRange[0] ? current : lowest
  );
}
