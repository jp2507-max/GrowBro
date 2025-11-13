/**
 * Conflict resolution strategies
 */
import { detectConflicts } from './conflict-detection';
import type { ConflictResolution, SyncConflict } from './conflict-types';

/**
 * Last-write-wins: Use data with most recent timestamp
 */
export function resolveLastWriteWins<T extends Record<string, unknown>>(
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
export function resolveClientWins<T extends Record<string, unknown>>(
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
export function resolveServerWins<T extends Record<string, unknown>>(
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
