/**
 * Conflict Resolver Tests
 * Tests the new conflict resolution API with table-specific strategies
 */

import {
  getResolutionStrategy,
  resolveByRevision,
  resolveByTimestamp,
  resolveConflict,
} from '@/lib/sync/conflict-resolver';
import { TABLE_NAMES } from '@/lib/sync/types';

describe('getResolutionStrategy', () => {
  test('returns needs-review for tasks table', () => {
    expect(getResolutionStrategy(TABLE_NAMES.TASKS)).toBe('needs-review');
  });

  test('returns server-lww for other tables', () => {
    expect(getResolutionStrategy(TABLE_NAMES.SERIES)).toBe('server-lww');
    expect(getResolutionStrategy(TABLE_NAMES.OCCURRENCE_OVERRIDES)).toBe(
      'server-lww'
    );
    expect(getResolutionStrategy(TABLE_NAMES.NOTIFICATIONS)).toBe('server-lww');
    expect(getResolutionStrategy(TABLE_NAMES.HARVESTS)).toBe('server-lww');
  });
});

describe('resolveConflict', () => {
  describe('table-specific strategy differences', () => {
    test('tasks table uses needs-review strategy', () => {
      const local = { id: '1', server_revision: 5 };
      const remote = { id: '1', server_revision: 10 };

      const result = resolveConflict(local, remote, TABLE_NAMES.TASKS);

      expect(result.winner).toBe('needs-review');
      expect(result.reason).toContain('requires manual review');
    });

    test('non-task tables use server-lww strategy', () => {
      const local = { id: '1', server_revision: 5 };
      const remote = { id: '1', server_revision: 10 };

      const result = resolveConflict(local, remote, TABLE_NAMES.SERIES);

      expect(result.winner).toBe('remote');
      expect(result.reason).toContain('Server revision higher');
    });
  });

  describe('resolution by revision precedence', () => {
    test('chooses remote when remote revision is higher', () => {
      const local = { id: '1', server_revision: 5 };
      const remote = { id: '1', server_revision: 10 };

      const result = resolveConflict(local, remote, TABLE_NAMES.SERIES);

      expect(result.winner).toBe('remote');
      expect(result.localRevision).toBe(5);
      expect(result.remoteRevision).toBe(10);
      expect(result.reason).toContain('remote wins');
    });

    test('chooses local when local revision is higher', () => {
      const local = { id: '1', server_revision: 15 };
      const remote = { id: '1', server_revision: 10 };

      const result = resolveConflict(local, remote, TABLE_NAMES.SERIES);

      expect(result.winner).toBe('local');
      expect(result.localRevision).toBe(15);
      expect(result.remoteRevision).toBe(10);
      expect(result.reason).toContain('local wins');
    });

    test('defaults to remote when revisions are equal', () => {
      const local = { id: '1', server_revision: 10 };
      const remote = { id: '1', server_revision: 10 };

      const result = resolveConflict(local, remote, TABLE_NAMES.SERIES);

      expect(result.winner).toBe('remote');
      expect(result.reason).toContain('equal');
    });
  });

  describe('timestamp fallback', () => {
    test('uses timestamp when no revisions available', () => {
      const local = { id: '1', server_updated_at_ms: 1000 };
      const remote = { id: '1', server_updated_at_ms: 2000 };

      const result = resolveConflict(local, remote, TABLE_NAMES.SERIES);

      expect(result.winner).toBe('remote');
      expect(result.localTimestamp).toBe(1000);
      expect(result.remoteTimestamp).toBe(2000);
      expect(result.reason).toContain('timestamp newer');
    });

    test('prefers revision over timestamp when both available', () => {
      const local = {
        id: '1',
        server_revision: 10,
        server_updated_at_ms: 3000, // Newer timestamp
      };
      const remote = {
        id: '1',
        server_revision: 5, // Older revision
        server_updated_at_ms: 1000,
      };

      const result = resolveConflict(local, remote, TABLE_NAMES.SERIES);

      // Should use revision, not timestamp
      expect(result.winner).toBe('local');
      expect(result.reason).toContain('revision');
      expect(result.reason).not.toContain('timestamp');
    });
  });

  describe('default remote-wins behavior', () => {
    test('defaults to remote when no server metadata', () => {
      const local = { id: '1', updated_at: 1000 };
      const remote = { id: '1', updated_at: 2000 };

      const result = resolveConflict(local, remote, TABLE_NAMES.SERIES);

      expect(result.winner).toBe('remote');
      expect(result.reason).toContain('No server');
    });
  });
});

describe('resolveByRevision', () => {
  test('chooses remote when remote revision is higher', () => {
    const local = { id: '1', server_revision: 5 };
    const remote = { id: '1', server_revision: 10 };

    const result = resolveByRevision(local, remote);

    expect(result.winner).toBe('remote');
    expect(result.localRevision).toBe(5);
    expect(result.remoteRevision).toBe(10);
    expect(result.reason).toContain('Server revision higher (remote wins)');
  });

  test('chooses local when local revision is higher', () => {
    const local = { id: '1', server_revision: 15 };
    const remote = { id: '1', server_revision: 10 };

    const result = resolveByRevision(local, remote);

    expect(result.winner).toBe('local');
    expect(result.localRevision).toBe(15);
    expect(result.remoteRevision).toBe(10);
    expect(result.reason).toContain('Local revision higher (local wins)');
  });

  test('defaults to remote when revisions are equal', () => {
    const local = { id: '1', server_revision: 10 };
    const remote = { id: '1', server_revision: 10 };

    const result = resolveByRevision(local, remote);

    expect(result.winner).toBe('remote');
    expect(result.reason).toContain(
      'Server revisions equal (remote wins by default)'
    );
  });
});

describe('resolveByTimestamp', () => {
  test('chooses remote when remote timestamp is newer', () => {
    const local = { id: '1', server_updated_at_ms: 1000 };
    const remote = { id: '1', server_updated_at_ms: 2000 };

    const result = resolveByTimestamp(local, remote);

    expect(result.winner).toBe('remote');
    expect(result.localTimestamp).toBe(1000);
    expect(result.remoteTimestamp).toBe(2000);
    expect(result.reason).toContain('Server timestamp newer (remote wins)');
  });

  test('chooses local when local timestamp is newer', () => {
    const local = { id: '1', server_updated_at_ms: 3000 };
    const remote = { id: '1', server_updated_at_ms: 2000 };

    const result = resolveByTimestamp(local, remote);

    expect(result.winner).toBe('local');
    expect(result.localTimestamp).toBe(3000);
    expect(result.remoteTimestamp).toBe(2000);
    expect(result.reason).toContain('Server timestamp newer (local wins)');
  });

  test('defaults to remote when only remote has timestamp', () => {
    const local = { id: '1' };
    const remote = { id: '1', server_updated_at_ms: 2000 };

    const result = resolveByTimestamp(local, remote);

    expect(result.winner).toBe('remote');
    expect(result.reason).toContain('Only remote has server timestamp');
  });

  test('defaults to remote when timestamps are equal', () => {
    const local = { id: '1', server_updated_at_ms: 2000 };
    const remote = { id: '1', server_updated_at_ms: 2000 };

    const result = resolveByTimestamp(local, remote);

    expect(result.winner).toBe('remote');
    expect(result.reason).toContain(
      'Server timestamps equal (remote wins by default)'
    );
  });
});
