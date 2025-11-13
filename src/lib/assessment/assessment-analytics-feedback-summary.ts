import { database } from '@/lib/watermelon';

// SQLiteQuery type is not directly exported, so we define it inline
type SQLiteQuery = [string, unknown[]];

type UnsafeExecuteResult = {
  error?: unknown;
  results?: {
    rows?: {
      _array?: Record<string, unknown>[];
    };
  }[];
};

type DatabaseAdapterWithUnsafe = {
  unsafeExecute?: (
    work: { sqls: SQLiteQuery[] },
    callback: (result: UnsafeExecuteResult) => void
  ) => void;
};

// Helper to run a single SQL via the adapter. The adapter exposes
// `unsafeExecute(work, cb)` which is callback-based; wrap it in a Promise
// and return the results array (matching the previous unsafeExecuteSql shape).
async function runSql(
  sql: string,
  params: unknown[] = []
): Promise<NonNullable<UnsafeExecuteResult['results']>> {
  // Verify adapter supports unsafeExecute at runtime
  if (typeof database.adapter?.unsafeExecute !== 'function') {
    throw new Error('Database adapter does not support unsafeExecute method');
  }

  const work = { sqls: [[sql, params]] as SQLiteQuery[] };

  // Wrap the callback-based unsafeExecute in a Promise
  return new Promise((resolve, reject) => {
    (database.adapter as DatabaseAdapterWithUnsafe).unsafeExecute!(
      work,
      (result) => {
        // adapter is dynamically typed and unsafeExecute is not on the declared type
        if (result?.error) {
          console.error('Database adapter error:', result.error);
          reject(
            new Error('Failed to execute SQL query', { cause: result.error })
          );
          return;
        }
        resolve(result?.results || []);
      }
    );
  });
}

export async function getFeedbackMetrics(): Promise<{
  helpfulnessRate: number;
  resolutionRate: number;
}> {
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
