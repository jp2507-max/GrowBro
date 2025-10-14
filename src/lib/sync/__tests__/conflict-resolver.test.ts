/**
 * Conflict Resolution Tests
 */

import {
  generateDeduplicationKey,
  isDuplicate,
  resolveConflict,
} from '../conflict-resolver';

describe('resolveConflict', () => {
  describe('with server_revision', () => {
    it('chooses remote when remote revision is higher', () => {
      const local = { id: '1', server_revision: 5 };
      const remote = { id: '1', server_revision: 10 };

      const result = resolveConflict(local, remote);

      expect(result.winner).toBe('remote');
      expect(result.localRevision).toBe(5);
      expect(result.remoteRevision).toBe(10);
      expect(result.reason).toContain('remote wins');
    });

    it('chooses local when local revision is higher', () => {
      const local = { id: '1', server_revision: 15 };
      const remote = { id: '1', server_revision: 10 };

      const result = resolveConflict(local, remote);

      expect(result.winner).toBe('local');
      expect(result.localRevision).toBe(15);
      expect(result.remoteRevision).toBe(10);
      expect(result.reason).toContain('local wins');
    });

    it('defaults to remote when revisions are equal', () => {
      const local = { id: '1', server_revision: 10 };
      const remote = { id: '1', server_revision: 10 };

      const result = resolveConflict(local, remote);

      expect(result.winner).toBe('remote');
      expect(result.reason).toContain('equal');
    });
  });

  describe('with server_updated_at_ms', () => {
    it('chooses remote when remote timestamp is newer', () => {
      const local = { id: '1', server_updated_at_ms: 1000 };
      const remote = { id: '1', server_updated_at_ms: 2000 };

      const result = resolveConflict(local, remote);

      expect(result.winner).toBe('remote');
      expect(result.localTimestamp).toBe(1000);
      expect(result.remoteTimestamp).toBe(2000);
      expect(result.reason).toContain('remote wins');
    });

    it('chooses local when local timestamp is newer', () => {
      const local = { id: '1', server_updated_at_ms: 3000 };
      const remote = { id: '1', server_updated_at_ms: 2000 };

      const result = resolveConflict(local, remote);

      expect(result.winner).toBe('local');
      expect(result.localTimestamp).toBe(3000);
      expect(result.remoteTimestamp).toBe(2000);
      expect(result.reason).toContain('local wins');
    });

    it('defaults to remote when only remote has timestamp', () => {
      const local = { id: '1' };
      const remote = { id: '1', server_updated_at_ms: 2000 };

      const result = resolveConflict(local, remote);

      expect(result.winner).toBe('remote');
      expect(result.reason).toContain('Only remote has');
    });
  });

  describe('without server metadata', () => {
    it('defaults to remote when no server revision or timestamp', () => {
      const local = { id: '1', updated_at: 1000 };
      const remote = { id: '1', updated_at: 2000 };

      const result = resolveConflict(local, remote);

      expect(result.winner).toBe('remote');
      expect(result.reason).toContain('No server');
    });
  });

  describe('precedence', () => {
    it('prefers server_revision over server_updated_at_ms', () => {
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

      const result = resolveConflict(local, remote);

      // Should use revision, not timestamp
      expect(result.winner).toBe('local');
      expect(result.reason).toContain('revision');
    });
  });
});

describe('isDuplicate', () => {
  it('identifies duplicates with same plant_id, meter_id, and time', () => {
    const record1 = {
      plant_id: 'plant1',
      meter_id: 'meter1',
      measured_at: 1000000,
    };
    const record2 = {
      plant_id: 'plant1',
      meter_id: 'meter1',
      measured_at: 1000500, // Within 1s
    };

    expect(isDuplicate(record1, record2)).toBe(true);
  });

  it('rejects records with different plant_id', () => {
    const record1 = {
      plant_id: 'plant1',
      meter_id: 'meter1',
      measured_at: 1000000,
    };
    const record2 = {
      plant_id: 'plant2',
      meter_id: 'meter1',
      measured_at: 1000500,
    };

    expect(isDuplicate(record1, record2)).toBe(false);
  });

  it('rejects records with different meter_id', () => {
    const record1 = {
      plant_id: 'plant1',
      meter_id: 'meter1',
      measured_at: 1000000,
    };
    const record2 = {
      plant_id: 'plant1',
      meter_id: 'meter2',
      measured_at: 1000500,
    };

    expect(isDuplicate(record1, record2)).toBe(false);
  });

  it('rejects records outside time tolerance', () => {
    const record1 = {
      plant_id: 'plant1',
      meter_id: 'meter1',
      measured_at: 1000000,
    };
    const record2 = {
      plant_id: 'plant1',
      meter_id: 'meter1',
      measured_at: 1002000, // 2s difference
    };

    expect(isDuplicate(record1, record2, 1000)).toBe(false);
  });

  it('handles undefined plant_id and meter_id', () => {
    const record1 = {
      plant_id: undefined,
      meter_id: undefined,
      measured_at: 1000000,
    };
    const record2 = {
      plant_id: undefined,
      meter_id: undefined,
      measured_at: 1000500,
    };

    expect(isDuplicate(record1, record2)).toBe(true);
  });

  it('uses custom tolerance', () => {
    const record1 = {
      plant_id: 'plant1',
      meter_id: 'meter1',
      measured_at: 1000000,
    };
    const record2 = {
      plant_id: 'plant1',
      meter_id: 'meter1',
      measured_at: 1004000, // 4s difference
    };

    expect(isDuplicate(record1, record2, 5000)).toBe(true);
    expect(isDuplicate(record1, record2, 3000)).toBe(false);
  });
});

describe('generateDeduplicationKey', () => {
  it('generates consistent key for same inputs', () => {
    const key1 = generateDeduplicationKey('plant1', 'meter1', 1234567890);
    const key2 = generateDeduplicationKey('plant1', 'meter1', 1234567890);

    expect(key1).toBe(key2);
  });

  it('buckets to nearest second', () => {
    const key1 = generateDeduplicationKey('plant1', 'meter1', 1234567000);
    const key2 = generateDeduplicationKey('plant1', 'meter1', 1234567999);

    expect(key1).toBe(key2); // Same second bucket
  });

  it('handles undefined plant_id and meter_id', () => {
    const key = generateDeduplicationKey(undefined, undefined, 1234567000);

    expect(key).toBe('null_null_1234567');
  });

  it('generates different keys for different inputs', () => {
    const key1 = generateDeduplicationKey('plant1', 'meter1', 1000000000);
    const key2 = generateDeduplicationKey('plant2', 'meter1', 1000000000);
    const key3 = generateDeduplicationKey('plant1', 'meter2', 1000000000);
    const key4 = generateDeduplicationKey('plant1', 'meter1', 2000000000);

    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1).not.toBe(key4);
  });
});
