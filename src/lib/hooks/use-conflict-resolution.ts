/* eslint-disable max-lines-per-function */
import { useCallback, useState } from 'react';

import { NoopAnalytics } from '@/lib/analytics';
import type { LegacyConflict as Conflict } from '@/lib/sync/types';
import { TABLE_NAMES } from '@/lib/sync/types';
import { database } from '@/lib/watermelon';
import type { HarvestModel } from '@/lib/watermelon-models/harvest';
import type { HarvestAuditModel } from '@/lib/watermelon-models/harvest-audit';
import type { InventoryModel } from '@/lib/watermelon-models/inventory';
import type { InventoryBatchModel } from '@/lib/watermelon-models/inventory-batch';
import type { InventoryItemModel } from '@/lib/watermelon-models/inventory-item';
import type { InventoryMovementModel } from '@/lib/watermelon-models/inventory-movement';
import type { OccurrenceOverrideModel } from '@/lib/watermelon-models/occurrence-override';
import type { SeriesModel } from '@/lib/watermelon-models/series';
import type { TaskModel } from '@/lib/watermelon-models/task';

/**
 * Parses and cleans task metadata by handling both string and object formats,
 * removing the needsReview flag, and providing error recovery for malformed JSON.
 */
function parseAndCleanTaskMetadata(
  taskRec: TaskModel,
  tableName: string
): Record<string, unknown> {
  let metadata;
  try {
    metadata =
      typeof taskRec.metadata === 'string'
        ? JSON.parse(taskRec.metadata)
        : taskRec.metadata;
  } catch (parseError) {
    console.error(
      `Failed to parse metadata for task ${taskRec.id} in table ${tableName}:`,
      parseError
    );
    metadata = typeof taskRec.metadata === 'string' ? {} : taskRec.metadata;
  }
  delete metadata.needsReview;
  return metadata;
}

/**
 * Table names that are valid for sync conflict analytics events
 */
type ValidSyncConflictTableName =
  | 'series'
  | 'tasks'
  | 'occurrence_overrides'
  | 'harvests'
  | 'inventory'
  | 'harvest_audits'
  | 'inventory_items'
  | 'inventory_batches'
  | 'inventory_movements';

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
    tableName === 'harvest_audits' ||
    tableName === 'inventory_items' ||
    tableName === 'inventory_batches' ||
    tableName === 'inventory_movements'
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
                  | HarvestAuditModel
                  | InventoryItemModel
                  | InventoryBatchModel
                  | InventoryMovementModel;

                // Restore local values for conflicting fields
                // This loop iterates through fields that were in conflict and restores
                // the local (client-side) values over the server values
                if (conflict.localRecord) {
                  for (const field of conflict.conflictFields) {
                    if (field in conflict.localRecord) {
                      // Type-safe dynamic field assignment using Record index signature
                      // We know the field exists in localRecord and typedRec is a valid model
                      const recordWithDynamicFields =
                        typedRec as unknown as Record<string, unknown>;
                      recordWithDynamicFields[field] =
                        conflict.localRecord[field];
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
                  taskRec.metadata = parseAndCleanTaskMetadata(
                    taskRec,
                    conflict.tableName
                  );
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
                  | HarvestAuditModel
                  | InventoryItemModel
                  | InventoryBatchModel
                  | InventoryMovementModel;
                if (
                  conflict.tableName === TABLE_NAMES.TASKS &&
                  (typedRec as TaskModel).metadata
                ) {
                  const taskRec = typedRec as TaskModel;
                  taskRec.metadata = parseAndCleanTaskMetadata(
                    taskRec,
                    conflict.tableName
                  );
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
