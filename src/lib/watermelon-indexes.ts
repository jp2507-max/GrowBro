// SQLiteQuery type is not directly exported, so we define it inline
import { adapter } from '@/lib/watermelon';

type SQLiteQuery = [string, any[]];

let initialized = false;
let initializing: Promise<void> | null = null;

const INDEX_QUERIES: SQLiteQuery[] = [
  [
    'CREATE INDEX IF NOT EXISTS idx_ph_ec_readings_v2_reservoir_measured_at ON ph_ec_readings_v2(reservoir_id, measured_at DESC)',
    [],
  ],
  [
    'CREATE INDEX IF NOT EXISTS idx_ph_ec_readings_v2_plant_measured_at ON ph_ec_readings_v2(plant_id, measured_at DESC)',
    [],
  ],
  [
    'CREATE INDEX IF NOT EXISTS idx_deviation_alerts_v2_reservoir_triggered_at ON deviation_alerts_v2(reservoir_id, triggered_at DESC)',
    [],
  ],
  [
    'CREATE INDEX IF NOT EXISTS idx_diagnostic_results_v2_plant_created_at ON diagnostic_results_v2(plant_id, created_at DESC)',
    [],
  ],
  [
    'CREATE INDEX IF NOT EXISTS idx_diagnostic_results_v2_reservoir_created_at ON diagnostic_results_v2(reservoir_id, created_at DESC)',
    [],
  ],
];

function runUnsafeExecute(
  target: typeof adapter,
  work: { sqls: SQLiteQuery[] }
): Promise<void> {
  return new Promise((resolve, reject) => {
    target.unsafeExecute(work, (result) => {
      if ('error' in result && result.error) {
        reject(result.error);
        return;
      }
      resolve();
    });
  });
}

export async function ensureNutrientEngineIndexes(
  target: typeof adapter = adapter
): Promise<void> {
  if (initialized) return;
  if (INDEX_QUERIES.length === 0) {
    initialized = true;
    return;
  }
  if (initializing) {
    await initializing;
    return;
  }

  initializing = (async () => {
    try {
      if (typeof (target as any).unsafeExecute !== 'function') {
        initialized = true;
        return;
      }

      const initPromise = (target as any).initializingPromise;
      if (initPromise && typeof initPromise.then === 'function') {
        await initPromise;
      }

      await runUnsafeExecute(target, { sqls: INDEX_QUERIES });
      initialized = true;
    } catch (error) {
      console.warn('[watermelon-indexes] Failed to ensure indexes', error);
    } finally {
      initializing = null;
    }
  })();

  await initializing;
}

export function resetNutrientEngineIndexStateForTests(): void {
  initialized = false;
  initializing = null;
}
