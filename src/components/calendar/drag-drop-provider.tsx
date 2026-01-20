import React from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Vibration } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import type { SharedValue } from 'react-native-reanimated';
import { useSharedValue } from 'react-native-reanimated';

import { showErrorMessage } from '@/components/ui/utils';
import { rescheduleRecurringInstance, updateTask } from '@/lib/task-manager';
import {
  combineTargetDateWithTime,
  type DateCombinationResult,
} from '@/lib/utils/date';
import type { Task } from '@/types/calendar';

export type DragScope = 'occurrence' | 'series';

// Type for FlashList/FlatList ref with scrollToOffset method
type ScrollableListRef = {
  scrollToOffset: (params: { offset: number; animated: boolean }) => void;
} | null;

type DragContextValue = {
  isDragging: boolean;
  draggedTask?: Task;
  startDrag: (task: Task) => void;
  cancelDrag: () => void;
  completeDrop: (targetDate: Date, scope: DragScope) => Promise<void>;
  onDragUpdate: (y: number) => number | undefined;
  registerListRef: (ref: React.RefObject<ScrollableListRef>) => void;
  registerViewportHeight: (height: number) => void;
  viewportHeightShared: SharedValue<number>;
  computeTargetDate: (originalDate: Date, translationY: number) => Date;
  updateCurrentOffset: (y: number) => void;
  undo: () => Promise<void>;
};

const DragContext = React.createContext<DragContextValue | undefined>(
  undefined
);

type Props = { children: React.ReactNode };

type UndoState =
  | {
      type: 'task';
      id: string;
      previousDueAtLocal: string;
      previousTimezone: string;
      timeoutId: ReturnType<typeof setTimeout>;
    }
  | undefined;

export function shouldAutoScroll(
  y: number,
  viewportHeight: number,
  edgeThreshold: number
): -1 | 0 | 1 {
  if (viewportHeight <= 0) return 0;
  if (y < edgeThreshold) return -1;
  if (y > viewportHeight - edgeThreshold) return 1;
  return 0;
}

// Helper to detect tasks that are synthesized occurrences without a DB row
function isEphemeralTask(task: Task): boolean {
  const hasSeriesLikeId =
    typeof task.id === 'string' && task.id.startsWith('series:');
  const flaggedEphemeral = Boolean(
    task.metadata &&
      typeof task.metadata === 'object' &&
      'ephemeral' in task.metadata
      ? (task.metadata as { ephemeral?: boolean }).ephemeral
      : false
  );
  return hasSeriesLikeId || flaggedEphemeral;
}

// Constants
// Calendar layout constants
const DAY_PX = 80; // Height of each day row in pixels for drag calculations
const UNDO_TIMEOUT_MS = 5000; // 5 seconds window for undo operations
const AUTO_SCROLL_EDGE_THRESHOLD = 60;
const AUTO_SCROLL_STEP = 24;

// Custom hooks for modular state management
function useDragState() {
  const [isDragging, setIsDragging] = React.useState<boolean>(false);
  const draggedTaskRef = React.useRef<Task | undefined>(undefined);

  const startDrag = React.useCallback((task: Task) => {
    draggedTaskRef.current = task;
    setIsDragging(true);
    Vibration.vibrate(10);
  }, []);

  const cancelDrag = React.useCallback(() => {
    setIsDragging(false);
    draggedTaskRef.current = undefined;
  }, []);

  return {
    isDragging,
    draggedTask: draggedTaskRef.current,
    draggedTaskRef,
    startDrag,
    cancelDrag,
  };
}

function useListRefs(): {
  listRef: React.RefObject<ScrollableListRef>;
  currentScrollOffsetRef: React.RefObject<number>;
  viewportHeightRef: React.RefObject<number>;
  viewportHeightShared: SharedValue<number>;
  registerListRef: (ref: React.RefObject<ScrollableListRef>) => void;
  registerViewportHeight: (height: number) => void;
  updateCurrentOffset: (y: number) => void;
} {
  const listRef = React.useRef<ScrollableListRef>(null);
  const currentScrollOffsetRef = React.useRef<number>(0);
  const viewportHeightRef = React.useRef<number>(0);
  const viewportHeightShared = useSharedValue(0);

  const registerListRef = React.useCallback(
    (ref: React.RefObject<ScrollableListRef>): void => {
      listRef.current = ref.current;
    },
    []
  );

  const registerViewportHeight = React.useCallback(
    (height: number): void => {
      viewportHeightRef.current = height;
      viewportHeightShared.value = height;
    },
    [viewportHeightShared]
  );

  const updateCurrentOffset = React.useCallback((y: number): void => {
    currentScrollOffsetRef.current = y;
  }, []);

  return {
    listRef,
    currentScrollOffsetRef,
    viewportHeightRef,
    viewportHeightShared,
    registerListRef,
    registerViewportHeight,
    updateCurrentOffset,
  };
}

function useUndoState() {
  const undoRef = React.useRef<UndoState>(undefined);

  const performUndo = React.useCallback(async () => {
    const snapshot = undoRef.current;
    undoRef.current = undefined;
    if (!snapshot) return;
    if (snapshot.type === 'task') {
      clearTimeout(snapshot.timeoutId);
      await updateTask(snapshot.id, {
        dueAtLocal: snapshot.previousDueAtLocal,
        timezone: snapshot.previousTimezone,
      });
    }
  }, []);

  return {
    undoRef,
    performUndo,
  };
}

function useScrolling(
  listRef: React.RefObject<ScrollableListRef>,
  currentScrollOffsetRef: React.RefObject<number>,
  viewportHeightRef: React.RefObject<number>
) {
  const onDragUpdate = React.useCallback(
    (y: number) => {
      const dir = shouldAutoScroll(
        y,
        viewportHeightRef.current,
        AUTO_SCROLL_EDGE_THRESHOLD
      );
      if (dir === 0) return undefined;

      const ref = listRef.current;
      if (!ref || typeof ref.scrollToOffset !== 'function') return undefined;

      // Get current offset directly from the ref to avoid dependency mutation
      const currentOffset = currentScrollOffsetRef.current;
      const next = Math.max(0, currentOffset + dir * AUTO_SCROLL_STEP);
      ref.scrollToOffset({ offset: next, animated: false });

      // Return the new offset for the caller to update the ref
      // This avoids direct mutation inside the callback
      return next;
    },
    [listRef, viewportHeightRef, currentScrollOffsetRef]
  );

  return {
    onDragUpdate,
  };
}

/**
 * Hook that provides date calculation logic for drag operations.
 * Converts vertical translation into date changes by calculating how many days
 * the user has dragged the task item.
 *
 * @returns Function that computes target date based on original date and vertical translation
 */
function useComputeTargetDate() {
  return React.useCallback((originalDate: Date, translationY: number) => {
    // Calculate how many days to shift based on drag distance
    // DAY_PX represents pixels per day in the calendar view
    const dayDelta = Math.round(translationY / DAY_PX);

    // Create new date by adding the day delta to the original date
    // Preserves year, month, and adjusts date by the calculated delta
    return new Date(
      originalDate.getFullYear(),
      originalDate.getMonth(),
      originalDate.getDate() + dayDelta
    );
  }, []);
}

/**
 * Hook that creates undo state objects for task operations.
 * Stores the previous state of a task before modification to enable undo functionality.
 *
 * @returns Function that creates an undo state object with task's previous values
 */
function useCreateUndoState() {
  return React.useCallback(
    (task: Task, timeoutId: ReturnType<typeof setTimeout>) => ({
      type: 'task' as const,
      id: task.id,
      // Store the original due date and timezone for undo purposes
      previousDueAtLocal: task.dueAtLocal,
      previousTimezone: task.timezone,
      // Store timeout ID to clear the undo window when needed
      timeoutId,
    }),
    []
  );
}

/**
 * Hook that handles the core task update logic during drag operations.
 * Combines the target date (where user dragged to) with the original task's time
 * to create a new due date, then updates the task in the database.
 *
 * @returns Function that updates a task's due date based on drag target
 */
function useTaskUpdate() {
  return React.useCallback(
    async (task: Task, targetDate: Date, _scope: DragScope) => {
      // Parse the original task's due date to extract time components
      const prev = new Date(task.dueAtLocal);

      // Create new date by combining target date with original time in the task's timezone
      // This preserves the time of day while changing the date, handling DST safely
      const result: DateCombinationResult = combineTargetDateWithTime(
        targetDate,
        prev,
        task.timezone
      );

      // If the task is part of a series, record an occurrence-level reschedule override
      if (task.seriesId) {
        await rescheduleRecurringInstance(
          task.seriesId,
          new Date(task.dueAtLocal),
          result.localDateTime.toISO()!
        );
      }

      // If this is an ephemeral synthesized occurrence, do not attempt to
      // update a non-existent DB row. Rely on the override above and return.
      if (isEphemeralTask(task)) {
        return { task, next: result.localDateTime.toJSDate() };
      }

      // Update the task in the database with new due dates (both local and UTC)
      await updateTask(task.id, {
        dueAtLocal: result.localDateTime.toISO()!,
        dueAtUtc: result.utcDateTime.toISO()!,
        timezone: task.timezone, // Preserve original timezone
      });

      // Return updated task and new local datetime for undo functionality
      return { task, next: result.localDateTime.toJSDate() };
    },
    []
  );
}

/**
 * Hook that orchestrates the complete drop operation for dragged tasks.
 * Handles updating the task, creating undo state, showing feedback messages,
 * and managing the undo timeout window.
 *
 * @param options - Configuration object containing required dependencies
 * @returns Object containing the drop completion handler
 */
// Helper function to show undo message
function showUndoMessage(performUndo: () => Promise<void>) {
  showMessage({
    message: 'Task moved',
    description: 'Tap to undo within 5 seconds',
    type: 'info',
    duration: UNDO_TIMEOUT_MS,
    onPress: () => {
      void performUndo(); // Execute undo if user taps the message
    },
  });
}

// Helper function to setup undo state
function setupUndoState(
  undoRef: React.RefObject<UndoState>,
  updatedTask: Task,
  createUndoState: (
    task: Task,
    timeoutId: ReturnType<typeof setTimeout>
  ) => UndoState
) {
  // Clear any existing timeout to prevent premature cleanup
  if (undoRef.current?.timeoutId) {
    clearTimeout(undoRef.current.timeoutId);
  }

  // Set up automatic cleanup of undo state after timeout
  const cleanupUndoState = () => {
    undoRef.current = undefined;
  };
  const timeoutId = setTimeout(cleanupUndoState, UNDO_TIMEOUT_MS);

  // Create and store undo state for potential rollback
  const undoState = createUndoState(updatedTask, timeoutId);
  undoRef.current = undoState;

  return timeoutId;
}

function useDropCompletion(options: {
  draggedTaskRef: React.RefObject<Task | undefined>;
  undoRef: React.RefObject<UndoState>;
  performUndo: () => Promise<void>;
  onDropComplete: () => void;
}) {
  const { draggedTaskRef, undoRef, performUndo, onDropComplete } = options;
  const createUndoState = useCreateUndoState();
  const updateTaskData = useTaskUpdate();

  const performDropCompletion = React.useCallback(
    async (dropOptions: { targetDate: Date; scope: DragScope }) => {
      const task = draggedTaskRef.current;
      if (!task) return false;

      try {
        const { task: updatedTask } = await updateTaskData(
          task,
          dropOptions.targetDate,
          dropOptions.scope
        );

        // Skip undo and toast for ephemeral synthesized occurrences
        if (!isEphemeralTask(updatedTask)) {
          setupUndoState(undoRef, updatedTask, createUndoState);
          showUndoMessage(performUndo);
        }

        return true;
      } catch (error) {
        console.error('Failed to update task during drop completion:', error);
        showErrorMessage('Failed to move task. Please try again.');
        return false;
      } finally {
        onDropComplete();
      }
    },
    [
      draggedTaskRef,
      performUndo,
      createUndoState,
      updateTaskData,
      undoRef,
      onDropComplete,
    ]
  );

  return { performDropCompletion };
}

// Hook to manage undo cleanup effect
function useUndoCleanup(undoRef: React.RefObject<UndoState>) {
  React.useEffect(() => {
    const currentUndoState = undoRef.current;
    return () => {
      if (currentUndoState) clearTimeout(currentUndoState.timeoutId);
    };
  }, [undoRef]);
}

// Hook to create the context value object
function useContextValue(options: {
  isDragging: boolean;
  draggedTask: Task | undefined;
  startDrag: (task: Task) => void;
  cancelDrag: () => void;
  completeDrop: (targetDate: Date, scope: DragScope) => Promise<void>;
  onDragUpdate: (y: number) => number | undefined;
  registerListRef: (ref: React.RefObject<ScrollableListRef>) => void;
  registerViewportHeight: (height: number) => void;
  viewportHeightShared: SharedValue<number>;
  computeTargetDate: (originalDate: Date, translationY: number) => Date;
  updateCurrentOffset: (y: number) => void;
  performUndo: () => Promise<void>;
}): DragContextValue {
  const {
    isDragging,
    draggedTask,
    startDrag,
    cancelDrag,
    completeDrop,
    onDragUpdate,
    registerListRef,
    registerViewportHeight,
    viewportHeightShared,
    computeTargetDate,
    updateCurrentOffset,
    performUndo,
  } = options;

  return React.useMemo(
    () => ({
      isDragging,
      draggedTask,
      startDrag,
      cancelDrag,
      completeDrop,
      onDragUpdate,
      registerListRef,
      registerViewportHeight,
      viewportHeightShared,
      computeTargetDate,
      updateCurrentOffset,
      undo: performUndo,
    }),
    [
      isDragging,
      draggedTask,
      startDrag,
      cancelDrag,
      completeDrop,
      onDragUpdate,
      registerListRef,
      registerViewportHeight,
      viewportHeightShared,
      computeTargetDate,
      updateCurrentOffset,
      performUndo,
    ]
  );
}

function useDragDropContextValue(): DragContextValue {
  const { isDragging, draggedTask, draggedTaskRef, startDrag, cancelDrag } =
    useDragState();
  const {
    listRef,
    currentScrollOffsetRef,
    viewportHeightRef,
    registerListRef,
    registerViewportHeight,
    viewportHeightShared,
    updateCurrentOffset,
  } = useListRefs();
  const { undoRef, performUndo } = useUndoState();
  const { onDragUpdate } = useScrolling(
    listRef,
    currentScrollOffsetRef,
    viewportHeightRef
  );
  const computeTargetDate = useComputeTargetDate();

  const { performDropCompletion } = useDropCompletion({
    draggedTaskRef,
    undoRef,
    performUndo,
    onDropComplete: cancelDrag,
  });

  const completeDrop = React.useCallback(
    async (targetDate: Date, scope: DragScope) => {
      await performDropCompletion({ targetDate, scope });
    },
    [performDropCompletion]
  );

  useUndoCleanup(undoRef);

  return useContextValue({
    isDragging,
    draggedTask,
    startDrag,
    cancelDrag,
    completeDrop,
    onDragUpdate,
    registerListRef,
    registerViewportHeight,
    viewportHeightShared,
    computeTargetDate,
    updateCurrentOffset,
    performUndo,
  });
}

export function DragDropProvider({ children }: Props): React.ReactElement {
  const value = useDragDropContextValue();
  return <DragContext.Provider value={value}>{children}</DragContext.Provider>;
}

export function useDragDrop(): DragContextValue {
  const ctx = React.useContext(DragContext);
  if (!ctx) {
    // In test environments, return a no-op context to simplify unit tests
    const globalWithJest = globalThis as { jest?: unknown };
    if (typeof globalWithJest.jest !== 'undefined') {
      return {
        isDragging: false,
        draggedTask: undefined,
        startDrag: () => {},
        cancelDrag: () => {},
        completeDrop: async () => {},
        onDragUpdate: () => undefined,
        registerListRef: () => {},
        registerViewportHeight: () => {},
        viewportHeightShared: { value: 0 },
        computeTargetDate: (d: Date) => d,
        updateCurrentOffset: () => {},
        undo: async () => {},
      } satisfies DragContextValue;
    }
    throw new Error('useDragDrop must be used within DragDropProvider');
  }
  return ctx;
}

export function useRegisterScrollHandlers(): {
  listRef: React.RefObject<ScrollableListRef>;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onLayout: (e: { nativeEvent: { layout: { height: number } } }) => void;
} {
  const { registerListRef, registerViewportHeight, updateCurrentOffset } =
    useDragDrop();
  const listRef = React.useRef<ScrollableListRef>(null);

  React.useEffect(() => {
    registerListRef(listRef);
  }, [registerListRef]);

  const onScroll = React.useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = e?.nativeEvent?.contentOffset?.y ?? 0;
      updateCurrentOffset(offset);
    },
    [updateCurrentOffset]
  );

  const onLayout = React.useCallback(
    (e: { nativeEvent: { layout: { height: number } } }) => {
      const h = e?.nativeEvent?.layout?.height ?? 0;
      registerViewportHeight(h);
    },
    [registerViewportHeight]
  );

  return { listRef, onScroll, onLayout };
}
