/* eslint-disable max-lines-per-function */
import { useCallback, useState } from 'react';

import { NoopAnalytics } from '@/lib/analytics';
// Conflict type removed - legacy feature
// import type { Conflict } from '@/lib/sync/conflict-resolver';
import { database } from '@/lib/watermelon';

// Stub Conflict type for backward compatibility
type Conflict = {
  tableName: string;
  recordId: string;
  conflictFields: string[];
  localRecord?: Record<string, any>;
  remoteRecord?: Record<string, any>;
};

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
        if (strategy === 'keep-local') {
          // Create a new mutation to restore local version
          await database.write(async () => {
            const collection = database.collections.get(
              conflict.tableName as any
            );
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
                if (conflict.tableName === 'tasks' && rec.metadata) {
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

          await NoopAnalytics.track('sync_conflict_resolved', {
            table: conflict.tableName as any,
            strategy: 'keep-local',
            field_count: conflict.conflictFields.length,
          });
        } else {
          // Accept server version - just clear the needsReview flag
          await database.write(async () => {
            const collection = database.collections.get(
              conflict.tableName as any
            );
            try {
              const record = await collection.find(conflict.recordId);
              await record.update((rec: any) => {
                if (conflict.tableName === 'tasks' && rec.metadata) {
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

          await NoopAnalytics.track('sync_conflict_resolved', {
            table: conflict.tableName as any,
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

    NoopAnalytics.track('sync_conflict_dismissed', {
      table: conflict.tableName as any,
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
