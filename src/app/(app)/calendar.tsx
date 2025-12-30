import { DateTime } from 'luxon';
import React, { useCallback, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarHeader } from '@/components/calendar/calendar-header';
import {
  buildCalendarListData,
  createRenderItem,
  getItemKey,
  getItemType,
} from '@/components/calendar/calendar-list-items';
import { FocusAwareStatusBar, List, View } from '@/components/ui';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';
import {
  completeRecurringInstance,
  completeTask,
  getCompletedTasksByDateRange,
  getTasksByDateRange,
} from '@/lib/task-manager';
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
  isLoading: boolean;
  refetch: () => Promise<void>;
} {
  const [pendingTasks, setPendingTasks] = React.useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = React.useState<Task[]>([]);
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

      setPendingTasks(pending);
      setCompletedTasks(completed);
    } catch (error) {
      console.warn('[CalendarScreen] Failed to load tasks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  React.useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  return { pendingTasks, completedTasks, isLoading, refetch: loadTasks };
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

  const { pendingTasks, completedTasks, isLoading, refetch } =
    useDayTasks(selectedDate);

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
              zone: task.timezone,
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

  const listData = useMemo(
    () => buildCalendarListData(pendingTasks, completedTasks, isLoading),
    [pendingTasks, completedTasks, isLoading]
  );

  const renderItem = useMemo(
    () => createRenderItem(handleCompleteTask),
    [handleCompleteTask]
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
    </View>
  );
}
