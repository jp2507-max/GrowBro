/**
 * Assessment conflict resolution façade
 */
import {
  resolveClientWins,
  resolveLastWriteWins,
  resolveServerWins,
} from './conflict-strategies';
import type {
  ConflictResolution,
  ConflictResolutionStrategy,
  SyncConflict,
} from './conflict-types';

export type { ConflictResolution, ConflictResolutionStrategy, SyncConflict };

export function resolveConflict<T extends Record<string, unknown>>(
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
