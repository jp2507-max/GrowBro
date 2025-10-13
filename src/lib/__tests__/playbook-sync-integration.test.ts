/**
 * Playbook Sync Integration Tests
 * Tests offline-first sync with conflict resolution for playbook operations
 */

import { resolveConflict } from '@/lib/sync/conflict-resolver';
import type { ConflictResolution } from '@/lib/sync/types';

// Mock records simulating offline-first sync scenarios
type MockRecord = {
  id: string;
  title?: string;
  description?: string;
  server_revision?: number;
  server_updated_at_ms?: number;
  updated_at?: number;
};

describe('Playbook Sync Integration', () => {
  describe('Conflict Resolution in Offline-First Sync', () => {
    describe('resolveConflict - Server Revision Priority', () => {
      it('should resolve remote win when remote has higher revision', () => {
        const local: MockRecord = {
          id: 'task-1',
          title: 'Local Edit',
          description: 'Edited offline',
          server_revision: 5,
          updated_at: Date.now(),
        };

        const remote: MockRecord = {
          id: 'task-1',
          title: 'Server Edit',
          description: 'Edited on server',
          server_revision: 10,
          server_updated_at_ms: Date.now() + 1000,
        };

        const result: ConflictResolution = resolveConflict(local, remote);

        expect(result.winner).toBe('remote');
        expect(result.localRevision).toBe(5);
        expect(result.remoteRevision).toBe(10);
        expect(result.reason).toContain('Server revision higher (remote wins)');
      });

      it('should resolve local win when local has higher revision', () => {
        const local: MockRecord = {
          id: 'task-1',
          title: 'Local Edit',
          server_revision: 15,
          updated_at: Date.now(),
        };

        const remote: MockRecord = {
          id: 'task-1',
          title: 'Server Edit',
          server_revision: 10,
          server_updated_at_ms: Date.now() - 1000,
        };

        const result: ConflictResolution = resolveConflict(local, remote);

        expect(result.winner).toBe('local');
        expect(result.localRevision).toBe(15);
        expect(result.remoteRevision).toBe(10);
        expect(result.reason).toContain('Local revision higher (local wins)');
      });

      it('should default to remote win when revisions are equal', () => {
        const local: MockRecord = {
          id: 'task-1',
          title: 'Local Change',
          server_revision: 10,
        };

        const remote: MockRecord = {
          id: 'task-1',
          title: 'Remote Change',
          server_revision: 10,
        };

        const result: ConflictResolution = resolveConflict(local, remote);

        expect(result.winner).toBe('remote');
        expect(result.reason).toContain(
          'Server revisions equal (remote wins by default)'
        );
      });
    });

    describe('resolveByTimestamp - Fallback Strategy', () => {
      it('should resolve remote win when remote timestamp is newer', () => {
        const local: MockRecord = {
          id: 'task-1',
          title: 'Local Edit',
          server_updated_at_ms: 1000000,
        };

        const remote: MockRecord = {
          id: 'task-1',
          title: 'Server Edit',
          server_updated_at_ms: 2000000,
        };

        const result: ConflictResolution = resolveConflict(local, remote);

        expect(result.winner).toBe('remote');
        expect(result.localTimestamp).toBe(1000000);
        expect(result.remoteTimestamp).toBe(2000000);
        expect(result.reason).toContain('Server timestamp newer (remote wins)');
      });

      it('should resolve local win when local timestamp is newer', () => {
        const local: MockRecord = {
          id: 'task-1',
          title: 'Local Edit',
          server_updated_at_ms: 3000000,
        };

        const remote: MockRecord = {
          id: 'task-1',
          title: 'Server Edit',
          server_updated_at_ms: 2000000,
        };

        const result: ConflictResolution = resolveConflict(local, remote);

        expect(result.winner).toBe('local');
        expect(result.localTimestamp).toBe(3000000);
        expect(result.remoteTimestamp).toBe(2000000);
        expect(result.reason).toContain('Server timestamp newer (local wins)');
      });

      it('should resolve remote win when only remote has server timestamp', () => {
        const local: MockRecord = {
          id: 'task-1',
          title: 'Local Edit',
          updated_at: 1000000, // Client timestamp
        };

        const remote: MockRecord = {
          id: 'task-1',
          title: 'Server Edit',
          server_updated_at_ms: 2000000, // Server timestamp
        };

        const result: ConflictResolution = resolveConflict(local, remote);

        expect(result.winner).toBe('remote');
        expect(result.reason).toContain('Only remote has server timestamp');
      });

      it('should default to remote win when timestamps are equal', () => {
        const local: MockRecord = {
          id: 'task-1',
          title: 'Local Change',
          server_updated_at_ms: 2000000,
        };

        const remote: MockRecord = {
          id: 'task-1',
          title: 'Remote Change',
          server_updated_at_ms: 2000000,
        };

        const result: ConflictResolution = resolveConflict(local, remote);

        expect(result.winner).toBe('remote');
        expect(result.reason).toContain(
          'Server timestamps equal (remote wins by default)'
        );
      });
    });

    describe('Mixed-Field Conflicts', () => {
      it('should handle conflicts with multiple changed fields', () => {
        const local: MockRecord = {
          id: 'task-1',
          title: 'Local Title Change',
          description: 'Local Description Change',
          server_revision: 8,
        };

        const remote: MockRecord = {
          id: 'task-1',
          title: 'Remote Title Change',
          description: 'Remote Description Change',
          server_revision: 12,
        };

        const result: ConflictResolution = resolveConflict(local, remote);

        expect(result.winner).toBe('remote');
        expect(result.localRevision).toBe(8);
        expect(result.remoteRevision).toBe(12);
        // The resolver doesn't track specific fields, just the winner
      });

      it('should prefer revision over timestamp when both are available', () => {
        const local: MockRecord = {
          id: 'task-1',
          title: 'Local Change',
          server_revision: 15,
          server_updated_at_ms: 1000000, // Older timestamp
        };

        const remote: MockRecord = {
          id: 'task-1',
          title: 'Remote Change',
          server_revision: 10,
          server_updated_at_ms: 2000000, // Newer timestamp
        };

        const result: ConflictResolution = resolveConflict(local, remote);

        // Should use revision strategy, not timestamp
        expect(result.winner).toBe('local');
        expect(result.localRevision).toBe(15);
        expect(result.remoteRevision).toBe(10);
        expect(result.reason).toContain('revision');
        expect(result.reason).not.toContain('timestamp');
      });
    });

    describe('Offline-First Scenarios', () => {
      it('should handle local-only edits (no server metadata)', () => {
        const local: MockRecord = {
          id: 'task-1',
          title: 'Created Offline',
          updated_at: Date.now(),
        };

        const remote: MockRecord = {
          id: 'task-1',
          title: 'Server Version',
          // No server metadata at all
        };

        const result: ConflictResolution = resolveConflict(local, remote);

        expect(result.winner).toBe('remote');
        expect(result.reason).toContain(
          'No server revision/timestamp available'
        );
      });

      it('should handle concurrent offline edits with different fields', () => {
        const local: MockRecord = {
          id: 'task-1',
          title: 'Updated Title Offline',
          server_revision: 5,
        };

        const remote: MockRecord = {
          id: 'task-1',
          description: 'Updated Description Online',
          server_revision: 6,
        };

        const result: ConflictResolution = resolveConflict(local, remote);

        expect(result.winner).toBe('remote');
        expect(result.localRevision).toBe(5);
        expect(result.remoteRevision).toBe(6);
      });

      it('should handle race conditions with similar timestamps', () => {
        const baseTime = Date.now();
        const local: MockRecord = {
          id: 'task-1',
          title: 'Local Edit',
          server_updated_at_ms: baseTime + 100,
        };

        const remote: MockRecord = {
          id: 'task-1',
          title: 'Remote Edit',
          server_updated_at_ms: baseTime + 200,
        };

        const result: ConflictResolution = resolveConflict(local, remote);

        expect(result.winner).toBe('remote');
        expect(result.localTimestamp).toBe(baseTime + 100);
        expect(result.remoteTimestamp).toBe(baseTime + 200);
      });
    });
  });
});
