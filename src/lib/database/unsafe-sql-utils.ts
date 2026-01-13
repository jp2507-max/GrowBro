import { Q } from '@nozbe/watermelondb';

import { database } from '@/lib/watermelon';
import { appSchema } from '@/lib/watermelon-schema';

export type SQLiteArg = string | boolean | number | null;
export type SQLiteQuery = [string, SQLiteArg[]];

// Valid table names derived from the schema source of truth
const VALID_TABLE_NAMES = new Set(
  Object.values(appSchema.tables).map((t) => t.name)
);

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
  if (!VALID_TABLE_NAMES.has(table)) {
    throw new Error(
      `runSql: Unknown table "${table}". Valid tables are: ${Array.from(VALID_TABLE_NAMES).sort().join(', ')}`
    );
  }

  const rows = await database.read(async () => {
    // We cast to never because `database.get(table)` expects strict TableName types,
    // but this utility is designed for dynamic table access.
    // Safety is guaranteed by the runtime check `VALID_TABLE_NAMES.has(table)` above.
    const collection = database.get(table as never);
    return collection.query(Q.unsafeSqlQuery(sql, params)).unsafeFetchRaw();
  }, `runSql:${table}`);

  return [{ rows: { _array: rows } }];
}
