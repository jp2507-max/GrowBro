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
  setAutoScrollDirection: (dir: -1 | 0 | 1) => void;
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
const AUTO_SCROLL_STEP = 24;
const AUTO_SCROLL_INTERVAL_MS = 32;

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
  viewportHeightShared: SharedValue<number>;
  getCurrentOffset: () => number;
  registerListRef: (ref: React.RefObject<ScrollableListRef>) => void;
  registerViewportHeight: (height: number) => void;
  updateCurrentOffset: (y: number) => void;
} {
  const listRef = React.useRef<ScrollableListRef>(null);
  const currentScrollOffsetRef = React.useRef<number>(0);
  const viewportHeightShared = useSharedValue(0);

  const getCurrentOffset = React.useCallback(() => {
    return currentScrollOffsetRef.current;
  }, []);

  const registerListRef = React.useCallback(
    (ref: React.RefObject<ScrollableListRef>): void => {
      listRef.current = ref.current;
    },
    []
  );

  const registerViewportHeight = React.useCallback(
    (height: number): void => {
      viewportHeightShared.set(height);
    },
    [viewportHeightShared]
  );

  const updateCurrentOffset = React.useCallback((y: number): void => {
    currentScrollOffsetRef.current = y;
  }, []);

  return {
    listRef,
    currentScrollOffsetRef,
    viewportHeightShared,
    getCurrentOffset,
    registerListRef,
    registerViewportHeight,
    updateCurrentOffset,
  };
}

function useUndoState() {
  const undoRef = React.useRef<UndoState>(undefined);

  const clearUndoTimeout = React.useCallback(() => {
    const timeoutId = undoRef.current?.timeoutId;
    if (timeoutId) clearTimeout(timeoutId);
  }, []);

  const clearUndoState = React.useCallback(() => {
    undoRef.current = undefined;
  }, []);

  const setUndoState = React.useCallback((next: UndoState) => {
    undoRef.current = next;
  }, []);

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

  React.useEffect(
    () => () => {
      const timeoutId = undoRef.current?.timeoutId;
      if (timeoutId) clearTimeout(timeoutId);
    },
    []
  );

  return {
    performUndo,
    clearUndoTimeout,
    clearUndoState,
    setUndoState,
  };
}

function useScrolling(
  listRef: React.RefObject<ScrollableListRef>,
  getCurrentOffset: () => number,
  updateCurrentOffset: (y: number) => void
) {
  const autoScrollDirRef = React.useRef<-1 | 0 | 1>(0);
  const autoScrollIntervalRef = React.useRef<ReturnType<
    typeof setInterval
  > | null>(null);

  const tickAutoScroll = React.useCallback(() => {
    const dir = autoScrollDirRef.current;
    if (dir === 0) return;
    const ref = listRef.current;
    if (!ref || typeof ref.scrollToOffset !== 'function') return;

    const currentOffset = getCurrentOffset();
    const next = Math.max(0, currentOffset + dir * AUTO_SCROLL_STEP);
    ref.scrollToOffset({ offset: next, animated: false });
    updateCurrentOffset(next);
  }, [getCurrentOffset, listRef, updateCurrentOffset]);

  const startAutoScroll = React.useCallback(
    (dir: -1 | 1) => {
      autoScrollDirRef.current = dir;
      if (autoScrollIntervalRef.current) return;
      autoScrollIntervalRef.current = setInterval(
        tickAutoScroll,
        AUTO_SCROLL_INTERVAL_MS
      );
    },
    [tickAutoScroll]
  );

  const stopAutoScroll = React.useCallback(() => {
    autoScrollDirRef.current = 0;
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
  }, []);

  const setAutoScrollDirection = React.useCallback(
    (dir: -1 | 0 | 1) => {
      if (dir === 0) {
        stopAutoScroll();
        return;
      }
      startAutoScroll(dir);
    },
    [startAutoScroll, stopAutoScroll]
  );

  React.useEffect(
    () => () => {
      stopAutoScroll();
    },
    [stopAutoScroll]
  );

  return {
    setAutoScrollDirection,
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

function useDropCompletion(options: {
  draggedTaskRef: React.RefObject<Task | undefined>;
  performUndo: () => Promise<void>;
  onDropComplete: () => void;
  clearUndoTimeout: () => void;
  clearUndoState: () => void;
  setUndoState: (state: UndoState) => void;
}) {
  const {
    draggedTaskRef,
    performUndo,
    onDropComplete,
    clearUndoTimeout,
    clearUndoState,
    setUndoState,
  } = options;
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
          clearUndoTimeout();
          const timeoutId = setTimeout(() => {
            clearUndoState();
          }, UNDO_TIMEOUT_MS);
          setUndoState(createUndoState(updatedTask, timeoutId));
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
      onDropComplete,
      clearUndoTimeout,
      clearUndoState,
      setUndoState,
    ]
  );

  return { performDropCompletion };
}

// Hook to create the context value object
function useContextValue(options: {
  isDragging: boolean;
  draggedTask: Task | undefined;
  startDrag: (task: Task) => void;
  cancelDrag: () => void;
  completeDrop: (targetDate: Date, scope: DragScope) => Promise<void>;
  setAutoScrollDirection: (dir: -1 | 0 | 1) => void;
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
    setAutoScrollDirection,
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
      setAutoScrollDirection,
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
      setAutoScrollDirection,
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
    registerListRef,
    registerViewportHeight,
    viewportHeightShared,
    getCurrentOffset,
    updateCurrentOffset,
  } = useListRefs();
  const { performUndo, clearUndoTimeout, clearUndoState, setUndoState } =
    useUndoState();
  const { setAutoScrollDirection } = useScrolling(
    listRef,
    getCurrentOffset,
    updateCurrentOffset
  );
  const computeTargetDate = useComputeTargetDate();

  const { performDropCompletion } = useDropCompletion({
    draggedTaskRef,
    performUndo,
    onDropComplete: cancelDrag,
    clearUndoTimeout,
    clearUndoState,
    setUndoState,
  });

  const completeDrop = React.useCallback(
    async (targetDate: Date, scope: DragScope) => {
      await performDropCompletion({ targetDate, scope });
    },
    [performDropCompletion]
  );

  return useContextValue({
    isDragging,
    draggedTask,
    startDrag,
    cancelDrag,
    completeDrop,
    setAutoScrollDirection,
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
        setAutoScrollDirection: () => {},
        registerListRef: () => {},
        registerViewportHeight: () => {},
        viewportHeightShared: { value: 0, get: () => 0, set: () => {} },
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
