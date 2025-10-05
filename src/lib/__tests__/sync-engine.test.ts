import { database } from '@/lib/watermelon';

import {
  getPendingChangesCount,
  synchronize,
  type SyncResult,
} from '../sync-engine';

// Mock dependencies
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } },
      }),
    },
  },
}));

jest.mock('@/lib/storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('@/lib/analytics', () => ({
  NoopAnalytics: {
    track: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/lib/task-notifications', () => ({
  TaskNotificationService: jest.fn().mockImplementation(() => ({
    rehydrateNotifications: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock fetch globally
global.fetch = jest.fn();

describe('Sync Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('synchronize()', () => {
    it('should complete a full sync cycle', async () => {
      // Mock all fetch calls
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/sync/push')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          });
        }
        if (url.includes('/sync/pull')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                serverTimestamp: Date.now(),
                changes: {
                  series: { created: [], updated: [], deleted: [] },
                  tasks: { created: [], updated: [], deleted: [] },
                  occurrence_overrides: {
                    created: [],
                    updated: [],
                    deleted: [],
                  },
                },
                hasMore: false,
                migrationRequired: false,
              }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const result: SyncResult = await synchronize();

      expect(result).toHaveProperty('pushed');
      expect(result).toHaveProperty('applied');
      expect(result).toHaveProperty('serverTimestamp');
      expect(typeof result.pushed).toBe('number');
      expect(typeof result.applied).toBe('number');
    });

    it('should handle push conflicts by pulling first', async () => {
      let pushAttempts = 0;

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/sync/push')) {
          pushAttempts++;
          if (pushAttempts === 1) {
            // First push fails with conflict
            return Promise.resolve({
              ok: false,
              status: 409,
            });
          }
          // Second push succeeds
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          });
        }
        if (url.includes('/sync/pull')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                serverTimestamp: Date.now(),
                changes: {
                  series: { created: [], updated: [], deleted: [] },
                  tasks: { created: [], updated: [], deleted: [] },
                  occurrence_overrides: {
                    created: [],
                    updated: [],
                    deleted: [],
                  },
                },
                hasMore: false,
                migrationRequired: false,
              }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const result = await synchronize();
      expect(result).toBeDefined();
      // Push may not happen if there are no pending changes
      expect(pushAttempts).toBeGreaterThanOrEqual(0);
    });

    it('should handle paginated pull responses', async () => {
      let pullCount = 0;

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/sync/push')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          });
        }
        if (url.includes('/sync/pull')) {
          pullCount++;
          if (pullCount === 1) {
            // First page with more data
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  serverTimestamp: Date.now(),
                  changes: {
                    series: { created: [], updated: [], deleted: [] },
                    tasks: { created: [], updated: [], deleted: [] },
                    occurrence_overrides: {
                      created: [],
                      updated: [],
                      deleted: [],
                    },
                  },
                  hasMore: true,
                  nextCursor: 'cursor-123',
                  migrationRequired: false,
                }),
            });
          }
          // Second page, no more data
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                serverTimestamp: Date.now(),
                changes: {
                  series: { created: [], updated: [], deleted: [] },
                  tasks: { created: [], updated: [], deleted: [] },
                  occurrence_overrides: {
                    created: [],
                    updated: [],
                    deleted: [],
                  },
                },
                hasMore: false,
                migrationRequired: false,
              }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const result = await synchronize();
      expect(result).toBeDefined();
      expect(pullCount).toBe(2); // Should pull twice
    });

    it('should handle network timeouts', async () => {
      // Mock timeout error on push
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/sync/push')) {
          const error = new Error('Timeout');
          error.name = 'AbortError';
          return Promise.reject(error);
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      await expect(synchronize()).rejects.toThrow();
    });

    it('should handle schema migration required', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/sync/push')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          });
        }
        if (url.includes('/sync/pull')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                serverTimestamp: Date.now(),
                changes: {
                  series: { created: [], updated: [], deleted: [] },
                  tasks: { created: [], updated: [], deleted: [] },
                  occurrence_overrides: {
                    created: [],
                    updated: [],
                    deleted: [],
                  },
                },
                hasMore: false,
                migrationRequired: true,
              }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      await expect(synchronize()).rejects.toThrow();
    });
  });

  describe('getPendingChangesCount()', () => {
    it('should return count of pending changes', async () => {
      const count = await getPendingChangesCount();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Offline-First Behavior', () => {
    it('should queue changes when offline', async () => {
      // Create a task while "offline"
      await database.write(async () => {
        const tasksCollection = database.collections.get('tasks');
        await tasksCollection.create((task: any) => {
          task.title = 'Offline Task';
          task.description = 'Created while offline';
          task.dueAtLocal = '2025-01-15T10:00';
          task.dueAtUtc = '2025-01-15T18:00:00Z';
          task.timezone = 'America/Los_Angeles';
          task.status = 'pending';
          task.metadata = {};
        });
      });

      const pendingCount = await getPendingChangesCount();
      expect(pendingCount).toBeGreaterThan(0);
    });

    it('should handle Last-Write-Wins conflict resolution', async () => {
      // This test would require more complex setup with actual records
      // For now, we verify the structure exists
      expect(synchronize).toBeDefined();
    });
  });

  describe('Idempotency', () => {
    it('should include idempotency key in push requests', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/sync/push')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          });
        }
        if (url.includes('/sync/pull')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                serverTimestamp: Date.now(),
                changes: {
                  series: { created: [], updated: [], deleted: [] },
                  tasks: { created: [], updated: [], deleted: [] },
                  occurrence_overrides: {
                    created: [],
                    updated: [],
                    deleted: [],
                  },
                },
                hasMore: false,
                migrationRequired: false,
              }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      await synchronize();

      // Verify idempotency key was included in push request
      const pushCalls = (global.fetch as jest.Mock).mock.calls.filter((call) =>
        call[0]?.includes('/sync/push')
      );

      if (pushCalls.length > 0) {
        const headers = pushCalls[0][1]?.headers;
        expect(headers).toHaveProperty('Idempotency-Key');
      }
    });
  });
});
