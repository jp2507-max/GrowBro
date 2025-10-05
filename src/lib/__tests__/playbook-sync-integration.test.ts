/**
 * Playbook Sync Integration Tests
 * Tests offline-first sync with conflict resolution for playbook operations
 */

import type { ConflictResolver } from '@/lib/sync/conflict-resolver';
import { createConflictResolver } from '@/lib/sync/conflict-resolver';

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
  let conflictResolver: ConflictResolver;

  beforeEach(() => {
    jest.clearAllMocks();
    conflictResolver = createConflictResolver();
  });

  describe('ConflictResolver', () => {
    it('should get resolution strategy for tasks', () => {
      const strategy = conflictResolver.getResolutionStrategy('tasks');
      expect(strategy).toBe('needs-review');
    });

    it('should get resolution strategy for series', () => {
      const strategy = conflictResolver.getResolutionStrategy('series');
      expect(strategy).toBe('server-lww');
    });

    it('should mark conflicts for review', async () => {
      const conflicts = [
        {
          tableName: 'tasks' as const,
          recordId: 'task-1',
          localRecord: { title: 'Local' },
          remoteRecord: { title: 'Remote' },
          conflictFields: ['title'],
          timestamp: new Date(),
        },
      ];

      await expect(
        conflictResolver.markForReview(conflicts)
      ).resolves.not.toThrow();
    });

    it('should log conflicts', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      conflictResolver.logConflict({
        tableName: 'tasks',
        recordId: 'task-1',
        localRecord: { title: 'Local' },
        remoteRecord: { title: 'Remote' },
        conflictFields: ['title'],
        timestamp: new Date(),
      });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
