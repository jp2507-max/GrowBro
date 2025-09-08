import { diffServerChangedTaskIds, type SyncResponse } from '@/lib/sync-engine';

// Lightweight perf-oriented test stub to validate large change sets handling
describe('sync performance stubs', () => {
  test('diffServerChangedTaskIds handles 10k changes quickly', () => {
    const count = 10_000;
    const ids = Array.from({ length: count }, (_, i) => ({ id: `t${i}` }));
    const resp: SyncResponse = {
      serverTimestamp: Date.now(),
      hasMore: false,
      migrationRequired: false,
      changes: {
        tasks: {
          created: ids.slice(0, 4000) as any,
          updated: ids.slice(4000, 8000) as any,
          deleted: ids
            .slice(8000)
            .map((x) => ({ id: x.id, deleted_at: new Date().toISOString() })),
        },
        series: { created: [], updated: [], deleted: [] },
        occurrence_overrides: { created: [], updated: [], deleted: [] },
      },
    };
    const start = Date.now();
    const out = diffServerChangedTaskIds(resp);
    const elapsed = Date.now() - start;
    expect(out.length).toBe(count);
    // Just a sanity upper bound; environment-specific
    // Skip timing assertion in CI or increase threshold significantly to avoid flakes
    if (!process.env.CI) {
      expect(elapsed).toBeLessThan(500);
    } else {
      expect(elapsed).toBeLessThan(15000);
    }
  });
});
