/* eslint-disable max-lines-per-function */
import { useCallback, useState } from 'react';

import { NoopAnalytics } from '@/lib/analytics';
import type { LegacyConflict as Conflict } from '@/lib/sync/types';
import { TABLE_NAMES } from '@/lib/sync/types';
import { database } from '@/lib/watermelon';
import type { HarvestModel } from '@/lib/watermelon-models/harvest';
import type { HarvestAuditModel } from '@/lib/watermelon-models/harvest-audit';
import type { InventoryModel } from '@/lib/watermelon-models/inventory';
import type { OccurrenceOverrideModel } from '@/lib/watermelon-models/occurrence-override';
import type { SeriesModel } from '@/lib/watermelon-models/series';
import type { TaskModel } from '@/lib/watermelon-models/task';

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
  const validTableNames: string[] = Object.values(TABLE_NAMES);
  if (!validTableNames.includes(tableName)) {
    throw new Error(
      `Invalid table name "${tableName}". Must be one of: ${validTableNames.join(', ')}`
    );
  }
}

/**
 * Validates that a table name is valid for sync conflict analytics
 */
function isSyncConflictAnalyticsTable(
  tableName: string
): tableName is ValidSyncConflictTableName {
  return (
    tableName === 'series' ||
    tableName === 'tasks' ||
    tableName === 'occurrence_overrides' ||
    tableName === 'harvests' ||
    tableName === 'inventory' ||
    tableName === 'harvest_audits'
  );
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
              await record.update((rec) => {
                // Type assertion for type safety - table name is validated above
                // This narrows the type from generic Model to specific model types
                const typedRec = rec as
                  | SeriesModel
                  | TaskModel
                  | OccurrenceOverrideModel
                  | HarvestModel
                  | InventoryModel
                  | HarvestAuditModel;

                // Restore local values for conflicting fields
                // This loop iterates through fields that were in conflict and restores
                // the local (client-side) values over the server values
                if (conflict.localRecord) {
                  for (const field of conflict.conflictFields) {
                    if (field in conflict.localRecord) {
                      // NOTE: Type safety concern - using 'as any' to bypass TypeScript
                      // checking for dynamic field access. This is necessary due to
                      // WatermelonDB's API design but creates a potential runtime risk
                      // if conflict.conflictFields contains invalid field names.
                      // Consider implementing a type-safe field restoration helper
                      // as suggested in code review to validate field existence.
                      (typedRec as any)[field] = conflict.localRecord[field];
                    }
                  }
                }

                // Clear the needsReview flag if it exists on task records
                // This flag indicates the record had sync conflicts that needed manual review
                // After resolving by keeping local changes, we remove this flag
                if (
                  conflict.tableName === TABLE_NAMES.TASKS &&
                  (typedRec as TaskModel).metadata
                ) {
                  const taskRec = typedRec as TaskModel;
                  // Handle both string (serialized) and object metadata formats
                  const metadata =
                    typeof taskRec.metadata === 'string'
                      ? JSON.parse(taskRec.metadata)
                      : taskRec.metadata;
                  // Remove the needsReview flag to indicate conflict is resolved
                  delete metadata.needsReview;
                  // Update both the generic record and typed record with cleaned metadata
                  taskRec.metadata = metadata;
                }
              });
            } catch (error) {
              console.error('Failed to restore local version:', error);
              throw error;
            }
          });

          if (isSyncConflictAnalyticsTable(conflict.tableName)) {
            await NoopAnalytics.track('sync_conflict_resolved', {
              table: conflict.tableName,
              strategy: 'keep-local',
              field_count: conflict.conflictFields.length,
            });
          }
        } else {
          // Accept server version - just clear the needsReview flag
          await database.write(async () => {
            const collection = database.collections.get(conflict.tableName);
            try {
              const record = await collection.find(conflict.recordId);
              await record.update((rec) => {
                // Type assertion for type safety - table name is validated above
                const typedRec = rec as
                  | SeriesModel
                  | TaskModel
                  | OccurrenceOverrideModel
                  | HarvestModel
                  | InventoryModel
                  | HarvestAuditModel;
                if (
                  conflict.tableName === TABLE_NAMES.TASKS &&
                  (typedRec as TaskModel).metadata
                ) {
                  const taskRec = typedRec as TaskModel;
                  const metadata =
                    typeof taskRec.metadata === 'string'
                      ? JSON.parse(taskRec.metadata)
                      : taskRec.metadata;
                  delete metadata.needsReview;
                  taskRec.metadata = metadata;
                }
              });
            } catch (error) {
              console.error('Failed to accept server version:', error);
              throw error;
            }
          });

          if (isSyncConflictAnalyticsTable(conflict.tableName)) {
            await NoopAnalytics.track('sync_conflict_resolved', {
              table: conflict.tableName,
              strategy: 'accept-server',
              field_count: conflict.conflictFields.length,
            });
          }
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

  const dismissConflict = useCallback(async (conflict: Conflict) => {
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

    if (isSyncConflictAnalyticsTable(conflict.tableName)) {
      await NoopAnalytics.track('sync_conflict_dismissed', {
        table: conflict.tableName,
        field_count: conflict.conflictFields.length,
      });
    }
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
