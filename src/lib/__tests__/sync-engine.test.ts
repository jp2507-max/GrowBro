import { computeBackoffMs, diffServerChangedTaskIds } from '@/lib/sync-engine';

describe('sync-engine helpers', () => {
  test('diffServerChangedTaskIds collects ids from created/updated/deleted', () => {
    const resp: any = {
      serverTimestamp: Date.now(),
      hasMore: false,
      migrationRequired: false,
      changes: {
        series: { created: [], updated: [], deleted: [] },
        tasks: {
          created: [{ id: 'a' }],
          updated: [{ id: 'b' }],
          deleted: [{ id: 'c', deleted_at: new Date().toISOString() }],
        },
        occurrence_overrides: { created: [], updated: [], deleted: [] },
      },
    };
    expect(diffServerChangedTaskIds(resp).sort()).toEqual(['a', 'b', 'c']);
  });

  test('computeBackoffMs grows exponentially with jitter', () => {
    const v0 = computeBackoffMs(0, 100, 1000);
    const v1 = computeBackoffMs(1, 100, 1000);
    const v2 = computeBackoffMs(2, 100, 1000);
    expect(v1).toBeGreaterThanOrEqual(v0);
    expect(v2).toBeGreaterThanOrEqual(v1);
  });
});
