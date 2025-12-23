import { useRouter } from 'expo-router';
import React from 'react';

import { Pressable, Text, View } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';
import type { TxKeyPath } from '@/lib/i18n/utils';

type TaskBannerProps = {
  overdue: number;
  today: number;
  isLoading?: boolean;
};

export function TaskBanner({
  overdue,
  today,
  isLoading,
}: TaskBannerProps): React.ReactElement | null {
  const router = useRouter();

  const handlePress = React.useCallback(() => {
    haptics.selection();
    router.push('/calendar');
  }, [router]);

  if (isLoading) {
    return (
      <View
        className="flex-row items-center gap-2 rounded-xl bg-white px-4 py-3 dark:bg-charcoal-900"
        testID="task-banner-loading"
      >
        <View className="size-2 animate-pulse rounded-full bg-neutral-300 dark:bg-neutral-600" />
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          {translate('community.loading' as TxKeyPath)}
        </Text>
      </View>
    );
  }

  const hasOverdue = overdue > 0;
  const hasToday = today > 0;
  const hasTasks = hasOverdue || hasToday;

  if (!hasTasks) {
    return null;
  }

  return (
    <Pressable
      className="flex-row items-center justify-between rounded-xl bg-white px-4 py-3 active:bg-neutral-50 dark:bg-charcoal-900 dark:active:bg-charcoal-800"
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={translate('home.task_banner.label' as TxKeyPath)}
      accessibilityHint={translate('home.task_banner.hint' as TxKeyPath)}
      testID="task-banner"
    >
      <View className="flex-row items-center gap-3">
        {hasOverdue ? (
          <View className="flex-row items-center gap-1.5">
            <View className="size-2 rounded-full bg-danger-500" />
            <Text className="text-sm font-medium text-danger-700 dark:text-danger-300">
              {overdue} {translate('home.dashboard.tasks_overdue' as TxKeyPath)}
            </Text>
          </View>
        ) : null}
        {hasOverdue && hasToday ? (
          <Text className="text-neutral-400">•</Text>
        ) : null}
        {hasToday ? (
          <View className="flex-row items-center gap-1.5">
            <Text className="text-lg">📅</Text>
            <Text className="text-sm font-medium text-charcoal-900 dark:text-neutral-100">
              {today} {translate('home.dashboard.tasks_today' as TxKeyPath)}
            </Text>
          </View>
        ) : null}
      </View>
      <Text className="text-sm text-primary-600 dark:text-primary-400">→</Text>
    </Pressable>
  );
}
