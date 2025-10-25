/**
 * Conflict resolution for assessment sync operations
 * Implements last-write-wins strategy using server timestamps
 */

export type ConflictResolutionStrategy =
  | 'last-write-wins'
  | 'client-wins'
  | 'server-wins';

export type SyncConflict<T = any> = {
  localData: T;
  serverData: T;
  localTimestamp: number;
  serverTimestamp: number;
};

export type ConflictResolution<T = any> = {
  resolved: T;
  strategy: ConflictResolutionStrategy;
  winner: 'local' | 'server';
  conflicts: string[];
};

/**
 * Resolve sync conflicts using last-write-wins strategy
 */
export function resolveConflict<T extends Record<string, any>>(
  conflict: SyncConflict<T>,
  strategy: ConflictResolutionStrategy = 'last-write-wins'
): ConflictResolution<T> {
  switch (strategy) {
    case 'last-write-wins':
      return resolveLastWriteWins(conflict);
    case 'client-wins':
      return resolveClientWins(conflict);
    case 'server-wins':
      return resolveServerWins(conflict);
    default:
      return resolveLastWriteWins(conflict);
  }
}

/**
 * Last-write-wins: Use data with most recent timestamp
 */
function resolveLastWriteWins<T extends Record<string, any>>(
  conflict: SyncConflict<T>
): ConflictResolution<T> {
  const { localData, serverData, localTimestamp, serverTimestamp } = conflict;

  const winner = localTimestamp > serverTimestamp ? 'local' : 'server';
  const resolved = winner === 'local' ? localData : serverData;

  const conflicts = detectConflicts(localData, serverData);

  return {
    resolved,
    strategy: 'last-write-wins',
    winner,
    conflicts,
  };
}

/**
 * Client-wins: Always prefer local data
 */
function resolveClientWins<T extends Record<string, any>>(
  conflict: SyncConflict<T>
): ConflictResolution<T> {
  const { localData, serverData } = conflict;
  const conflicts = detectConflicts(localData, serverData);

  return {
    resolved: localData,
    strategy: 'client-wins',
    winner: 'local',
    conflicts,
  };
}

/**
 * Server-wins: Always prefer server data
 */
function resolveServerWins<T extends Record<string, any>>(
  conflict: SyncConflict<T>
): ConflictResolution<T> {
  const { localData, serverData } = conflict;
  const conflicts = detectConflicts(localData, serverData);

  return {
    resolved: serverData,
    strategy: 'server-wins',
    winner: 'server',
    conflicts,
  };
}

/**
 * Detect conflicting fields between local and server data
 */
function detectConflicts<T extends Record<string, any>>(
  localData: T,
  serverData: T
): string[] {
  const conflicts: string[] = [];
  const allKeys = new Set([
    ...Object.keys(localData),
    ...Object.keys(serverData),
  ]);

  for (const key of allKeys) {
    const localValue = localData[key];
    const serverValue = serverData[key];

    // Skip if values are equal
    if (isEqual(localValue, serverValue)) {
      continue;
    }

    // Skip timestamp fields (expected to differ)
    if (
      key.includes('timestamp') ||
      key.includes('_at') ||
      key === 'createdAt' ||
      key === 'updatedAt'
    ) {
      continue;
    }

    conflicts.push(key);
  }

  return conflicts;
}

/**
 * Deep equality check for values
 */
function isEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object') {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => isEqual(item, b[index]));
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    return keysA.every((key) => isEqual(a[key], b[key]));
  }

  return false;
}

/**
 * Merge partial updates from server into local data
 * Useful for partial sync operations
 */
export function mergePartialUpdate<T extends Record<string, any>>(
  localData: T,
  serverUpdate: Partial<T>,
  preserveLocalFields: string[] = []
): T {
  const merged = { ...localData };

  for (const [key, value] of Object.entries(serverUpdate)) {
    // Skip fields that should be preserved locally
    if (preserveLocalFields.includes(key)) {
      continue;
    }

    // Apply server update
    (merged as any)[key] = value;
  }

  return merged;
}

/**
 * Check if data needs sync based on timestamps
 */
export function needsSync(
  localTimestamp: number,
  serverTimestamp: number,
  syncThresholdMs: number = 1000
): boolean {
  // If timestamps differ by more than threshold, sync is needed
  return Math.abs(localTimestamp - serverTimestamp) > syncThresholdMs;
}
