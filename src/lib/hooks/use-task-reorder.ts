import React from 'react';
import { showMessage } from 'react-native-flash-message';

import { showErrorMessage } from '@/components/ui/utils';
import i18n from '@/lib/i18n';
import { updateTask } from '@/lib/task-manager';
import type { Task } from '@/types/calendar';

const UNDO_TIMEOUT_MS = 5000; // 5 seconds

type UndoState = {
  taskIds: string[];
  previousOrder: Record<string, number>;
  timeoutId: ReturnType<typeof setTimeout>;
};

/**
 * Helper to capture the previous order of tasks before reordering
 */
function capturePreviousOrder(data: Task[]): Record<string, number> {
  const previousOrder: Record<string, number> = {};
  data.forEach((task, index) => {
    // Use existing position or fall back to index
    previousOrder[task.id] =
      task.position !== undefined ? task.position : index;
  });
  return previousOrder;
}

/**
 * Helper to show undo toast message
 */
function showUndoToast(onUndo: () => Promise<void>): void {
  showMessage({
    message: i18n.t('tasks.reordered'),
    description: i18n.t('tasks.undoHint'),
    type: 'info',
    duration: UNDO_TIMEOUT_MS,
    onPress: () => {
      void onUndo();
    },
  });
}

/**
 * Helper to setup undo state after reordering
 */
function setupUndoState(
  undoStateRef: React.MutableRefObject<UndoState | undefined>,
  taskIds: string[],
  previousOrder: Record<string, number>
): void {
  const cleanupUndoState = () => {
    undoStateRef.current = undefined;
  };

  const timeoutId = setTimeout(cleanupUndoState, UNDO_TIMEOUT_MS);

  undoStateRef.current = {
    taskIds,
    previousOrder,
    timeoutId,
  };
}

/**
 * Hook to handle intra-day task reordering with undo functionality.
 * Provides a callback that can be used with DaySortableList's onDragEnd.
 * Shows an undo toast for 5 seconds after reordering.
 */
export function useTaskReorder() {
  const undoStateRef = React.useRef<UndoState | undefined>(undefined);

  const performUndo = React.useCallback(async () => {
    const snapshot = undoStateRef.current;
    undoStateRef.current = undefined;

    if (!snapshot) return;

    clearTimeout(snapshot.timeoutId);

    try {
      // Restore the previous order for all tasks
      await Promise.all(
        snapshot.taskIds.map(async (taskId) => {
          const previousPosition = snapshot.previousOrder[taskId];
          if (previousPosition !== undefined) {
            await updateTask(taskId, { position: previousPosition });
          }
        })
      );
    } catch (error) {
      console.error('Failed to undo task reorder:', error);
      showErrorMessage(i18n.t('tasks.undoError'));
    }
  }, []);

  const handleTaskReorder = React.useCallback(
    async (params: { data: Task[] }): Promise<void> => {
      const { data } = params;

      // Clear any existing undo timeout
      if (undoStateRef.current?.timeoutId) {
        clearTimeout(undoStateRef.current.timeoutId);
      }

      // Capture the previous order (task IDs and their positions)
      const previousOrder = capturePreviousOrder(data);

      try {
        // Update positions for all tasks in the new order
        await Promise.all(
          data.map((task, index) => updateTask(task.id, { position: index }))
        );

        // Set up undo state and show message
        setupUndoState(
          undoStateRef,
          data.map((t) => t.id),
          previousOrder
        );
        showUndoToast(performUndo);
      } catch (error) {
        console.error('Failed to reorder tasks:', error);
        showErrorMessage(i18n.t('tasks.reorderError'));
      }
    },
    [performUndo]
  );

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (undoStateRef.current?.timeoutId) {
        clearTimeout(undoStateRef.current.timeoutId);
      }
    };
  }, []);

  return {
    handleTaskReorder,
    performUndo,
  };
}
