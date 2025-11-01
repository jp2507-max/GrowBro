import { database } from '@/lib/watermelon';

import { getFeedbackMetrics } from './assessment-analytics-feedback-summary';

// SQLiteQuery type is not directly exported, so we define it inline
type SQLiteQuery = [string, any[]];

// Helper to run a single SQL via the adapter. The adapter exposes
// `unsafeExecute(work, cb)` which is callback-based; wrap it in a Promise
// and return the results array (matching the previous unsafeExecuteSql shape).
async function runSql(sql: string, params: any[] = []): Promise<any[]> {
  // Verify adapter supports unsafeExecute at runtime
  if (typeof database.adapter?.unsafeExecute !== 'function') {
    throw new Error('Database adapter does not support unsafeExecute method');
  }

  const work = { sqls: [[sql, params]] as SQLiteQuery[] };

  // Wrap the callback-based unsafeExecute in a Promise
  return new Promise((resolve, reject) => {
    (database.adapter as any).unsafeExecute(work, (result: any) => {
      // adapter is dynamically typed and unsafeExecute is not on the declared type
      if (result?.error) {
        console.error('Database adapter error:', result.error);
        reject(
          new Error('Failed to execute SQL query', { cause: result.error })
        );
        return;
      }
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
