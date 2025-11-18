import { runSql } from '@/lib/database/unsafe-sql-utils';

import { getFeedbackMetrics } from './assessment-analytics-feedback-summary';

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
  // Get status counts using targeted queries
  const [completedResult] = await runSql(
    'SELECT COUNT(*) as count FROM assessments WHERE status = ?',
    ['completed']
  );
  const [failedResult] = await runSql(
    'SELECT COUNT(*) as count FROM assessments WHERE status = ?',
    ['failed']
  );
  const [pendingResult] = await runSql(
    'SELECT COUNT(*) as count FROM assessments WHERE status = ?',
    ['pending']
  );
  const completed = Number(completedResult?.rows?._array?.[0]?.count ?? 0);
  const failed = Number(failedResult?.rows?._array?.[0]?.count ?? 0);
  const pending = Number(pendingResult?.rows?._array?.[0]?.count ?? 0);
  const total = completed + failed + pending;
  // Get average confidence for completed assessments
  const [avgResult] = await runSql(
    'SELECT AVG(calibrated_confidence) as avg FROM assessments WHERE status = ? AND calibrated_confidence IS NOT NULL',
    ['completed']
  );
  const avgConfidence = Number(avgResult?.rows?._array?.[0]?.avg ?? 0);

  // Round to 2 decimal places
  const roundedAvgConfidence = Math.round(avgConfidence * 100) / 100;

  const { helpfulnessRate, resolutionRate } = await getFeedbackMetrics();

  return {
    total,
    completed,
    failed,
    pending,
    avgConfidence: roundedAvgConfidence,
    helpfulnessRate,
    resolutionRate,
  };
}
