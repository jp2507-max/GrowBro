import React from 'react';
import { Pressable } from 'react-native';
import { twMerge } from 'tailwind-merge';

import { Text, View } from '@/components/ui';
import { Check as CheckIcon } from '@/components/ui/icons';
import { translate } from '@/lib/i18n';
import type { TxKeyPath } from '@/lib/i18n/utils';
import type { Task } from '@/types/calendar';

type DayTaskRowProps = {
  task: Task;
  plantName?: string;
  onComplete: (task: Task) => void;
  onPress?: (task: Task) => void;
  isCompleted?: boolean;
  testID?: string;
};

function formatDueTime(dueAtLocal: string): string {
  const date = new Date(dueAtLocal);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TaskCheckbox({
  isCompleted,
  onPress,
}: {
  isCompleted: boolean;
  onPress: () => void;
}): React.ReactElement {
  const completeLabel = translate('calendar.task_row.complete' as TxKeyPath);
  const completedLabel = translate('calendar.task_row.completed' as TxKeyPath);

  return (
    <Pressable
      onPress={onPress}
      disabled={isCompleted}
      className={twMerge(
        'size-8 items-center justify-center rounded-full border-2',
        isCompleted
          ? 'border-success-500 bg-success-500'
          : 'border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-800'
      )}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isCompleted }}
      accessibilityLabel={isCompleted ? completedLabel : completeLabel}
      accessibilityHint={translate(
        'calendar.task_row.complete_hint' as TxKeyPath
      )}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      testID="task-checkbox"
    >
      {isCompleted && <CheckIcon size={16} color="white" />}
    </Pressable>
  );
}

export function DayTaskRow({
  task,
  plantName,
  onComplete,
  onPress,
  isCompleted = false,
  testID,
}: DayTaskRowProps): React.ReactElement {
  const handlePress = React.useCallback(() => {
    onPress?.(task);
  }, [onPress, task]);

  const handleComplete = React.useCallback(() => {
    if (!isCompleted) {
      onComplete(task);
    }
  }, [isCompleted, onComplete, task]);

  const dueTime = formatDueTime(task.dueAtLocal);
  const isEphemeral = task.metadata?.ephemeral === true;
  const recurringLabel = translate('calendar.task_row.recurring' as TxKeyPath);

  return (
    <Pressable
      onPress={handlePress}
      className={twMerge(
        'flex-row items-center gap-3 rounded-xl border border-border bg-card p-3',
        isCompleted && 'opacity-60'
      )}
      accessibilityRole="button"
      accessibilityLabel={`${task.title}${plantName ? `, ${plantName}` : ''}, ${dueTime}`}
      accessibilityHint={translate('calendar.task_row.task_hint' as TxKeyPath)}
      testID={testID ?? `day-task-row-${task.id}`}
    >
      <TaskCheckbox isCompleted={isCompleted} onPress={handleComplete} />

      <View className="flex-1 gap-0.5">
        <Text
          className={twMerge(
            'text-base font-semibold text-text-primary',
            isCompleted && 'line-through'
          )}
          numberOfLines={1}
        >
          {task.title}
        </Text>

        <View className="flex-row items-center gap-2">
          {plantName && (
            <Text className="text-sm text-text-secondary" numberOfLines={1}>
              🌱 {plantName}
            </Text>
          )}
          <Text className="text-sm text-text-secondary">{dueTime}</Text>
          {(task.seriesId || isEphemeral) && (
            <Text className="text-xs text-primary-600 dark:text-primary-400">
              🔄 {recurringLabel}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}
