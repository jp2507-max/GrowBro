import { Q } from '@nozbe/watermelondb';

import { database } from '@/lib/watermelon';
import type { AssessmentModel } from '@/lib/watermelon-models/assessment';
import type { AssessmentFeedbackModel } from '@/lib/watermelon-models/assessment-feedback';

export type PerClassMetrics = {
  classId: string;
  totalAssessments: number;
  avgConfidence: number;
  helpfulCount: number;
  notHelpfulCount: number;
  resolvedCount: number;
  notResolvedCount: number;
  helpfulnessRate: number;
  resolutionRate: number;
};

export type GetPerClassMetricsOptions = {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
};

/**
 * Get per-class accuracy and helpfulness metrics
 * @param options - Optional filtering and pagination parameters
 */
// This function performs a number of grouping and aggregation steps; keep as-is
// eslint-disable-next-line max-lines-per-function
export async function getPerClassMetrics(
  options: GetPerClassMetricsOptions = {}
): Promise<PerClassMetrics[]> {
  // Defensive guards for limit
  const MAX_LIMIT = 1000;
  const limit = Math.min(options.limit ?? MAX_LIMIT, MAX_LIMIT);
  const offset = Math.max(options.offset ?? 0, 0);

  // Build assessment query with filters
  const assessmentQuery = [Q.where('status', 'completed')];

  if (options.startDate) {
    assessmentQuery.push(
      Q.where('created_at', Q.gte(options.startDate.getTime()))
    );
  }

  if (options.endDate) {
    assessmentQuery.push(
      Q.where('created_at', Q.lte(options.endDate.getTime()))
    );
  }

  const assessments = await database
    .get<AssessmentModel>('assessments')
    .query(...assessmentQuery)
    .extend(Q.take(limit), Q.skip(offset))
    .fetch();

  // Get feedback for the filtered assessments
  const assessmentIds = assessments.map((a) => a.id);
  const feedbackQuery =
    assessmentIds.length > 0
      ? [Q.where('assessment_id', Q.oneOf(assessmentIds))]
      : [];

  if (options.startDate) {
    feedbackQuery.push(
      Q.where('created_at', Q.gte(options.startDate.getTime()))
    );
  }

  if (options.endDate) {
    feedbackQuery.push(Q.where('created_at', Q.lte(options.endDate.getTime())));
  }

  const feedbackMap = new Map<string, AssessmentFeedbackModel[]>();
  const allFeedback = await database
    .get<AssessmentFeedbackModel>('assessment_feedback')
    .query(...feedbackQuery)
    .fetch();

  for (const feedback of allFeedback) {
    if (!feedbackMap.has(feedback.assessmentId)) {
      feedbackMap.set(feedback.assessmentId, []);
    }
    feedbackMap.get(feedback.assessmentId)!.push(feedback);
  }

  // Group by predicted class
  const classGroups = new Map<
    string,
    {
      assessments: AssessmentModel[];
      feedback: AssessmentFeedbackModel[];
    }
  >();

  for (const assessment of assessments) {
    if (!assessment.predictedClass) continue;

    if (!classGroups.has(assessment.predictedClass)) {
      classGroups.set(assessment.predictedClass, {
        assessments: [],
        feedback: [],
      });
    }

    const group = classGroups.get(assessment.predictedClass)!;
    group.assessments.push(assessment);

    const feedbacks = feedbackMap.get(assessment.id) || [];
    group.feedback.push(...feedbacks);
  }

  // Calculate metrics per class
  const metrics: PerClassMetrics[] = [];

  classGroups.forEach((group, classId) => {
    const totalAssessments = group.assessments.length;
    const avgConfidence =
      Math.round(
        (group.assessments.reduce(
          (sum, a) => sum + (a.calibratedConfidence ?? 0),
          0
        ) /
          totalAssessments) *
          100
      ) / 100; // Round to 2 decimal places

    const helpfulCount = group.feedback.filter((f) => f.helpful).length;
    const notHelpfulCount = group.feedback.filter((f) => !f.helpful).length;
    const resolvedCount = group.feedback.filter(
      (f) => f.issueResolved === 'yes'
    ).length;
    const notResolvedCount = group.feedback.filter(
      (f) => f.issueResolved === 'no'
    ).length;

    const helpfulnessRate =
      group.feedback.length > 0 ? helpfulCount / group.feedback.length : 0;
    const resolutionRate =
      group.feedback.length > 0 ? resolvedCount / group.feedback.length : 0;

    metrics.push({
      classId,
      totalAssessments,
      avgConfidence,
      helpfulCount,
      notHelpfulCount,
      resolvedCount,
      notResolvedCount,
      helpfulnessRate,
      resolutionRate,
    });
  });

  return metrics.sort((a, b) => b.totalAssessments - a.totalAssessments);
}
