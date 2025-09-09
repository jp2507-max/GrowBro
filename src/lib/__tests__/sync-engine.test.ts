import { jest } from '@jest/globals';

import * as Backoff from '@/lib/sync/backoff';
import { computeBackoffMs } from '@/lib/sync/backoff';
import {
  diffServerChangedTaskIds,
  runSyncWithRetry,
  type SyncResponse,
} from '@/lib/sync-engine';

describe('sync-engine', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    (global as any).fetch = undefined as any;
  });

  test('diffServerChangedTaskIds returns unique ids from created/updated/deleted', () => {
    const resp: SyncResponse = {
      serverTimestamp: Date.now(),
      hasMore: false,
      migrationRequired: false,
      changes: {
        tasks: {
          created: [{ id: 'a' } as any],
          updated: [{ id: 'b' } as any, { id: 'a' } as any],
          deleted: [{ id: 'c', deleted_at: new Date().toISOString() }],
        },
        series: { created: [], updated: [], deleted: [] },
        occurrence_overrides: { created: [], updated: [], deleted: [] },
      },
    };
    const ids = diffServerChangedTaskIds(resp);
    expect(ids.sort()).toEqual(['a', 'b', 'c'].sort());
  });

  test('runSyncWithRetry retries with exponential backoff on retryable errors', async () => {
    // Mock backoff to 1ms to speed up test execution and avoid flaky timing dependencies
    // This tests retry logic without waiting for actual exponential backoff delays
    jest
      .spyOn(Backoff, 'computeBackoffMs')
      .mockImplementation((_attempt, _base, _max) => 1); // minimize delays

    const originalFetch = global.fetch as any;
    // First 2 attempts fail pull with 500, third succeeds
    let call = 0;
    (global as any).fetch = jest.fn(async () => {
      call++;
      // Pull endpoint is called after push in our pipeline, so any call is fine here
      if (call < 3) {
        return { ok: false, status: 500, json: async () => ({}) } as any;
      }
      return {
        ok: true,
        json: async () =>
          ({
            serverTimestamp: Date.now(),
            hasMore: false,
            migrationRequired: false,
            changes: {
              tasks: { created: [], updated: [], deleted: [] },
              series: { created: [], updated: [], deleted: [] },
              occurrence_overrides: { created: [], updated: [], deleted: [] },
            },
          }) as SyncResponse,
        status: 200,
      } as any;
    });

    const result = await runSyncWithRetry(3);
    expect(result.serverTimestamp).not.toBeNull();
    (global as any).fetch = originalFetch;
  });
});

describe('sync-engine pagination', () => {
  afterEach(() => {
    (global as any).fetch = undefined as any;
  });

  test('pull paginates while hasMore is true', async () => {
    const now = Date.now();
    const page1 = {
      serverTimestamp: now,
      hasMore: true,
      migrationRequired: false,
      nextCursor: {
        server_ts_ms: now,
        tasks: { active: { ts_ms: now, id: 'a' } },
      },
      changes: {
        tasks: {
          created: [],
          updated: [
            { id: 't1', server_revision: 2, server_updated_at_ms: now },
          ],
          deleted: [],
        },
        series: { created: [], updated: [], deleted: [] },
        occurrence_overrides: { created: [], updated: [], deleted: [] },
      },
    } as any;
    const page2 = {
      serverTimestamp: now,
      hasMore: false,
      migrationRequired: false,
      changes: {
        tasks: {
          created: [],
          updated: [
            { id: 't2', server_revision: 3, server_updated_at_ms: now },
          ],
          deleted: [],
        },
        series: { created: [], updated: [], deleted: [] },
        occurrence_overrides: { created: [], updated: [], deleted: [] },
      },
    } as any;

    let call = 0;
    (global as any).fetch = jest.fn(async () => {
      call++;
      if (call === 1)
        return { ok: true, json: async () => page1, status: 200 } as any;
      return { ok: true, json: async () => page2, status: 200 } as any;
    });

    const res = await runSyncWithRetry(1);
    expect(res.serverTimestamp).toBe(now);
  });
});

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
    // Mock Math.random to make test deterministic and avoid flakiness from jitter
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

    const v0 = computeBackoffMs(0, 100, 1000);
    const v1 = computeBackoffMs(1, 100, 1000);
    const v2 = computeBackoffMs(2, 100, 1000);

    expect(v1).toBeGreaterThanOrEqual(v0);
    expect(v2).toBeGreaterThanOrEqual(v1);

    randomSpy.mockRestore();
  });
});
