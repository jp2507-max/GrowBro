import { database } from '@/lib/watermelon';

export type SQLiteQuery = [string, unknown[]];

export type UnsafeExecuteResult = {
  error?: unknown;
  results?: {
    rows?: {
      _array?: Record<string, unknown>[];
    };
  }[];
};

export type DatabaseAdapterWithUnsafe = {
  unsafeExecute?: (
    work: { sqls: SQLiteQuery[] },
    callback: (result: UnsafeExecuteResult) => void
  ) => void;
};

export async function runSql(
  sql: string,
  params: unknown[] = []
): Promise<NonNullable<UnsafeExecuteResult['results']>> {
  if (typeof database.adapter?.unsafeExecute !== 'function') {
    throw new Error('Database adapter does not support unsafeExecute method');
  }

  const work = { sqls: [[sql, params]] as SQLiteQuery[] };

  return new Promise((resolve, reject) => {
    (database.adapter as DatabaseAdapterWithUnsafe).unsafeExecute!(
      work,
      (result) => {
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
