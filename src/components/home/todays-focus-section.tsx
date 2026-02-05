import { useRouter } from 'expo-router';
import React from 'react';

import { FocusTaskItem } from '@/components/home/focus-task-item';
import { useTaskSnapshot } from '@/components/home/home-dashboard';
import {
  TaskOutcomeModal,
  type TaskOutcomeModalRef,
} from '@/components/tasks/task-outcome-modal';
import { Pressable, Text, View } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';
import type { TxKeyPath } from '@/lib/i18n/utils';
import { completeTask } from '@/lib/task-manager';
import {
  getTaskOutcomeCheckInParams,
  shouldPromptTaskOutcome,
} from '@/lib/task-outcome';
import type { Task } from '@/types/calendar';

function LoadingSkeleton(): React.ReactElement {
  return (
    <View className="gap-3" testID="todays-focus-loading">
      <View className="h-16 animate-pulse rounded-xl bg-neutral-100 dark:bg-white/[0.07]" />
      <View className="h-16 animate-pulse rounded-xl bg-neutral-100 dark:bg-white/[0.07]" />
    </View>
  );
}

function ViewAllLink({ onPress }: { onPress: () => void }): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={translate('home.cockpit.view_calendar' as TxKeyPath)}
      accessibilityHint={translate(
        'accessibility.common.opens_screen_hint' as TxKeyPath,
        {
          label: translate('tabs.calendar' as TxKeyPath),
        }
      )}
      className="items-center py-2 active:opacity-70"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      testID="todays-focus-view-all"
    >
      <Text className="text-sm font-medium text-primary-600 dark:text-primary-400">
        {translate('home.cockpit.view_calendar' as TxKeyPath)} →
      </Text>
    </Pressable>
  );
}

function EmptyState({ onPress }: { onPress: () => void }): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={translate('home.cockpit.view_calendar' as TxKeyPath)}
      accessibilityHint={translate(
        'accessibility.common.opens_screen_hint' as TxKeyPath,
        {
          label: translate('tabs.calendar' as TxKeyPath),
        }
      )}
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

function TodaysFocusHeader({
  hasError,
  isLoading,
  pendingCount,
  onRefresh,
}: {
  hasError: boolean;
  isLoading: boolean;
  pendingCount: number;
  onRefresh: () => void;
}): React.ReactElement {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <Text className="text-lg font-bold text-charcoal-900 dark:text-neutral-100">
        {translate('home.cockpit.todays_focus' as TxKeyPath)}
      </Text>
      <View className="flex-row items-center gap-2">
        {hasError ? (
          <Pressable
            onPress={onRefresh}
            accessibilityRole="button"
            accessibilityLabel={translate('list.retry' as TxKeyPath)}
            accessibilityHint={translate(
              'accessibility.common.refresh_hint' as TxKeyPath
            )}
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
  );
}

export function TodaysFocusSection(): React.ReactElement {
  const router = useRouter();
  const { tasks, isLoading, hasError, refresh } = useTaskSnapshot();
  const taskOutcomeModalRef = React.useRef<TaskOutcomeModalRef | null>(null);
  const [taskOutcomeTask, setTaskOutcomeTask] = React.useState<Task | null>(
    null
  );

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
        if (shouldPromptTaskOutcome(task)) {
          setTaskOutcomeTask(task);
          taskOutcomeModalRef.current?.present();
        }
      } catch (error) {
        console.error('[TodaysFocusSection] Failed to complete task:', error);
      }
    },
    [refresh]
  );

  const handleOutcomeDismiss = React.useCallback(() => {
    setTaskOutcomeTask(null);
  }, []);

  const handleOutcomeStillDry = React.useCallback(
    (task: Task) => {
      const params = getTaskOutcomeCheckInParams(task);
      if (!params) return;
      router.push({ pathname: '/(modals)/plant-check-in', params });
    },
    [router]
  );

  const pendingCount = tasks.length;

  return (
    <View testID="todays-focus-section">
      <TodaysFocusHeader
        hasError={hasError}
        isLoading={isLoading}
        pendingCount={pendingCount}
        onRefresh={refresh}
      />

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
          <ViewAllLink onPress={handleNavigateToCalendar} />
        </View>
      )}

      <TaskOutcomeModal
        ref={taskOutcomeModalRef}
        task={taskOutcomeTask}
        onStillDry={handleOutcomeStillDry}
        onDismiss={handleOutcomeDismiss}
      />
    </View>
  );
}
