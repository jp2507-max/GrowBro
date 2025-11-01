import { database } from '@/lib/watermelon';

// SQLiteQuery type is not directly exported, so we define it inline
type SQLiteQuery = [string, any[]];

/**
 * Type predicate to check if an adapter implements unsafeExecute
 */
function hasUnsafeExecute(
  adapter: any
): adapter is { unsafeExecute: Function } {
  return typeof adapter?.unsafeExecute === 'function';
}

// Helper to run a single SQL via the adapter. The adapter exposes
// `unsafeExecute(work, cb)` which is callback-based; wrap it in a Promise
// and return the results array (matching the previous unsafeExecuteSql shape).
async function runSql(sql: string, params: any[] = []): Promise<any[]> {
  // Verify adapter supports unsafeExecute at runtime
  if (!hasUnsafeExecute(database.adapter)) {
    throw new Error('Database adapter does not support unsafeExecute method');
  }

  const work = { sqls: [[sql, params]] as SQLiteQuery[] };

  // Wrap the callback-based unsafeExecute in a Promise
  return new Promise((resolve, reject) => {
    (database.adapter as any).unsafeExecute(work, (result: any) => {
      if (result && result.error) {
        reject(result.error);
        return;
      }
      // result.results is expected to be an array of result objects
      resolve(result?.results || []);
    });
  });
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
  const avgConfidence = avgResult?.rows?._array?.[0]?.avg ?? 0;

  // Round to 2 decimal places
  const roundedAvgConfidence = Math.round(avgConfidence * 100) / 100;

  // Get feedback counts using targeted queries
  const [totalFeedbackResult] = await runSql(
    'SELECT COUNT(*) as count FROM assessment_feedback'
  );
  const [helpfulResult] = await runSql(
    'SELECT COUNT(*) as count FROM assessment_feedback WHERE helpful = 1'
  );
  const [resolvedResult] = await runSql(
    'SELECT COUNT(*) as count FROM assessment_feedback WHERE issue_resolved = ?',
    ['yes']
  );

  const totalFeedback = totalFeedbackResult?.rows?._array?.[0]?.count ?? 0;
  const helpfulCount = helpfulResult?.rows?._array?.[0]?.count ?? 0;
  const resolvedCount = resolvedResult?.rows?._array?.[0]?.count ?? 0;

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
