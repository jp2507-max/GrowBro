import { useRouter } from 'expo-router';
import React from 'react';

import { FocusTaskItem } from '@/components/home/focus-task-item';
import { useTaskSnapshot } from '@/components/home/home-dashboard';
import { Pressable, Text, View } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';
import type { TxKeyPath } from '@/lib/i18n/utils';
import { completeTask } from '@/lib/task-manager';
import type { Task } from '@/types/calendar';

function LoadingSkeleton(): React.ReactElement {
  return (
    <View className="gap-3" testID="todays-focus-loading">
      <View className="h-16 animate-pulse rounded-xl bg-neutral-100 dark:bg-white/[0.07]" />
      <View className="h-16 animate-pulse rounded-xl bg-neutral-100 dark:bg-white/[0.07]" />
    </View>
  );
}

function EmptyState({ onPress }: { onPress: () => void }): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={translate('home.cockpit.view_calendar' as TxKeyPath)}
      className="items-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-6 active:bg-neutral-100 dark:border-white/20 dark:bg-white/[0.05] dark:active:bg-white/[0.08]"
      testID="todays-focus-empty"
    >
      <Text className="text-sm text-neutral-500 dark:text-neutral-400">
        {translate('home.cockpit.no_tasks_today' as TxKeyPath)}
      </Text>
      <Text className="mt-1 text-sm font-medium text-primary-600 dark:text-primary-400">
        {translate('home.cockpit.view_calendar' as TxKeyPath)} →
      </Text>
    </Pressable>
  );
}

export function TodaysFocusSection(): React.ReactElement {
  const router = useRouter();
  const { tasks, isLoading, hasError, refresh } = useTaskSnapshot();

  const handleNavigateToCalendar = React.useCallback(() => {
    haptics.selection();
    router.push('/calendar');
  }, [router]);

  const handleTaskPress = React.useCallback(
    (_task: Task) => {
      haptics.selection();
      // Navigate to calendar with the task's date
      router.push('/calendar');
    },
    [router]
  );

  const handleTaskComplete = React.useCallback(
    async (task: Task) => {
      try {
        await completeTask(task.id);
        // Optimistic update: remove from list immediately via refresh
        refresh();
      } catch (error) {
        console.error('[TodaysFocusSection] Failed to complete task:', error);
      }
    },
    [refresh]
  );

  const pendingCount = tasks.length;

  return (
    <View testID="todays-focus-section">
      {/* Section Header */}
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-bold text-charcoal-900 dark:text-neutral-100">
          {translate('home.cockpit.todays_focus' as TxKeyPath)}
        </Text>
        <View className="flex-row items-center gap-2">
          {hasError ? (
            <Pressable
              onPress={refresh}
              accessibilityRole="button"
              accessibilityLabel={translate('list.retry' as TxKeyPath)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              className="active:opacity-70"
            >
              <Text className="text-sm font-medium text-primary-600 dark:text-primary-400">
                {translate('list.retry' as TxKeyPath)}
              </Text>
            </Pressable>
          ) : !isLoading && pendingCount > 0 ? (
            <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {translate('home.cockpit.pending_count' as TxKeyPath, {
                count: pendingCount,
              })}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Task List */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : tasks.length === 0 ? (
        <EmptyState onPress={handleNavigateToCalendar} />
      ) : (
        <View className="gap-3">
          {tasks.map((task) => (
            <FocusTaskItem
              key={task.id}
              task={task}
              location={
                (task.metadata?.growSpace as string | undefined) ??
                (task.metadata?.plantName as string | undefined)
              }
              onComplete={handleTaskComplete}
              onPress={handleTaskPress}
            />
          ))}
          {/* View All Link */}
          <Pressable
            onPress={handleNavigateToCalendar}
            accessibilityRole="button"
            accessibilityLabel={translate(
              'home.cockpit.view_calendar' as TxKeyPath
            )}
            className="items-center py-2 active:opacity-70"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            testID="todays-focus-view-all"
          >
            <Text className="text-sm font-medium text-primary-600 dark:text-primary-400">
              {translate('home.cockpit.view_calendar' as TxKeyPath)} →
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
