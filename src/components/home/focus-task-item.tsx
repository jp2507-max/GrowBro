import { DateTime } from 'luxon';
import React from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Text, View } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/calendar';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type FocusTaskItemProps = {
  task: Task;
  /** Location context (plant name, grow space, etc.) */
  location?: string;
  onComplete: (task: Task) => void;
  onPress?: (task: Task) => void;
  testID?: string;
};

function formatDueTime(dueAtLocal: string, timezone?: string): string {
  const zone = timezone ?? DateTime.local().zoneName ?? 'UTC';
  const dt = DateTime.fromISO(dueAtLocal, { zone });

  if (!dt.isValid) {
    return '';
  }

  return dt.toFormat('HH:mm');
}

function formatDueLabel(dueAtLocal: string, timezone?: string): string {
  const zone = timezone ?? DateTime.local().zoneName ?? 'UTC';
  const dt = DateTime.fromISO(dueAtLocal, { zone });

  if (!dt.isValid) {
    return '';
  }

  const now = DateTime.local();
  const startOfToday = now.startOf('day');

  // Check if overdue
  if (dt < startOfToday) {
    return translate('calendar.task_row.overdue');
  }

  // Today - show due time
  const time = dt.toFormat('h:mm a');
  return translate('home.cockpit.due_time', { time });
}

function TaskCheckbox({
  onPress,
}: {
  onPress: () => void;
}): React.ReactElement {
  const completeLabel = translate('calendar.task_row.complete');

  const handlePress = React.useCallback(() => {
    haptics.success();
    onPress();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      className={cn(
        'size-6 items-center justify-center rounded-full border-2',
        'border-primary-500 bg-transparent dark:border-primary-400'
      )}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: false }}
      accessibilityLabel={completeLabel}
      accessibilityHint={translate('calendar.task_row.complete_hint')}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      testID="focus-task-checkbox"
    >
      {/* Empty circle for unchecked state */}
    </Pressable>
  );
}

function FocusTaskItemComponent({
  task,
  location,
  onComplete,
  onPress,
  testID,
}: FocusTaskItemProps): React.ReactElement {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const handlePressIn = React.useCallback(() => {
    haptics.selection();
    scale.set(
      withSpring(0.98, {
        damping: 10,
        stiffness: 300,
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [scale]);

  const handlePressOut = React.useCallback(() => {
    scale.set(
      withSpring(1, {
        damping: 10,
        stiffness: 300,
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [scale]);

  const handlePress = React.useCallback(() => {
    onPress?.(task);
  }, [onPress, task]);

  const handleComplete = React.useCallback(() => {
    onComplete(task);
  }, [onComplete, task]);

  const dueLabel = formatDueLabel(task.dueAtLocal, task.timezone);
  const dueTime = formatDueTime(task.dueAtLocal, task.timezone);

  // Build subtitle: location + due info
  const subtitleParts: string[] = [];
  if (location) {
    subtitleParts.push(location);
  }
  if (dueLabel) {
    subtitleParts.push(dueLabel);
  } else if (dueTime) {
    subtitleParts.push(dueTime);
  }
  const subtitle = subtitleParts.join(' • ');

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.card, animatedStyle]}
      className="flex-row items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-white/15 dark:bg-white/[0.07]"
      accessibilityRole="button"
      accessibilityLabel={`${task.title}${location ? `, ${location}` : ''}`}
      accessibilityHint={translate('calendar.task_row.task_hint')}
      testID={testID ?? `focus-task-${task.id}`}
    >
      {/* Checkbox */}
      <TaskCheckbox onPress={handleComplete} />

      {/* Task Content */}
      <View className="flex-1 gap-0.5">
        <Text
          className="text-sm font-medium text-charcoal-900 dark:text-neutral-100"
          numberOfLines={1}
        >
          {task.title}
        </Text>
        {subtitle ? (
          <Text
            className="text-xs text-neutral-500 dark:text-neutral-400"
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

// Memoize to prevent unnecessary re-renders
export const FocusTaskItem = React.memo(
  FocusTaskItemComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.task.id === nextProps.task.id &&
      prevProps.task.title === nextProps.task.title &&
      prevProps.task.dueAtLocal === nextProps.task.dueAtLocal &&
      prevProps.task.status === nextProps.task.status &&
      prevProps.location === nextProps.location &&
      prevProps.onComplete === nextProps.onComplete &&
      prevProps.onPress === nextProps.onPress
    );
  }
);

const styles = StyleSheet.create({
  card: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
});
