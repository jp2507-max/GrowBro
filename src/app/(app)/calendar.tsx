import { DateTime } from 'luxon';
import React, { useCallback } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarHeader } from '@/components/calendar/calendar-header';
import { DayTaskRow } from '@/components/calendar/day-task-row';
import {
  ActivityIndicator,
  FocusAwareStatusBar,
  Text,
  View,
} from '@/components/ui';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';
import { translate } from '@/lib/i18n';
import type { TxKeyPath } from '@/lib/i18n/utils';
import {
  completeRecurringInstance,
  completeTask,
  getCompletedTasksByDateRange,
  getTasksByDateRange,
} from '@/lib/task-manager';
import type { Task } from '@/types/calendar';

const BOTTOM_PADDING_EXTRA = 24;

function useDayTasks(selectedDate: DateTime) {
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

function SectionHeader({
  title,
  count,
  testID,
}: {
  title: string;
  count: number;
  testID?: string;
}): React.ReactElement {
  return (
    <View
      className="flex-row items-center justify-between py-2"
      testID={testID}
    >
      <Text className="text-lg font-bold text-charcoal-900 dark:text-neutral-100">
        {title}
      </Text>
      <View className="rounded-full bg-neutral-200 px-2 py-0.5 dark:bg-neutral-700">
        <Text className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
          {count}
        </Text>
      </View>
    </View>
  );
}

function EmptyState({ message }: { message: string }): React.ReactElement {
  return (
    <View className="items-center justify-center py-8">
      <Text className="text-text-secondary text-base">{message}</Text>
    </View>
  );
}

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
            // Parse localDate in the series/task timezone to avoid day-shift when device timezone differs
            const occurrenceDate = DateTime.fromISO(info.localDate, {
              zone: task.timezone,
            }).toJSDate();
            await completeRecurringInstance(info.seriesId, occurrenceDate);
          } else {
            // Fallback: ephemeral task without valid series info
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

  const contentPaddingBottom = React.useMemo(
    () => ({ paddingBottom: grossHeight + BOTTOM_PADDING_EXTRA }),
    [grossHeight]
  );

  const planTitle = translate('calendar.sections.plan' as TxKeyPath);
  const historyTitle = translate('calendar.sections.history' as TxKeyPath);
  const emptyPlanMessage = translate(
    'calendar.sections.empty_plan' as TxKeyPath
  );
  const emptyHistoryMessage = translate(
    'calendar.sections.empty_history' as TxKeyPath
  );

  return (
    <View
      className="flex-1 bg-neutral-50 dark:bg-charcoal-950"
      testID="calendar-screen"
    >
      <CalendarHeader
        selectedDate={selectedDate}
        onDateSelect={onDateSelect}
        insets={insets}
      />
      <FocusAwareStatusBar />

      <ScrollView
        contentContainerStyle={contentPaddingBottom}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-4 p-4">
          {/* Plan Section - Pending Tasks */}
          <View>
            <SectionHeader
              title={planTitle}
              count={pendingTasks.length}
              testID="calendar-plan-section-header"
            />
            {isLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator />
              </View>
            ) : pendingTasks.length === 0 ? (
              <EmptyState message={emptyPlanMessage} />
            ) : (
              <View className="gap-2">
                {pendingTasks.map((task) => (
                  <DayTaskRow
                    key={task.id}
                    task={task}
                    onComplete={handleCompleteTask}
                    isCompleted={false}
                    testID={`plan-task-${task.id}`}
                  />
                ))}
              </View>
            )}
          </View>

          {/* History Section - Completed Tasks */}
          <View>
            <SectionHeader
              title={historyTitle}
              count={completedTasks.length}
              testID="calendar-history-section-header"
            />
            {isLoading ? (
              <View className="items-center py-8">
                <ActivityIndicator />
              </View>
            ) : completedTasks.length === 0 ? (
              <EmptyState message={emptyHistoryMessage} />
            ) : (
              <View className="gap-2">
                {completedTasks.map((task) => (
                  <DayTaskRow
                    key={task.id}
                    task={task}
                    onComplete={handleCompleteTask}
                    isCompleted={true}
                    testID={`history-task-${task.id}`}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
