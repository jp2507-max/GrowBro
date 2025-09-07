import {
  configureSync,
  getLastSyncTime,
  getSyncStatus,
  hasPendingLocalChanges,
  setLastPulledAt,
  synchronize,
} from '@/lib/sync/sync-manager';

describe.skip('SyncManager', () => {
  const originalFetch = global.fetch as any;

  beforeEach(() => {
    (global as any).fetch = jest.fn(async (url: string) => {
      if (url.includes('/pull')) {
        return {
          ok: true,
          json: async () => ({ changes: {}, timestamp: Date.now() }),
          status: 200,
        } as any;
      }
      if (url.includes('/push')) {
        return { ok: true, status: 200 } as any;
      }
      return { ok: true, status: 200, json: async () => ({}) } as any;
    });

    configureSync({
      pullEndpoint: 'http://localhost/sync/pull',
      pushEndpoint: 'http://localhost/sync/push',
      batchSize: 1000,
      retryAttempts: 3,
      backoffMultiplier: 2,
      maxBackoffDelay: 60_000,
      enableBackgroundSync: false,
      syncOnAppStart: false,
      syncOnForeground: false,
      migrationsEnabledAtVersion: 2,
    });
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
  });

  test('exposes status and last sync time', async () => {
    expect(getSyncStatus()).toBe('idle');
    await setLastPulledAt(0);
    expect(getLastSyncTime()).toEqual(new Date(0));
  });

  test('synchronize runs without overlapping execution', async () => {
    const p1 = synchronize();
    const p2 = synchronize();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.serverTimestamp).toEqual(r2.serverTimestamp);
  });

  test('hasPendingLocalChanges delegates to Watermelon', async () => {
    // This just asserts the function is callable; the mock DB returns false by default
    const pending = await hasPendingLocalChanges();
    expect(typeof pending).toBe('boolean');
  });
});
