import { useRouter } from 'expo-router';
import { DateTime } from 'luxon';
import React from 'react';

import { ActivationChecklist } from '@/components/home/activation-checklist';
import { ActivityIndicator, Pressable, Text, View } from '@/components/ui';
import type { ActivationAction } from '@/lib/compliance/activation-state';
import { translate } from '@/lib/i18n';
import type { TxKeyPath } from '@/lib/i18n/utils';
import { getTasksByDateRange } from '@/lib/task-manager';
import type { Task } from '@/types/calendar';

type TaskSnapshot = {
  today: number;
  overdue: number;
  upcoming: number;
};

type TaskSnapshotState = {
  snapshot: TaskSnapshot;
  isLoading: boolean;
  hasError: boolean;
  refresh: () => void;
};

const INITIAL_SNAPSHOT: TaskSnapshot = {
  today: 0,
  overdue: 0,
  upcoming: 0,
};

export function useTaskSnapshot(): TaskSnapshotState {
  const [snapshot, setSnapshot] =
    React.useState<TaskSnapshot>(INITIAL_SNAPSHOT);
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);

  // Hook-scope cancellation ref so both effect cleanup and refresh can see it
  const isCancelledRef = React.useRef(false);

  const loadSnapshot = React.useCallback(async () => {
    // Helper that checks the hook-scope ref
    const isCancelled = () => isCancelledRef.current;

    if (isCancelled()) return;
    setIsLoading(true);

    try {
      const now = DateTime.local();
      const rangeStart = now.minus({ days: 14 }).startOf('day').toJSDate();
      const rangeEnd = now.plus({ days: 7 }).endOf('day').toJSDate();
      const rangeEndDt = DateTime.fromJSDate(rangeEnd);

      const tasks = await getTasksByDateRange(rangeStart, rangeEnd);
      if (isCancelled()) return;

      const startOfToday = now.startOf('day');
      const endOfToday = now.endOf('day');
      const tomorrowStart = now.plus({ days: 1 }).startOf('day');

      const normalized = tasks.filter(
        (task: Task) => task.status === 'pending'
      );

      const overdue = normalized.filter((task) => {
        return DateTime.fromISO(task.dueAtLocal) < startOfToday;
      }).length;
      const today = normalized.filter((task) => {
        const due = DateTime.fromISO(task.dueAtLocal);
        return due >= startOfToday && due <= endOfToday;
      }).length;
      const upcoming = normalized.filter((task) => {
        const due = DateTime.fromISO(task.dueAtLocal);
        return due >= tomorrowStart && due <= rangeEndDt;
      }).length;

      if (isCancelled()) return;

      setSnapshot({
        overdue,
        today,
        upcoming,
      });
      setHasError(false);
    } catch (error) {
      console.error('[home-dashboard] failed to load task snapshot', error);
      if (!isCancelled()) {
        setHasError(true);
        setSnapshot(INITIAL_SNAPSHOT);
      }
    } finally {
      if (!isCancelled()) {
        setIsLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    // Reset cancellation flag on mount (or if effect re-runs)
    isCancelledRef.current = false;
    void loadSnapshot();
    return () => {
      isCancelledRef.current = true;
    };
  }, [loadSnapshot]);

  return {
    snapshot,
    isLoading,
    hasError,
    refresh: loadSnapshot,
  };
}

type QuickAction = {
  key: string;
  labelKey: TxKeyPath;
  icon: string;
  onPress: () => void;
  testID: string;
};

function QuickActionTile({
  action,
}: {
  action: QuickAction;
}): React.ReactElement {
  const label = translate(action.labelKey);

  return (
    <Pressable
      className="w-[48%] gap-1 rounded-2xl border border-neutral-200 bg-white p-3 active:bg-neutral-50 dark:border-charcoal-700 dark:bg-charcoal-900 dark:active:bg-neutral-800"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={translate(
        'accessibility.home.quick_action_hint' as TxKeyPath,
        { action: label }
      )}
      onPress={action.onPress}
      testID={action.testID}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Text className="text-lg">{action.icon}</Text>
      <Text className="text-sm font-semibold text-charcoal-900 dark:text-neutral-100">
        {label}
      </Text>
    </Pressable>
  );
}

function TaskStat({
  label,
  value,
  testID,
}: {
  label: string;
  value: number;
  testID: string;
}) {
  return (
    <View className="bg-card flex-1 rounded-xl p-3">
      <Text className="text-xs text-neutral-600 dark:text-neutral-400">
        {label}
      </Text>
      <Text
        className="text-text-primary mt-1 text-xl font-bold"
        testID={testID}
      >
        {value}
      </Text>
    </View>
  );
}

type TaskSnapshotCardProps = {
  snapshot: TaskSnapshot;
  isLoading: boolean;
  hasError: boolean;
  onRefresh: () => void;
};

function TaskSnapshotCard({
  snapshot,
  isLoading,
  hasError,
  onRefresh,
}: TaskSnapshotCardProps) {
  return (
    <View className="border-border bg-card gap-3 rounded-2xl border p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-text-primary text-base font-semibold">
          {translate('home.dashboard.tasks_title' as TxKeyPath)}
        </Text>
        <Pressable
          disabled={isLoading}
          className={`rounded-full px-3 py-1.5 ${
            isLoading
              ? 'bg-card'
              : 'bg-primary-100 active:bg-primary-200 dark:bg-primary-900/40 dark:active:bg-primary-900/60'
          }`}
          accessibilityRole="button"
          accessibilityLabel={translate('list.retry' as TxKeyPath)}
          accessibilityHint={translate(
            'accessibility.common.refresh_hint' as TxKeyPath
          )}
          onPress={onRefresh}
          testID="home-tasks-refresh"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text className="text-xs font-semibold text-primary-700 dark:text-primary-200">
            {translate('list.retry' as TxKeyPath)}
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View
          className="flex-row items-center gap-3"
          testID="home-tasks-loading"
        >
          <ActivityIndicator />
          <Text className="text-sm text-neutral-600 dark:text-neutral-400">
            {translate('community.loading' as TxKeyPath)}
          </Text>
        </View>
      ) : (
        <View
          className="flex-row items-stretch gap-3"
          testID="home-tasks-stats"
        >
          <TaskStat
            label={translate('home.dashboard.tasks_overdue' as TxKeyPath)}
            value={snapshot.overdue}
            testID="home-tasks-overdue"
          />
          <TaskStat
            label={translate('home.dashboard.tasks_today' as TxKeyPath)}
            value={snapshot.today}
            testID="home-tasks-today"
          />
          <TaskStat
            label={translate('home.dashboard.tasks_upcoming' as TxKeyPath)}
            value={snapshot.upcoming}
            testID="home-tasks-upcoming"
          />
        </View>
      )}

      {hasError ? (
        <Text
          className="text-xs text-warning-800 dark:text-warning-200"
          testID="home-tasks-error"
        >
          {translate('home.dashboard.tasks_error' as TxKeyPath)}
        </Text>
      ) : null}
    </View>
  );
}

function QuickActionsSection({ actions }: { actions: QuickAction[] }) {
  return (
    <View className="gap-2">
      <Text className="text-text-primary text-base font-semibold">
        {translate('home.dashboard.quick_actions' as TxKeyPath)}
      </Text>
      <View className="flex-row flex-wrap justify-between gap-3">
        {actions.map((action) => (
          <QuickActionTile key={action.key} action={action} />
        ))}
      </View>
    </View>
  );
}

type HomeDashboardProps = {
  onShareUpdatePress: () => void;
  onActivationActionComplete: (action: ActivationAction) => void;
};

export function HomeDashboard({
  onShareUpdatePress,
  onActivationActionComplete,
}: HomeDashboardProps): React.ReactElement {
  const router = useRouter();
  const { snapshot, isLoading, hasError, refresh } = useTaskSnapshot();

  const quickActions: QuickAction[] = React.useMemo(
    () => [
      {
        key: 'share',
        labelKey: 'home.quick_actions.share_update',
        icon: '📣',
        onPress: onShareUpdatePress,
        testID: 'home-quick-action-share',
      },
      {
        key: 'add-task',
        labelKey: 'home.quick_actions.add_task',
        icon: '🗓️',
        onPress: () => {
          router.push('/calendar');
          onActivationActionComplete('create-task');
        },
        testID: 'home-quick-action-add-task',
      },
      {
        key: 'ai',
        labelKey: 'home.quick_actions.try_ai',
        icon: '🔍',
        onPress: () => {
          router.push('/assessment/capture');
          onActivationActionComplete('try-ai-diagnosis');
        },
        testID: 'home-quick-action-ai',
      },
      {
        key: 'strains',
        labelKey: 'home.quick_actions.explore_strains',
        icon: '🌿',
        onPress: () => {
          router.push('/strains');
          onActivationActionComplete('explore-strains');
        },
        testID: 'home-quick-action-strains',
      },
      {
        key: 'playbook',
        labelKey: 'home.quick_actions.open_playbook',
        icon: '📖',
        onPress: () => {
          router.push('/playbooks');
          onActivationActionComplete('open-playbook');
        },
        testID: 'home-quick-action-playbook',
      },
    ],
    [onShareUpdatePress, onActivationActionComplete, router]
  );

  return (
    <View className="gap-4" testID="home-dashboard">
      <ActivationChecklist onActionComplete={onActivationActionComplete} />
      <TaskSnapshotCard
        snapshot={snapshot}
        isLoading={isLoading}
        hasError={hasError}
        onRefresh={refresh}
      />
      <QuickActionsSection actions={quickActions} />
    </View>
  );
}
