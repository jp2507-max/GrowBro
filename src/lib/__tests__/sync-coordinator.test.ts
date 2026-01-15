type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function waitUntil(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 50; i += 1) {
    if (condition()) return;
    await Promise.resolve();
  }
  throw new Error('Timed out waiting for condition');
}

describe('SyncCoordinator.performSync', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('keeps a single pending worker and does not schedule extra empty syncs', async () => {
    const deferredRuns: Deferred<any>[] = [];

    const runSyncWithRetry = jest.fn((_maxRetries: number, _opts: any) => {
      const deferred = createDeferred<any>();
      deferredRuns.push(deferred);
      return deferred.promise;
    });

    jest.doMock('@/lib/sync-engine', () => ({
      getPendingChangesCount: jest.fn().mockResolvedValue(0),
      runSyncWithRetry,
    }));

    jest.doMock('@/lib/analytics', () => ({
      NoopAnalytics: {
        track: jest.fn().mockResolvedValue(undefined),
      },
    }));

    jest.doMock('@/lib/storage', () => ({
      getItem: jest.fn().mockReturnValue(undefined),
    }));

    jest.doMock('@/lib/sync/sync-analytics', () => ({
      trackCheckpointAge: jest.fn().mockResolvedValue(undefined),
      trackPendingChanges: jest.fn().mockResolvedValue(undefined),
      trackSyncFailure: jest.fn().mockResolvedValue(undefined),
      trackSyncLatency: jest.fn().mockResolvedValue(undefined),
      trackSyncSuccess: jest.fn().mockResolvedValue(undefined),
    }));

    jest.doMock('@/lib/sync/sync-errors', () => ({
      categorizeSyncError: jest.fn(() => ({ code: 'unknown', message: '' })),
    }));

    jest.doMock('@/lib/uploads/queue', () => ({
      processImageQueueOnce: jest.fn().mockResolvedValue({ processed: 0 }),
    }));

    jest.doMock('@/lib/plants/plant-photo-sync', () => ({
      syncMissingPlantPhotos: jest
        .fn()
        .mockResolvedValue({ downloaded: 0, failed: 0 }),
    }));

    jest.doMock('@/lib/watermelon', () => ({
      database: {
        collections: {
          get: jest.fn(() => ({
            query: jest.fn(() => ({
              fetch: jest.fn(async () => []),
            })),
          })),
        },
      },
    }));

    jest.doMock('@/lib/plants/plants-sync', () => ({
      syncPlantsBidirectional: jest.fn().mockResolvedValue(undefined),
    }));

    const { performSync } = require('@/lib/sync/sync-coordinator');

    const p1 = performSync({
      withRetry: false,
      trackAnalytics: false,
      trigger: 'auto',
    });
    await waitUntil(() => runSyncWithRetry.mock.calls.length === 1);

    const p2 = performSync({
      withRetry: false,
      trackAnalytics: false,
      trigger: 'manual',
    });

    deferredRuns[0]?.resolve({ pushed: 0, applied: 0, serverTimestamp: null });
    await waitUntil(() => runSyncWithRetry.mock.calls.length === 2);

    const p3 = performSync({
      withRetry: false,
      trackAnalytics: false,
      trigger: 'diagnostic',
    });

    deferredRuns[1]?.resolve({ pushed: 0, applied: 0, serverTimestamp: null });
    await waitUntil(() => runSyncWithRetry.mock.calls.length === 3);

    deferredRuns[2]?.resolve({ pushed: 0, applied: 0, serverTimestamp: null });

    await expect(p1).resolves.toMatchObject({ pushed: 0, applied: 0 });
    await expect(p2).resolves.toMatchObject({ pushed: 0, applied: 0 });
    await expect(p3).resolves.toMatchObject({ pushed: 0, applied: 0 });
    expect(runSyncWithRetry).toHaveBeenCalledTimes(3);

    const triggers = runSyncWithRetry.mock.calls.map((call) => call[1].trigger);
    expect(triggers).toEqual(['auto', 'manual', 'diagnostic']);
  });
});
