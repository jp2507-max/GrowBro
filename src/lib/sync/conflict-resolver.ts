/**
 * Conflict Resolution Logic
 * Resolves sync conflicts using server-assigned revisions or timestamps (LWW)
 */

import type { ConflictResolution, TableName } from './types';

type ConflictRecord = {
  id: string;
  server_revision?: number;
  server_updated_at_ms?: number;
  updated_at?: number; // Local timestamp
  [key: string]: unknown;
};

/**
 * Get the conflict resolution strategy for a table
 * Tasks use 'needs-review' strategy, others use 'server-lww'
 *
 * @param tableName - The table name
 * @returns The resolution strategy
 */
export function getResolutionStrategy(
  tableName: TableName
): 'server-lww' | 'needs-review' {
  return tableName === 'tasks' ? 'needs-review' : 'server-lww';
}

/**
 * Resolve conflict between local and remote records
 * Server-assigned revision takes precedence; falls back to server timestamp
 * NEVER uses client clock for conflict resolution
 *
 * @param local - Local record from device
 * @param remote - Remote record from server
 * @param tableName - Optional table name for strategy selection
 * @returns Conflict resolution with winner and reason
 */
export function resolveConflict(
  local: ConflictRecord,
  remote: ConflictRecord,
  tableName?: TableName
): ConflictResolution {
  // Check if table uses needs-review strategy
  if (tableName && getResolutionStrategy(tableName) === 'needs-review') {
    return {
      winner: 'needs-review',
      reason: `Table '${tableName}' requires manual review for conflicts`,
    };
  }

  // Strategy 1: Use server_revision if both have it (preferred)
  if (
    remote.server_revision !== undefined &&
    local.server_revision !== undefined
  ) {
    return resolveByRevision(local, remote);
  }

  // Strategy 2: Use server_updated_at_ms if available (fallback)
  if (remote.server_updated_at_ms !== undefined) {
    return resolveByTimestamp(local, remote);
  }

  // Strategy 3: No server metadata - remote wins by default
  // Never fall back to client updated_at for conflict resolution
  return {
    winner: 'remote',
    reason: 'No server revision/timestamp available (remote wins by default)',
  };
}

export function resolveByRevision(
  local: ConflictRecord,
  remote: ConflictRecord
): ConflictResolution {
  if (remote.server_revision! > local.server_revision!) {
    return {
      winner: 'remote',
      localRevision: local.server_revision,
      remoteRevision: remote.server_revision,
      reason: 'Server revision higher (remote wins)',
    };
  } else if (local.server_revision! > remote.server_revision!) {
    return {
      winner: 'local',
      localRevision: local.server_revision,
      remoteRevision: remote.server_revision,
      reason: 'Local revision higher (local wins)',
    };
  } else {
    // Equal revisions - remote wins by default
    return {
      winner: 'remote',
      localRevision: local.server_revision,
      remoteRevision: remote.server_revision,
      reason: 'Server revisions equal (remote wins by default)',
    };
  }
}

export function resolveByTimestamp(
  local: ConflictRecord,
  remote: ConflictRecord
): ConflictResolution {
  const localServerTimestamp = local.server_updated_at_ms;

  if (localServerTimestamp === undefined) {
    // Remote has server timestamp, local doesn't - remote wins
    return {
      winner: 'remote',
      remoteTimestamp: remote.server_updated_at_ms,
      reason: 'Only remote has server timestamp',
    };
  }

  // Both have server timestamps - compare LWW
  if (remote.server_updated_at_ms! > localServerTimestamp) {
    return {
      winner: 'remote',
      localTimestamp: localServerTimestamp,
      remoteTimestamp: remote.server_updated_at_ms,
      reason: 'Server timestamp newer (remote wins)',
    };
  } else if (localServerTimestamp > remote.server_updated_at_ms!) {
    return {
      winner: 'local',
      localTimestamp: localServerTimestamp,
      remoteTimestamp: remote.server_updated_at_ms,
      reason: 'Server timestamp newer (local wins)',
    };
  } else {
    // Equal timestamps - remote wins by default
    return {
      winner: 'remote',
      localTimestamp: localServerTimestamp,
      remoteTimestamp: remote.server_updated_at_ms,
      reason: 'Server timestamps equal (remote wins by default)',
    };
  }
}

/**
 * Check if two records are likely duplicates based on deduplication key
 * Used for ph_ec_readings: (plant_id, meter_id, measured_at within ±1s)
 *
 * @param record1 - First record
 * @param record2 - Second record
 * @param toleranceMs - Time tolerance in milliseconds (default 1000ms)
 * @returns True if records are likely duplicates
 */
export function isDuplicate(
  record1: { plant_id?: string; meter_id?: string; measured_at: number },
  record2: { plant_id?: string; meter_id?: string; measured_at: number },
  toleranceMs = 1000
): boolean {
  // Plant IDs must match (or both undefined)
  if (record1.plant_id !== record2.plant_id) {
    return false;
  }

  // Meter IDs must match (or both undefined)
  if (record1.meter_id !== record2.meter_id) {
    return false;
  }

  // Measured timestamps must be within tolerance
  const timeDiff = Math.abs(record1.measured_at - record2.measured_at);
  return timeDiff <= toleranceMs;
}

/**
 * Generate deduplication key for ph_ec_readings
 * Buckets measured_at to nearest second for server-side uniqueness check
 *
 * @param plantId - Plant ID (optional)
 * @param meterId - Meter ID (optional)
 * @param measuredAtMs - Measured timestamp in milliseconds
 * @returns Deduplication key string
 */
export function generateDeduplicationKey(
  plantId: string | undefined,
  meterId: string | undefined,
  measuredAtMs: number
): string {
  const bucketedSeconds = Math.floor(measuredAtMs / 1000);
  return `${plantId || 'null'}_${meterId || 'null'}_${bucketedSeconds}`;
}
