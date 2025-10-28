import { Q } from '@nozbe/watermelondb';

import { database } from '@/lib/watermelon';
import type { AssessmentModel } from '@/lib/watermelon-models/assessment';
import type { AssessmentFeedbackModel } from '@/lib/watermelon-models/assessment-feedback';
import type { AssessmentTelemetryModel } from '@/lib/watermelon-models/assessment-telemetry';

/**
 * Assessment Analytics
 * Aggregation queries for model performance monitoring
 */

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

export type InferenceMetrics = {
  totalAssessments: number;
  deviceCount: number;
  cloudCount: number;
  avgDeviceLatencyMs: number;
  avgCloudLatencyMs: number;
  p95DeviceLatencyMs: number;
  p95CloudLatencyMs: number;
  failureCount: number;
  fallbackCount: number;
};

export type UserActionMetrics = {
  taskCreatedCount: number;
  playbookShiftedCount: number;
  communityCtaCount: number;
  taskCreationRate: number;
  playbookShiftRate: number;
  communityCtaRate: number;
};

/**
 * Get per-class accuracy and helpfulness metrics
 */
export async function getPerClassMetrics(): Promise<PerClassMetrics[]> {
  const assessments = await database
    .get<AssessmentModel>('assessments')
    .query(Q.where('status', 'completed'))
    .fetch();

  const feedbackMap = new Map<string, AssessmentFeedbackModel[]>();
  const allFeedback = await database
    .get<AssessmentFeedbackModel>('assessment_feedback')
    .query()
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

  for (const [classId, group] of classGroups) {
    const totalAssessments = group.assessments.length;
    const avgConfidence =
      group.assessments.reduce(
        (sum, a) => sum + (a.calibratedConfidence ?? 0),
        0
      ) / totalAssessments;

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
  }

  return metrics.sort((a, b) => b.totalAssessments - a.totalAssessments);
}

/**
 * Get inference performance metrics
 */
export async function getInferenceMetrics(): Promise<InferenceMetrics> {
  const assessments = await database
    .get<AssessmentModel>('assessments')
    .query(Q.where('status', 'completed'))
    .fetch();

  const telemetry = await database
    .get<AssessmentTelemetryModel>('assessment_telemetry')
    .query()
    .fetch();

  const deviceAssessments = assessments.filter(
    (a) => a.inferenceMode === 'device'
  );
  const cloudAssessments = assessments.filter(
    (a) => a.inferenceMode === 'cloud'
  );

  const deviceLatencies = deviceAssessments
    .map((a) => a.latencyMs)
    .filter((l): l is number => l !== undefined && l !== null);
  const cloudLatencies = cloudAssessments
    .map((a) => a.latencyMs)
    .filter((l): l is number => l !== undefined && l !== null);

  const avgDeviceLatencyMs =
    deviceLatencies.length > 0
      ? deviceLatencies.reduce((sum, l) => sum + l, 0) / deviceLatencies.length
      : 0;

  const avgCloudLatencyMs =
    cloudLatencies.length > 0
      ? cloudLatencies.reduce((sum, l) => sum + l, 0) / cloudLatencies.length
      : 0;

  // Calculate p95 latency
  const p95DeviceLatencyMs = calculateP95(deviceLatencies);
  const p95CloudLatencyMs = calculateP95(cloudLatencies);

  const failureCount = telemetry.filter(
    (t) => t.eventType === 'inference_failed'
  ).length;
  const fallbackCount = telemetry.filter(
    (t) => t.eventType === 'cloud_fallback'
  ).length;

  return {
    totalAssessments: assessments.length,
    deviceCount: deviceAssessments.length,
    cloudCount: cloudAssessments.length,
    avgDeviceLatencyMs,
    avgCloudLatencyMs,
    p95DeviceLatencyMs,
    p95CloudLatencyMs,
    failureCount,
    fallbackCount,
  };
}

/**
 * Get user action metrics
 */
export async function getUserActionMetrics(): Promise<UserActionMetrics> {
  const telemetry = await database
    .get<AssessmentTelemetryModel>('assessment_telemetry')
    .query()
    .fetch();

  const completedAssessments = await database
    .get<AssessmentModel>('assessments')
    .query(Q.where('status', 'completed'))
    .fetch();

  const totalCompleted = completedAssessments.length;

  const taskCreatedCount = telemetry.filter(
    (t) => t.eventType === 'task_created'
  ).length;
  const playbookShiftedCount = telemetry.filter(
    (t) => t.eventType === 'playbook_adjustment'
  ).length;
  const communityCtaCount = telemetry.filter(
    (t) => t.eventType === 'community_cta_tapped'
  ).length;

  return {
    taskCreatedCount,
    playbookShiftedCount,
    communityCtaCount,
    taskCreationRate:
      totalCompleted > 0 ? taskCreatedCount / totalCompleted : 0,
    playbookShiftRate:
      totalCompleted > 0 ? playbookShiftedCount / totalCompleted : 0,
    communityCtaRate:
      totalCompleted > 0 ? communityCtaCount / totalCompleted : 0,
  };
}

/**
 * Get model version distribution
 */
export async function getModelVersionDistribution(): Promise<
  Record<string, number>
> {
  const assessments = await database
    .get<AssessmentModel>('assessments')
    .query(Q.where('status', 'completed'))
    .fetch();

  const distribution: Record<string, number> = {};

  for (const assessment of assessments) {
    const version = assessment.modelVersion || 'unknown';
    distribution[version] = (distribution[version] || 0) + 1;
  }

  return distribution;
}

/**
 * Get execution provider distribution
 */
export async function getExecutionProviderDistribution(): Promise<
  Record<string, number>
> {
  const telemetry = await database
    .get<AssessmentTelemetryModel>('assessment_telemetry')
    .query(Q.where('event_type', 'inference_started'))
    .fetch();

  const distribution: Record<string, number> = {};

  for (const event of telemetry) {
    const provider = event.executionProvider || 'unknown';
    distribution[provider] = (distribution[provider] || 0) + 1;
  }

  return distribution;
}

/**
 * Calculate p95 percentile
 */
function calculateP95(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[index] ?? 0;
}

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
      ? completed.reduce((sum, a) => sum + (a.calibratedConfidence ?? 0), 0) /
        completed.length
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
