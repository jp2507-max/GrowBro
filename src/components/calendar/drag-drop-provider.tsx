import React from 'react';
import { Vibration } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import { updateTask } from '@/lib/task-manager';
import type { Task } from '@/types/calendar';

type DragScope = 'occurrence' | 'series';

type DragContextValue = {
  isDragging: boolean;
  draggedTask?: Task;
  startDrag: (task: Task) => void;
  cancelDrag: () => void;
  completeDrop: (targetDate: Date, scope: DragScope) => Promise<void>;
  onDragUpdate: (y: number) => void;
  registerListRef: (ref: React.RefObject<any>) => void;
  registerViewportHeight: (height: number) => void;
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
      timeoutId: any;
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

// Constants
const DAY_PX = 80;
const UNDO_TIMEOUT_MS = 5000;
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

function useListRefs() {
  const listRef = React.useRef<any | null>(null);
  const currentScrollOffsetRef = React.useRef<number>(0);
  const viewportHeightRef = React.useRef<number>(0);

  const registerListRef = React.useCallback((ref: React.RefObject<any>) => {
    listRef.current = ref.current;
  }, []);

  const registerViewportHeight = React.useCallback((height: number) => {
    viewportHeightRef.current = height;
  }, []);

  const updateCurrentOffset = React.useCallback((y: number) => {
    currentScrollOffsetRef.current = y;
  }, []);

  return {
    listRef,
    currentScrollOffsetRef,
    viewportHeightRef,
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
  listRef: React.RefObject<any>,
  currentScrollOffsetRef: React.RefObject<number>,
  viewportHeightRef: React.RefObject<number>
) {
  const scrollBy = React.useCallback(
    (delta: number) => {
      const ref = listRef.current as any;
      if (!ref || typeof (ref as any).scrollToOffset !== 'function') return;
      const current = currentScrollOffsetRef.current;
      const next = Math.max(0, current + delta);
      (ref as any).scrollToOffset({ offset: next, animated: false });
      currentScrollOffsetRef.current = next;
    },
    [listRef, currentScrollOffsetRef]
  );

  const onDragUpdate = React.useCallback(
    (y: number) => {
      const dir = shouldAutoScroll(
        y,
        viewportHeightRef.current,
        AUTO_SCROLL_EDGE_THRESHOLD
      );
      if (dir === 0) return;
      scrollBy(dir * AUTO_SCROLL_STEP);
    },
    [scrollBy, viewportHeightRef]
  );

  return {
    scrollBy,
    onDragUpdate,
  };
}

function useDropCompletion(
  draggedTaskRef: React.RefObject<Task | undefined>,
  undoRef: React.RefObject<UndoState>,
  performUndo: () => Promise<void>,
  setIsDragging: (isDragging: boolean) => void
) {
  const computeTargetDate = React.useCallback(
    (originalDate: Date, translationY: number) => {
      const dayDelta = Math.round(translationY / DAY_PX);
      return new Date(
        originalDate.getFullYear(),
        originalDate.getMonth(),
        originalDate.getDate() + dayDelta
      );
    },
    []
  );

  const completeDrop = React.useCallback(
    async (targetDate: Date, scope: DragScope) => {
      const task = draggedTaskRef.current;
      if (!task) return;

      const previousDue = task.dueAtLocal;
      const previousTz = task.timezone;
      const prev = new Date(previousDue);
      const next = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate(),
        prev.getHours(),
        prev.getMinutes(),
        prev.getSeconds(),
        prev.getMilliseconds()
      );

      if (scope === 'series' && task.seriesId) {
        // Series-wide shifting to be implemented with overrides; fallback to occurrence-level.
      }

      await updateTask(task.id, {
        dueAtLocal: next.toISOString(),
        timezone: task.timezone,
      });

      const timeoutId = setTimeout(() => {
        undoRef.current = undefined;
      }, UNDO_TIMEOUT_MS);
      undoRef.current = {
        type: 'task',
        id: task.id,
        previousDueAtLocal: previousDue,
        previousTimezone: previousTz,
        timeoutId,
      };

      showMessage({
        message: 'Task moved',
        description: 'Tap to undo within 5 seconds',
        type: 'info',
        duration: UNDO_TIMEOUT_MS,
        onPress: () => {
          void performUndo();
        },
      });

      setIsDragging(false);
      draggedTaskRef.current = undefined;
    },
    [draggedTaskRef, undoRef, performUndo, setIsDragging]
  );

  return {
    computeTargetDate,
    completeDrop,
  };
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
    updateCurrentOffset,
  } = useListRefs();
  const { undoRef, performUndo } = useUndoState();
  const { scrollBy, onDragUpdate } = useScrolling(
    listRef,
    currentScrollOffsetRef,
    viewportHeightRef
  );
  const { computeTargetDate, completeDrop } = useDropCompletion(
    draggedTaskRef,
    undoRef,
    performUndo,
    (isDragging: boolean) => {
      if (!isDragging) {
        draggedTaskRef.current = undefined;
      }
    }
  );

  React.useEffect(() => {
    return () => {
      const snapshot = undoRef.current;
      if (snapshot) clearTimeout((snapshot as any).timeoutId);
    };
  }, [undoRef]);

  const value: DragContextValue = React.useMemo(
    () => ({
      isDragging,
      draggedTask,
      startDrag,
      cancelDrag,
      completeDrop,
      onDragUpdate,
      registerListRef,
      registerViewportHeight,
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
      computeTargetDate,
      updateCurrentOffset,
      performUndo,
    ]
  );

  return value;
}

export function DragDropProvider({ children }: Props): React.ReactElement {
  const value = useDragDropContextValue();
  return <DragContext.Provider value={value}>{children}</DragContext.Provider>;
}

export function useDragDrop(): DragContextValue {
  const ctx = React.useContext(DragContext);
  if (!ctx) throw new Error('useDragDrop must be used within DragDropProvider');
  return ctx;
}

export function useRegisterScrollHandlers(): {
  listRef: React.RefObject<any>;
  onScroll: (e: any) => void;
  onLayout: (e: any) => void;
} {
  const { registerListRef, registerViewportHeight, updateCurrentOffset } =
    useDragDrop();
  const listRef = React.useRef<any>(null);

  React.useEffect(() => {
    registerListRef(listRef);
  }, [registerListRef]);

  const onScroll = React.useCallback(
    (e: any) => {
      const offset = e?.nativeEvent?.contentOffset?.y ?? 0;
      updateCurrentOffset(offset);
    },
    [updateCurrentOffset]
  );

  const onLayout = React.useCallback(
    (e: any) => {
      const h = e?.nativeEvent?.layout?.height ?? 0;
      registerViewportHeight(h);
    },
    [registerViewportHeight]
  );

  return { listRef, onScroll, onLayout };
}
