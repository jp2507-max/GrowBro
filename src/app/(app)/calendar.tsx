import { DateTime } from 'luxon';
import React, { useCallback, useMemo } from 'react';
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

// -----------------------------------------------------------------------------
// Hook: useDayTasks
// -----------------------------------------------------------------------------

function useDayTasks(selectedDate: DateTime): {
  pendingTasks: Task[];
  completedTasks: Task[];
  plantMap: Map<string, PlantInfo>;
  isLoading: boolean;
  refetch: () => Promise<void>;
} {
  const [pendingTasks, setPendingTasks] = React.useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = React.useState<Task[]>([]);
  const [plantMap, setPlantMap] = React.useState<Map<string, PlantInfo>>(
    new Map()
  );
  const [isLoading, setIsLoading] = React.useState(true);

  const loadTasks = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const startOfDay = selectedDate.startOf('day').toJSDate();
      const endOfDay = selectedDate.endOf('day').toJSDate();

      const [pending, completed] = await Promise.all([
        getTasksByDateRange(startOfDay, endOfDay),
        getCompletedTasksByDateRange(startOfDay, endOfDay),
      ]);

      // Collect unique plant IDs from all tasks
      const plantIds = new Set<string>();
      for (const task of [...pending, ...completed]) {
        if (task.plantId) {
          plantIds.add(task.plantId);
        }
      }

      // Fetch plant info for all relevant plant IDs
      const newPlantMap = new Map<string, PlantInfo>();
      if (plantIds.size > 0) {
        const plantsCollection = database.get<PlantModel>('plants');
        const plantIdsArray = Array.from(plantIds);

        // Fetch plants in parallel batches
        const plantPromises = plantIdsArray.map(async (id) => {
          try {
            const plant = await plantsCollection.find(id);
            return {
              id: plant.id,
              name: plant.name,
              imageUrl: plant.imageUrl,
            };
          } catch {
            // Plant not found, skip
            return null;
          }
        });

        const plants = await Promise.all(plantPromises);
        for (const plant of plants) {
          if (plant) {
            newPlantMap.set(plant.id, plant);
          }
        }
      }

      setPendingTasks(pending);
      setCompletedTasks(completed);
      setPlantMap(newPlantMap);
    } catch (error) {
      console.warn('[CalendarScreen] Failed to load tasks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  React.useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  return {
    pendingTasks,
    completedTasks,
    plantMap,
    isLoading,
    refetch: loadTasks,
  };
}

// -----------------------------------------------------------------------------
// Main Screen Component
// -----------------------------------------------------------------------------

export default function CalendarScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { grossHeight } = useBottomTabBarHeight();
  const [selectedDate, setSelectedDate] = React.useState<DateTime>(
    DateTime.now().startOf('day')
  );

  const { pendingTasks, completedTasks, plantMap, isLoading, refetch } =
    useDayTasks(selectedDate);

  // Task detail modal state
  const taskDetailModal = useTaskDetailModal();
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);

  // Build task counts map for the current week (for indicators)
  const taskCounts = useMemo(() => {
    const counts = new Map<string, number>();
    // For now, just count tasks for the selected date
    // In production, you'd fetch counts for the entire week
    const dateKey = selectedDate.toFormat('yyyy-MM-dd');
    counts.set(dateKey, pendingTasks.length + completedTasks.length);
    return counts;
  }, [selectedDate, pendingTasks, completedTasks]);

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
      taskDetailModal.present();
    },
    [taskDetailModal]
  );

  const handleModalDismiss = useCallback(() => {
    setSelectedTask(null);
  }, []);

  const listData = useMemo(
    () =>
      buildCalendarListData({
        pendingTasks,
        completedTasks,
        isLoading,
        plantMap,
      }),
    [pendingTasks, completedTasks, isLoading, plantMap]
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
        modalRef={taskDetailModal.ref}
        task={selectedTask}
        onComplete={handleCompleteTask}
        onDismiss={handleModalDismiss}
      />
    </View>
  );
}
