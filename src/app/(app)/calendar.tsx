import { Q } from '@nozbe/watermelondb';
import { DateTime } from 'luxon';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarHeader } from '@/components/calendar/calendar-header';
import type { PlantInfo } from '@/components/calendar/calendar-list-items';
import {
  buildCalendarListData,
  createRenderItem,
  getItemKey,
  getItemType,
} from '@/components/calendar/calendar-list-items';
import {
  TaskDetailModal,
  useTaskDetailModal,
} from '@/components/calendar/task-detail-modal';
import { FocusAwareStatusBar, List, View } from '@/components/ui';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';
import {
  completeRecurringInstance,
  completeTask,
  getCompletedTasksByDateRange,
  getTasksByDateRange,
} from '@/lib/task-manager';
import { database } from '@/lib/watermelon';
import type { PlantModel } from '@/lib/watermelon-models/plant';
import type { Task } from '@/types/calendar';

const BOTTOM_PADDING_EXTRA = 24;

// -----------------------------------------------------------------------------
// Utility functions
// -----------------------------------------------------------------------------

function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    return new Promise<ReturnType<T>>((resolve, reject) => {
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        try {
          const result = (await func(...args)) as ReturnType<T>;
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, wait);
    });
  };
}

function isEphemeralTask(task: Task): boolean {
  return task.id.startsWith('series:') || task.metadata?.ephemeral === true;
}

function parseEphemeralTaskInfo(
  taskId: string
): { seriesId: string; localDate: string } | null {
  if (!taskId.startsWith('series:')) return null;
  const parts = taskId.split(':');
  if (parts.length !== 3) return null;
  return { seriesId: parts[1], localDate: parts[2] };
}

async function fetchTasksForRange(start: Date, end: Date) {
  const [pending, completed] = await Promise.all([
    getTasksByDateRange(start, end),
    getCompletedTasksByDateRange(start, end),
  ]);
  return { pending, completed };
}

function filterTasksForDay(tasks: Task[], dayStart: DateTime): Task[] {
  const dayEnd = dayStart.endOf('day');
  return tasks.filter((task) => {
    const due = DateTime.fromISO(task.dueAtLocal);
    return due >= dayStart && due <= dayEnd;
  });
}

function getPlantIdsFromTasks(tasks: Task[]): string[] {
  const plantIds = new Set<string>();
  tasks.forEach((t) => {
    if (t.plantId) plantIds.add(t.plantId);
  });
  return Array.from(plantIds);
}

async function loadPlantMap(
  plantIds: string[]
): Promise<Map<string, PlantInfo>> {
  const newPlantMap = new Map<string, PlantInfo>();
  if (plantIds.length > 0) {
    const plantsCollection = database.get<PlantModel>('plants');
    const plants = await plantsCollection
      .query(Q.where('id', Q.oneOf(plantIds)))
      .fetch();

    plants.forEach((plant) => {
      newPlantMap.set(plant.id, {
        id: plant.id,
        name: plant.name,
        imageUrl: plant.imageUrl,
      });
    });
  }
  return newPlantMap;
}

function buildTaskCounts(tasks: Task[]): Map<string, number> {
  const counts = new Map<string, number>();
  tasks.forEach((task) => {
    const dateKey = DateTime.fromISO(task.dueAtLocal).toFormat('yyyy-MM-dd');
    counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1);
  });
  return counts;
}

/**
 * Hook to manage calendar data for a range of weeks and the selected day.
 * Fetches tasks for a 5-week range (indicator visibility) and plant info for the selected day.
 * @param selectedDate - The currently selected date
 * @returns Object containing pending/completed tasks, task counts, plant map, loading state, and refetch function
 */
function useCalendarData(selectedDate: DateTime): {
  dayPendingTasks: Task[];
  dayCompletedTasks: Task[];
  taskCounts: Map<string, number>;
  plantMap: Map<string, PlantInfo>;
  isLoading: boolean;
  refetch: () => Promise<void | Promise<void>>;
} {
  const [tasks, setTasks] = useState<{ pending: Task[]; completed: Task[] }>({
    pending: [],
    completed: [],
  });
  const [plantMap, setPlantMap] = useState<Map<string, PlantInfo>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Track the latest request ID to prevent race conditions
  const requestIdRef = useRef(0);

  // Derive primitive values for stable dependencies
  const selectedWeekMillis = selectedDate.startOf('week').toMillis();
  const selectedDayMillis = selectedDate.startOf('day').toMillis();

  // Range for indicators: 5 weeks (centered on selectedDate's week)
  const range = useMemo(() => {
    const weekStart = DateTime.fromMillis(selectedWeekMillis);
    return {
      start: weekStart.minus({ weeks: 2 }).startOf('day'),
      end: weekStart.plus({ weeks: 2 }).endOf('week').endOf('day'),
    };
  }, [selectedWeekMillis]);

  const rangeStartMillis = range.start.toMillis();
  const rangeEndMillis = range.end.toMillis();

  const loadData = useCallback(async () => {
    // Increment request ID for this new call
    const currentRequestId = ++requestIdRef.current;
    setIsLoading(true);

    try {
      const rStart = DateTime.fromMillis(rangeStartMillis);
      const rEnd = DateTime.fromMillis(rangeEndMillis);

      // 1. Fetch all tasks in the 5-week range
      const { pending, completed } = await fetchTasksForRange(
        rStart.toJSDate(),
        rEnd.toJSDate()
      );

      // If a newer request has started, ignore this result
      if (currentRequestId !== requestIdRef.current) return;

      setTasks({ pending, completed });

      // 2. Identify tasks for the SELECTED day to fetch plant info
      const dayStart = DateTime.fromMillis(selectedDayMillis);
      const dayTasks = [
        ...filterTasksForDay(pending, dayStart),
        ...filterTasksForDay(completed, dayStart),
      ];

      // 3. Fetch plant info efficiently
      const plantIds = getPlantIdsFromTasks(dayTasks);
      const newPlantMap = await loadPlantMap(plantIds);

      // Check again before setting secondary state
      if (currentRequestId !== requestIdRef.current) return;

      setPlantMap(newPlantMap);
    } catch (error) {
      if (currentRequestId === requestIdRef.current) {
        console.warn('[CalendarScreen] Failed to load calendar data:', error);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [rangeStartMillis, rangeEndMillis, selectedDayMillis]);

  // Debounced version of loadData to prevent redundant fetches during rapid date changes
  const debouncedLoadData = useMemo(() => debounce(loadData, 300), [loadData]);

  useEffect(() => {
    let cancelled = false;
    const requestIdAtMount = requestIdRef.current;

    const run = async () => {
      await debouncedLoadData();
      if (cancelled) {
        // prevent any follow-up state if you add more later
        return;
      }
    };

    run();
    return () => {
      cancelled = true;
      // increment the stored request ID to invalidate in-flight calls
      requestIdRef.current = requestIdAtMount + 1;
    };
  }, [debouncedLoadData]);

  // Memoize task counts separately from day filtering to avoid rebuilding on every selectedDay change
  const taskCounts = useMemo(
    () => buildTaskCounts([...tasks.pending, ...tasks.completed]),
    [tasks]
  );

  // Derive day-specific tasks
  const { dayPendingTasks, dayCompletedTasks } = useMemo(() => {
    const dayStart = DateTime.fromMillis(selectedDayMillis);

    return {
      dayPendingTasks: filterTasksForDay(tasks.pending, dayStart),
      dayCompletedTasks: filterTasksForDay(tasks.completed, dayStart),
    };
  }, [tasks.pending, tasks.completed, selectedDayMillis]);

  return {
    dayPendingTasks,
    dayCompletedTasks,
    taskCounts,
    plantMap,
    isLoading,
    refetch: debouncedLoadData,
  };
}

// -----------------------------------------------------------------------------
// Main Screen Component
// -----------------------------------------------------------------------------

export default function CalendarScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { grossHeight } = useBottomTabBarHeight();
  const [selectedDate, setSelectedDate] = useState<DateTime>(
    DateTime.now().startOf('day')
  );

  const {
    dayPendingTasks,
    dayCompletedTasks,
    taskCounts,
    plantMap,
    isLoading,
    refetch,
  } = useCalendarData(selectedDate);

  // Task detail modal state
  const { ref: taskDetailModalRef, present: presentTaskDetail } =
    useTaskDetailModal();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const onDateSelect = useCallback((date: DateTime) => {
    setSelectedDate(date.startOf('day'));
  }, []);

  const handleCompleteTask = useCallback(
    async (task: Task) => {
      try {
        if (isEphemeralTask(task)) {
          const info = parseEphemeralTaskInfo(task.id);
          if (info) {
            const occurrenceDate = DateTime.fromISO(info.localDate, {
              zone: task.timezone || 'UTC',
            }).toJSDate();
            await completeRecurringInstance(info.seriesId, occurrenceDate);
          } else {
            await completeTask(task.id);
          }
        } else {
          await completeTask(task.id);
        }
        await refetch();
      } catch (error) {
        console.error('[CalendarScreen] Failed to complete task:', error);
      }
    },
    [refetch]
  );

  const handleTaskPress = useCallback(
    (task: Task) => {
      setSelectedTask(task);
      presentTaskDetail();
    },
    [presentTaskDetail]
  );

  const handleModalDismiss = useCallback(() => {
    setSelectedTask(null);
  }, []);

  const listData = useMemo(
    () =>
      buildCalendarListData({
        pendingTasks: dayPendingTasks,
        completedTasks: dayCompletedTasks,
        isLoading,
        plantMap,
      }),
    [dayPendingTasks, dayCompletedTasks, isLoading, plantMap]
  );

  const renderItem = useMemo(
    () => createRenderItem(handleCompleteTask, handleTaskPress),
    [handleCompleteTask, handleTaskPress]
  );

  const contentContainerStyle = useMemo(
    () => ({
      paddingBottom: grossHeight + BOTTOM_PADDING_EXTRA,
      paddingHorizontal: 16,
      gap: 8,
    }),
    [grossHeight]
  );

  return (
    <View
      className="flex-1 bg-neutral-50 dark:bg-charcoal-950"
      testID="calendar-screen"
    >
      <FocusAwareStatusBar />
      <CalendarHeader
        selectedDate={selectedDate}
        onDateSelect={onDateSelect}
        insets={insets}
        taskCounts={taskCounts}
      />

      <List
        data={listData}
        renderItem={renderItem}
        keyExtractor={getItemKey}
        getItemType={getItemType}
        contentContainerStyle={contentContainerStyle}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        modalRef={taskDetailModalRef}
        task={selectedTask}
        onComplete={handleCompleteTask}
        onDismiss={handleModalDismiss}
      />
    </View>
  );
}
