import { database } from '@/lib/watermelon';
import type { AssessmentModel } from '@/lib/watermelon-models/assessment';
import type { AssessmentFeedbackModel } from '@/lib/watermelon-models/assessment-feedback';

/**
 * Get overall assessment summary
 */
export async function getAssessmentSummary(): Promise<{
  total: number;
  completed: number;
  failed: number;
  pending: number;
  avgConfidence: number;
  helpfulnessRate: number;
  resolutionRate: number;
}> {
  const assessments = await database
    .get<AssessmentModel>('assessments')
    .query()
    .fetch();

  const completed = assessments.filter((a) => a.status === 'completed');
  const failed = assessments.filter((a) => a.status === 'failed');
  const pending = assessments.filter((a) => a.status === 'pending');

  const avgConfidence =
    completed.length > 0
      ? Math.round(
          (completed.reduce(
            (sum, a) => sum + (a.calibratedConfidence ?? 0),
            0
          ) /
            completed.length) *
            100
        ) / 100 // Round to 2 decimal places
      : 0;

  const feedback = await database
    .get<AssessmentFeedbackModel>('assessment_feedback')
    .query()
    .fetch();

  const helpfulCount = feedback.filter((f) => f.helpful).length;
  const resolvedCount = feedback.filter(
    (f) => f.issueResolved === 'yes'
  ).length;

  return {
    total: assessments.length,
    completed: completed.length,
    failed: failed.length,
    pending: pending.length,
    avgConfidence,
    helpfulnessRate: feedback.length > 0 ? helpfulCount / feedback.length : 0,
    resolutionRate: feedback.length > 0 ? resolvedCount / feedback.length : 0,
  };
}
