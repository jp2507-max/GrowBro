import type {
  default as SQLiteAdapter,
  SQLiteQuery,
} from '@nozbe/watermelondb/adapters/sqlite';

import {
  ensureNutrientEngineIndexes,
  resetNutrientEngineIndexStateForTests,
} from '@/lib/watermelon-indexes';

type MockResult = { error?: Error };
type WatermelonAdapter = SQLiteAdapter;

describe('ensureNutrientEngineIndexes', () => {
  afterEach(() => {
    resetNutrientEngineIndexStateForTests();
  });

  test('executes composite index statements once', async () => {
    const unsafeExecute = jest.fn(
      (
        operations: { sqls: SQLiteQuery[] },
        callback: (result: MockResult) => void
      ) => {
        callback({});
      }
    );

    const adapterMock = {
      unsafeExecute,
      initializingPromise: Promise.resolve(),
    } as const;

    await ensureNutrientEngineIndexes(
      adapterMock as unknown as WatermelonAdapter
    );
    await ensureNutrientEngineIndexes(
      adapterMock as unknown as WatermelonAdapter
    );

    expect(unsafeExecute).toHaveBeenCalledTimes(1);
    const [operations] = unsafeExecute.mock.calls[0];
    expect(Array.isArray(operations.sqls)).toBe(true);
    expect(operations.sqls).toEqual(
      expect.arrayContaining([
        [
          'CREATE INDEX IF NOT EXISTS idx_ph_ec_readings_v2_reservoir_measured_at ON ph_ec_readings_v2(reservoir_id, measured_at DESC)',
          [],
        ],
        [
          'CREATE INDEX IF NOT EXISTS idx_ph_ec_readings_v2_plant_measured_at ON ph_ec_readings_v2(plant_id, measured_at DESC)',
          [],
        ],
        [
          'CREATE INDEX IF NOT EXISTS idx_deviation_alerts_v2_reading_triggered_at ON deviation_alerts_v2(reading_id, triggered_at DESC)',
          [],
        ],
      ])
    );
  });

  test('resolves when adapter lacks unsafeExecute (mocked env)', async () => {
    const adapterMock = {
      initializingPromise: Promise.resolve(),
    } as const;

    await expect(
      ensureNutrientEngineIndexes(adapterMock as unknown as WatermelonAdapter)
    ).resolves.toBeUndefined();
  });
});
