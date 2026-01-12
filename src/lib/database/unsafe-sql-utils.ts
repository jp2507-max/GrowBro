import { Q } from '@nozbe/watermelondb';

import { database } from '@/lib/watermelon';

export type SQLiteArg = string | boolean | number | null;
export type SQLiteQuery = [string, SQLiteArg[]];

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
  table: string,
  sql: string,
  params: SQLiteArg[] = []
): Promise<NonNullable<UnsafeExecuteResult['results']>> {
  const rows = await database.read(async () => {
    const collection = database.get(table as never);
    return collection.query(Q.unsafeSqlQuery(sql, params)).unsafeFetchRaw();
  }, `runSql:${table}`);

  return [{ rows: { _array: rows } }];
}
