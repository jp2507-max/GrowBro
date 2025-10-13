/* eslint-disable max-lines-per-function */
import { useCallback, useState } from 'react';

import { NoopAnalytics } from '@/lib/analytics';
import type { LegacyConflict as Conflict } from '@/lib/sync/types';
import { TABLE_NAMES } from '@/lib/sync/types';
import { database } from '@/lib/watermelon';

/**
 * Table names that are valid for sync conflict analytics events
 */
type ValidSyncConflictTableName =
  | 'series'
  | 'tasks'
  | 'occurrence_overrides'
  | 'harvests'
  | 'inventory'
  | 'harvest_audits';

/**
 * Validates that a table name is one of the allowed values from the schema
 */
function validateTableName(
  tableName: string
): asserts tableName is (typeof TABLE_NAMES)[keyof typeof TABLE_NAMES] {
  const validTableNames = Object.values(TABLE_NAMES);
  if (!validTableNames.includes(tableName as any)) {
    throw new Error(
      `Invalid table name "${tableName}". Must be one of: ${validTableNames.join(', ')}`
    );
  }
}

/**
 * Validates that a table name is valid for sync conflict analytics
 */
function validateSyncConflictTableName(
  tableName: string
): asserts tableName is ValidSyncConflictTableName {
  const validTableNames: ValidSyncConflictTableName[] = [
    'series',
    'tasks',
    'occurrence_overrides',
    'harvests',
    'inventory',
    'harvest_audits',
  ];
  if (!validTableNames.includes(tableName as ValidSyncConflictTableName)) {
    throw new Error(
      `Invalid table name "${tableName}" for sync conflict analytics. Must be one of: ${validTableNames.join(', ')}`
    );
  }
}

type ConflictResolutionState = {
  conflicts: Conflict[];
  currentConflict: Conflict | null;
  isResolving: boolean;
};

export function useConflictResolution() {
  const [state, setState] = useState<ConflictResolutionState>({
    conflicts: [],
    currentConflict: null,
    isResolving: false,
  });

  const addConflict = useCallback((conflict: Conflict) => {
    setState((prev) => ({
      ...prev,
      conflicts: [...prev.conflicts, conflict],
      currentConflict: prev.currentConflict ?? conflict,
    }));
  }, []);

  const resolveConflict = useCallback(
    async (
      conflict: Conflict,
      strategy: 'keep-local' | 'accept-server'
    ): Promise<void> => {
      setState((prev) => ({ ...prev, isResolving: true }));

      try {
        // Validate table name at runtime
        validateTableName(conflict.tableName);

        if (strategy === 'keep-local') {
          // Create a new mutation to restore local version
          await database.write(async () => {
            const collection = database.collections.get(conflict.tableName);
            try {
              const record = await collection.find(conflict.recordId);
              await record.update((rec: any) => {
                // Restore local values for conflicting fields
                if (conflict.localRecord) {
                  for (const field of conflict.conflictFields) {
                    if (field in conflict.localRecord) {
                      rec[field] = conflict.localRecord[field];
                    }
                  }
                }
                // Clear the needsReview flag if it exists
                if (conflict.tableName === TABLE_NAMES.TASKS && rec.metadata) {
                  const metadata =
                    typeof rec.metadata === 'string'
                      ? JSON.parse(rec.metadata)
                      : rec.metadata;
                  delete metadata.needsReview;
                  rec.metadata = metadata;
                }
              });
            } catch (error) {
              console.error('Failed to restore local version:', error);
              throw error;
            }
          });

          validateSyncConflictTableName(conflict.tableName);

          await NoopAnalytics.track('sync_conflict_resolved', {
            table: conflict.tableName as ValidSyncConflictTableName,
            strategy: 'keep-local',
            field_count: conflict.conflictFields.length,
          });
        } else {
          // Accept server version - just clear the needsReview flag
          await database.write(async () => {
            const collection = database.collections.get(conflict.tableName);
            try {
              const record = await collection.find(conflict.recordId);
              await record.update((rec: any) => {
                if (conflict.tableName === TABLE_NAMES.TASKS && rec.metadata) {
                  const metadata =
                    typeof rec.metadata === 'string'
                      ? JSON.parse(rec.metadata)
                      : rec.metadata;
                  delete metadata.needsReview;
                  rec.metadata = metadata;
                }
              });
            } catch (error) {
              console.error('Failed to accept server version:', error);
              throw error;
            }
          });

          validateSyncConflictTableName(conflict.tableName);

          await NoopAnalytics.track('sync_conflict_resolved', {
            table: conflict.tableName as ValidSyncConflictTableName,
            strategy: 'accept-server',
            field_count: conflict.conflictFields.length,
          });
        }

        // Move to next conflict
        setState((prev) => {
          const remaining = prev.conflicts.filter(
            (c) => c.recordId !== conflict.recordId
          );
          return {
            conflicts: remaining,
            currentConflict: remaining[0] ?? null,
            isResolving: false,
          };
        });
      } catch (error) {
        console.error('Failed to resolve conflict:', error);
        setState((prev) => ({ ...prev, isResolving: false }));
        throw error;
      }
    },
    []
  );

  const dismissConflict = useCallback((conflict: Conflict) => {
    setState((prev) => {
      const remaining = prev.conflicts.filter(
        (c) => c.recordId !== conflict.recordId
      );
      return {
        conflicts: remaining,
        currentConflict: remaining[0] ?? null,
        isResolving: false,
      };
    });

    validateSyncConflictTableName(conflict.tableName);

    NoopAnalytics.track('sync_conflict_dismissed', {
      table: conflict.tableName as ValidSyncConflictTableName,
      field_count: conflict.conflictFields.length,
    });
  }, []);

  const clearAllConflicts = useCallback(() => {
    setState({
      conflicts: [],
      currentConflict: null,
      isResolving: false,
    });
  }, []);

  return {
    conflicts: state.conflicts,
    currentConflict: state.currentConflict,
    isResolving: state.isResolving,
    hasConflicts: state.conflicts.length > 0,
    addConflict,
    resolveConflict,
    dismissConflict,
    clearAllConflicts,
  };
}
