import { jest } from '@jest/globals';

import { runSyncWithRetry } from '@/lib/sync-engine';

describe('sync conflicts', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    (global as any).fetch = undefined as any;
  });

  test('handles 409 on push by pulling then retrying', async () => {
    const originalFetch = global.fetch as any;
    let step = 0;
    (global as any).fetch = jest.fn(async (url: string) => {
      // First call push -> 409, then pull ok, then push ok, then pull ok
      if (url.includes('/sync/push')) {
        step++;
        if (step === 1) return { ok: false, status: 409 } as any;
        return { ok: true, status: 200, json: async () => ({}) } as any;
      }
      if (url.includes('/sync/pull')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            serverTimestamp: Date.now(),
            hasMore: false,
            migrationRequired: false,
            changes: {
              tasks: { created: [], updated: [], deleted: [] },
              series: { created: [], updated: [], deleted: [] },
              occurrence_overrides: { created: [], updated: [], deleted: [] },
            },
          }),
        } as any;
      }
      return { ok: true, status: 200, json: async () => ({}) } as any;
    });

    const res = await runSyncWithRetry(1);
    expect(res.serverTimestamp).not.toBeNull();
    (global as any).fetch = originalFetch;
  });
});
