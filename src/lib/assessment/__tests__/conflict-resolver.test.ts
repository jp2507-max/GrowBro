import { resolveConflict } from '../conflict-resolver';
import { mergePartialUpdate, needsSync } from '../sync-utils';

describe('resolveConflict', () => {
  describe('last-write-wins strategy', () => {
    test('chooses local data when local timestamp is newer', () => {
      const conflict = {
        localData: { id: '1', name: 'Local Name', value: 100 },
        serverData: { id: '1', name: 'Server Name', value: 50 },
        localTimestamp: 2000,
        serverTimestamp: 1000,
      };

      const resolution = resolveConflict(conflict, 'last-write-wins');

      expect(resolution.winner).toBe('local');
      expect(resolution.resolved).toEqual(conflict.localData);
      expect(resolution.strategy).toBe('last-write-wins');
    });

    test('chooses server data when server timestamp is newer', () => {
      const conflict = {
        localData: { id: '1', name: 'Local Name', value: 100 },
        serverData: { id: '1', name: 'Server Name', value: 50 },
        localTimestamp: 1000,
        serverTimestamp: 2000,
      };

      const resolution = resolveConflict(conflict, 'last-write-wins');

      expect(resolution.winner).toBe('server');
      expect(resolution.resolved).toEqual(conflict.serverData);
    });

    test('detects conflicting fields', () => {
      const conflict = {
        localData: { id: '1', name: 'Local', status: 'pending' },
        serverData: { id: '1', name: 'Server', status: 'completed' },
        localTimestamp: 1000,
        serverTimestamp: 2000,
      };

      const resolution = resolveConflict(conflict, 'last-write-wins');

      expect(resolution.conflicts).toContain('name');
      expect(resolution.conflicts).toContain('status');
      expect(resolution.conflicts).not.toContain('id');
    });

    test('ignores timestamp field differences', () => {
      const conflict = {
        localData: { id: '1', name: 'Test', createdAt: 1000, updatedAt: 2000 },
        serverData: { id: '1', name: 'Test', createdAt: 1000, updatedAt: 3000 },
        localTimestamp: 2000,
        serverTimestamp: 3000,
      };

      const resolution = resolveConflict(conflict, 'last-write-wins');

      // updatedAt should not be in conflicts
      expect(resolution.conflicts).not.toContain('updatedAt');
      expect(resolution.conflicts).not.toContain('createdAt');
    });
  });

  describe('client-wins strategy', () => {
    test('always chooses local data', () => {
      const conflict = {
        localData: { id: '1', name: 'Local' },
        serverData: { id: '1', name: 'Server' },
        localTimestamp: 1000,
        serverTimestamp: 2000,
      };

      const resolution = resolveConflict(conflict, 'client-wins');

      expect(resolution.winner).toBe('local');
      expect(resolution.resolved).toEqual(conflict.localData);
      expect(resolution.strategy).toBe('client-wins');
    });
  });

  describe('server-wins strategy', () => {
    test('always chooses server data', () => {
      const conflict = {
        localData: { id: '1', name: 'Local' },
        serverData: { id: '1', name: 'Server' },
        localTimestamp: 2000,
        serverTimestamp: 1000,
      };

      const resolution = resolveConflict(conflict, 'server-wins');

      expect(resolution.winner).toBe('server');
      expect(resolution.resolved).toEqual(conflict.serverData);
      expect(resolution.strategy).toBe('server-wins');
    });
  });

  test('handles nested objects in conflict detection', () => {
    const conflict = {
      localData: {
        id: '1',
        metadata: { count: 5, tags: ['a', 'b'] },
      },
      serverData: {
        id: '1',
        metadata: { count: 10, tags: ['a', 'c'] },
      },
      localTimestamp: 1000,
      serverTimestamp: 2000,
    };

    const resolution = resolveConflict(conflict, 'last-write-wins');

    expect(resolution.conflicts).toContain('metadata');
  });
});

describe('mergePartialUpdate', () => {
  test('merges server updates into local data', () => {
    const localData = {
      id: '1',
      name: 'Local Name',
      status: 'pending',
      count: 5,
    };

    const serverUpdate = {
      status: 'completed',
      count: 10,
    };

    const merged = mergePartialUpdate(localData, serverUpdate);

    expect(merged).toEqual({
      id: '1',
      name: 'Local Name',
      status: 'completed',
      count: 10,
    });
  });

  test('preserves specified local fields', () => {
    const localData = {
      id: '1',
      name: 'Local Name',
      status: 'pending',
      localOnly: 'keep this',
    };

    const serverUpdate = {
      status: 'completed',
      localOnly: 'overwrite this',
    };

    const merged = mergePartialUpdate(localData, serverUpdate, ['localOnly']);

    expect(merged.status).toBe('completed');
    expect(merged.localOnly).toBe('keep this');
  });

  test('handles empty server update', () => {
    const localData = { id: '1', name: 'Test' };
    const merged = mergePartialUpdate(localData, {});

    expect(merged).toEqual(localData);
  });

  test('adds new fields from server', () => {
    const localData = { id: '1', name: 'Test' };
    const serverUpdate = { newField: 'new value' };

    const merged = mergePartialUpdate(localData, serverUpdate);

    expect(merged).toEqual({
      id: '1',
      name: 'Test',
      newField: 'new value',
    });
  });
});

describe('needsSync', () => {
  test('returns true when timestamps differ significantly', () => {
    const localTimestamp = 1000;
    const serverTimestamp = 5000;
    const threshold = 1000;

    expect(needsSync(localTimestamp, serverTimestamp, threshold)).toBe(true);
  });

  test('returns false when timestamps are within threshold', () => {
    const localTimestamp = 1000;
    const serverTimestamp = 1500;
    const threshold = 1000;

    expect(needsSync(localTimestamp, serverTimestamp, threshold)).toBe(false);
  });

  test('uses default threshold of 1000ms', () => {
    expect(needsSync(1000, 1500)).toBe(false);
    expect(needsSync(1000, 2500)).toBe(true);
  });

  test('handles local timestamp newer than server', () => {
    const localTimestamp = 5000;
    const serverTimestamp = 1000;
    const threshold = 1000;

    expect(needsSync(localTimestamp, serverTimestamp, threshold)).toBe(true);
  });

  test('returns false when timestamps are equal', () => {
    const timestamp = 1000;
    expect(needsSync(timestamp, timestamp, 1000)).toBe(false);
  });
});
