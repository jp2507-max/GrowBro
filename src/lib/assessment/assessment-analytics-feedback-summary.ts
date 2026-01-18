import { runSql } from '@/lib/database/unsafe-sql-utils';

export async function getFeedbackMetrics(): Promise<{
  helpfulnessRate: number;
  resolutionRate: number;
}> {
  // Get feedback counts using targeted queries
  const [totalFeedbackResult] = await runSql(
    'assessment_feedback',
    'SELECT COUNT(*) as count FROM assessment_feedback'
  );
  const [helpfulResult] = await runSql(
    'assessment_feedback',
    'SELECT COUNT(*) as count FROM assessment_feedback WHERE helpful = 1'
  );
  const [resolvedResult] = await runSql(
    'assessment_feedback',
    'SELECT COUNT(*) as count FROM assessment_feedback WHERE issue_resolved = ?',
    ['yes']
  );

  const totalFeedback = Number(
    totalFeedbackResult?.rows?._array?.[0]?.count ?? 0
  );
  const helpfulCount = Number(helpfulResult?.rows?._array?.[0]?.count ?? 0);
  const resolvedCount = Number(resolvedResult?.rows?._array?.[0]?.count ?? 0);

  const helpfulnessRate = totalFeedback > 0 ? helpfulCount / totalFeedback : 0;
  const resolutionRate = totalFeedback > 0 ? resolvedCount / totalFeedback : 0;

  return {
    helpfulnessRate,
    resolutionRate,
  };
}
