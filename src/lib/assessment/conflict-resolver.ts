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

export function mergePartialUpdate<T extends Record<string, any>>(
  localData: T,
  serverUpdate: Partial<T>,
  preserveLocalFields: string[] = []
): T {
  const merged = { ...localData };

  for (const [key, value] of Object.entries(serverUpdate)) {
    if (preserveLocalFields.includes(key)) {
      continue;
    }

    merged[key as keyof T] = value as T[keyof T];
  }

  return merged;
}

export function needsSync(
  localTimestamp: number,
  serverTimestamp: number,
  syncThresholdMs: number = 1000
): boolean {
  return Math.abs(localTimestamp - serverTimestamp) > syncThresholdMs;
}
