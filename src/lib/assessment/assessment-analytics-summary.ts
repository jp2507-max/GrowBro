import { database } from '@/lib/watermelon';

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
  const [completedResult] = await database.adapter.unsafeExecuteSql(
    'SELECT COUNT(*) as count FROM assessments WHERE status = ?',
    ['completed']
  );
  const [failedResult] = await database.adapter.unsafeExecuteSql(
    'SELECT COUNT(*) as count FROM assessments WHERE status = ?',
    ['failed']
  );
  const [pendingResult] = await database.adapter.unsafeExecuteSql(
    'SELECT COUNT(*) as count FROM assessments WHERE status = ?',
    ['pending']
  );

  const completed = completedResult.rows._array[0].count;
  const failed = failedResult.rows._array[0].count;
  const pending = pendingResult.rows._array[0].count;
  const total = completed + failed + pending;

  // Get average confidence for completed assessments
  const [avgResult] = await database.adapter.unsafeExecuteSql(
    'SELECT AVG(calibrated_confidence) as avg FROM assessments WHERE status = ? AND calibrated_confidence IS NOT NULL',
    ['completed']
  );
  const avgConfidence = avgResult.rows._array[0].avg || 0;

  // Round to 2 decimal places
  const roundedAvgConfidence = Math.round(avgConfidence * 100) / 100;

  // Get feedback counts using targeted queries
  const [totalFeedbackResult] = await database.adapter.unsafeExecuteSql(
    'SELECT COUNT(*) as count FROM assessment_feedback'
  );
  const [helpfulResult] = await database.adapter.unsafeExecuteSql(
    'SELECT COUNT(*) as count FROM assessment_feedback WHERE helpful = 1'
  );
  const [resolvedResult] = await database.adapter.unsafeExecuteSql(
    'SELECT COUNT(*) as count FROM assessment_feedback WHERE issue_resolved = ?',
    ['yes']
  );

  const totalFeedback = totalFeedbackResult.rows._array[0].count;
  const helpfulCount = helpfulResult.rows._array[0].count;
  const resolvedCount = resolvedResult.rows._array[0].count;

  const helpfulnessRate = totalFeedback > 0 ? helpfulCount / totalFeedback : 0;
  const resolutionRate = totalFeedback > 0 ? resolvedCount / totalFeedback : 0;

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
