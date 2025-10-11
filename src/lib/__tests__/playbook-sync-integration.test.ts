/**
 * Playbook Sync Integration Tests
 * Tests offline-first sync with conflict resolution for playbook operations
 */

// Legacy ConflictResolver removed
// import type { ConflictResolver } from '@/lib/sync/conflict-resolver';
// import { createConflictResolver } from '@/lib/sync/conflict-resolver';

// Mock WatermelonDB
jest.mock('@/lib/watermelon', () => ({
  database: {
    write: jest.fn((fn) => fn()),
    get: jest.fn(),
    collections: {
      get: jest.fn(),
    },
  },
}));

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

describe('Playbook Sync Integration', () => {
  // Legacy ConflictResolver removed
  // let conflictResolver: ConflictResolver;

  beforeEach(() => {
    jest.clearAllMocks();
    // conflictResolver = createConflictResolver();
  });

  describe('ConflictResolver', () => {
    it.skip('should get resolution strategy for tasks', () => {
      // Legacy test - ConflictResolver removed
      // const strategy = conflictResolver.getResolutionStrategy('tasks');
      // expect(strategy).toBe('needs-review');
    });

    it.skip('should get resolution strategy for series', () => {
      // Legacy test - ConflictResolver removed
      // const strategy = conflictResolver.getResolutionStrategy('series');
      // expect(strategy).toBe('server-lww');
    });

    it.skip('should mark conflicts for review', async () => {
      // Legacy test - ConflictResolver removed
      // const conflicts = [
      //   {
      //     tableName: 'tasks' as const,
      //     recordId: 'task-1',
      //     localRecord: { title: 'Local' },
      //     remoteRecord: { title: 'Remote' },
      //     conflictFields: ['title'],
      //     timestamp: new Date(),
      //   },
      // ];
      //
      // await expect(
      //   conflictResolver.markForReview(conflicts)
      // ).resolves.not.toThrow();
    });

    it.skip('should log conflicts', () => {
      // Legacy test - conflictResolver removed
      // const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      //
      // conflictResolver.logConflict({
      //   tableName: 'tasks',
      //   recordId: 'task-1',
      //   localRecord: { title: 'Local' },
      //   remoteRecord: { title: 'Remote' },
      //   conflictFields: ['title'],
      //   timestamp: new Date(),
      // });
      //
      // expect(consoleSpy).toHaveBeenCalled();
      //
      // consoleSpy.mockRestore();
    });
  });
});
