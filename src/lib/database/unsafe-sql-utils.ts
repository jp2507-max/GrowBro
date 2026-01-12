import { Q } from '@nozbe/watermelondb';

import { database } from '@/lib/watermelon';

export type SQLiteArg = string | boolean | number | null;
export type SQLiteQuery = [string, SQLiteArg[]];

// Valid table names extracted from watermelon models
const VALID_TABLE_NAMES = new Set([
  'ai_second_opinions_queue',
  'ai_suggestions',
  'assessment_feedback',
  'assessment_requests',
  'assessment_telemetry',
  'assessments',
  'assessment_classes',
  'cached_strains',
  'calibrations',
  'deviation_alerts_v2',
  'device_tokens',
  'diagnostic_results_v2',
  'favorites',
  'feeding_templates',
  'harvest_audits',
  'harvests',
  'help_articles_cache',
  'image_upload_queue',
  'inventory_batches',
  'inventory_items',
  'inventory_movements',
  'inventory',
  'notification_preferences',
  'notification_queue',
  'notifications',
  'occurrence_overrides',
  'outbox_notification_actions',
  'outbox',
  'ph_ec_readings_v2',
  'plants',
  'playbook_applications',
  'playbooks',
  'post_comments',
  'post_likes',
  'posts',
  'profiles',
  'reservoir_events',
  'reservoirs_v2',
  'series',
  'source_water_profiles_v2',
  'support_tickets_queue',
  'tasks',
  'trichome_assessments',
  'undo_descriptors',
]);

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
    const collection = database.get(table as never);
    return collection.query(Q.unsafeSqlQuery(sql, params)).unsafeFetchRaw();
  }, `runSql:${table}`);

  return [{ rows: { _array: rows } }];
}
