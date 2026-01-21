import { DateTime } from 'luxon';
import React from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Image, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Check as CheckIcon, Droplet, Leaf } from '@/components/ui/icons';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/calendar';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type DayTaskRowProps = {
  task: Task;
  plantName?: string;
  plantImage?: string;
  onComplete: (task: Task) => void;
  onPress?: (task: Task) => void;
  isCompleted?: boolean;
  testID?: string;
};

function formatDueTime(dueAtLocal: string, timezone?: string): string {
  const zone = timezone ?? DateTime.local().zoneName ?? 'UTC';
  const dt = DateTime.fromISO(dueAtLocal, { zone });

  if (!dt.isValid) {
    return '—';
  }

  return dt.toFormat('HH:mm');
}

/**
 * Determines the task type from task title for icon display
 */
function getTaskType(task: Task): 'water' | 'feed' | 'other' {
  // Explicit metadata takes precedence (more reliable and language-agnostic)
  if (task.metadata?.type === 'water') return 'water';
  if (task.metadata?.type === 'feed') return 'feed';

  const title = task.title.toLowerCase();
  if (
    title.includes('water') ||
    title.includes('gieß') ||
    title.includes('wasser')
  ) {
    return 'water';
  }
  if (
    title.includes('feed') ||
    title.includes('düng') ||
    title.includes('nutrient')
  ) {
    return 'feed';
  }
  return 'other';
}

/**
 * Returns the appropriate icon for the task type
 */
function TaskTypeIcon({
  type,
  isCompleted,
}: {
  type: 'water' | 'feed' | 'other';
  isCompleted: boolean;
}): React.ReactElement {
  const iconSize = 16;
  const opacity = isCompleted ? 0.5 : 1;

  if (type === 'water') {
    return (
      <View
        className="size-8 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-500/20"
        style={{ opacity }}
      >
        <Droplet color={colors.sky[500]} width={iconSize} height={iconSize} />
      </View>
    );
  }

  return (
    <View
      className="size-8 items-center justify-center rounded-full bg-success-100 dark:bg-success-500/20"
      style={{ opacity }}
    >
      <Leaf color={colors.success[500]} width={iconSize} height={iconSize} />
    </View>
  );
}

function TaskCheckbox({
  isCompleted,
  onPress,
}: {
  isCompleted: boolean;
  onPress: () => void;
}): React.ReactElement {
  const completeLabel = translate('calendar.task_row.complete');
  const completedLabel = translate('calendar.task_row.completed');

  const handlePress = React.useCallback(() => {
    haptics.success();
    onPress();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={isCompleted}
      className={cn(
        'size-7 items-center justify-center rounded-full border-2',
        isCompleted
          ? 'border-success-500 bg-success-500'
          : 'border-neutral-300 bg-neutral-50 dark:border-neutral-500 dark:bg-neutral-800'
      )}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isCompleted }}
      accessibilityLabel={isCompleted ? completedLabel : completeLabel}
      accessibilityHint={translate('calendar.task_row.complete_hint')}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      testID="task-checkbox"
    >
      {isCompleted && <CheckIcon size={14} color="white" />}
    </Pressable>
  );
}

/**
 * Displays plant name as a small badge/chip with optional avatar
 */
function PlantBadge({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl?: string;
}): React.ReactElement {
  return (
    <View
      className="flex-row items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 dark:bg-primary-900/30"
      testID="plant-badge"
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          className="size-4 rounded-full"
          contentFit="cover"
          testID="plant-avatar"
        />
      ) : (
        <Leaf
          width={12}
          height={12}
          color={colors.primary[600]}
          testID="plant-leaf-icon"
        />
      )}
      <Text
        className="max-w-24 text-xs font-bold text-primary-700 dark:text-primary-300"
        numberOfLines={1}
      >
        {name}
      </Text>
    </View>
  );
}

export function DayTaskRowComponent({
  task,
  plantName,
  plantImage,
  onComplete,
  onPress,
  isCompleted = false,
  testID,
}: DayTaskRowProps): React.ReactElement {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const handlePressIn = React.useCallback(() => {
    haptics.selection();
    scale.set(
      withSpring(0.97, {
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
    if (!isCompleted) {
      onComplete(task);
    }
  }, [isCompleted, onComplete, task]);

  const dueTime = formatDueTime(task.dueAtLocal, task.timezone);
  const isEphemeral = task.metadata?.ephemeral === true;
  const recurringLabel = translate('calendar.task_row.recurring');
  const taskType = getTaskType(task);

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.card, animatedStyle]}
      className={cn(
        'flex-row items-center gap-3 rounded-3xl border border-neutral-100 bg-white p-4 dark:border-white/5 dark:bg-charcoal-900',
        isCompleted && 'opacity-60'
      )}
      accessibilityRole="button"
      accessibilityLabel={`${task.title}${plantName ? `, ${plantName}` : ''}, ${dueTime}`}
      accessibilityHint={translate('calendar.task_row.task_hint')}
      testID={testID ?? `day-task-row-${task.id}`}
    >
      {/* Task Type Icon */}
      <TaskTypeIcon type={taskType} isCompleted={isCompleted} />

      {/* Task Content */}
      <View className="flex-1 gap-1">
        <Text
          className={cn(
            'text-base font-semibold text-neutral-900 dark:text-neutral-100',
            isCompleted && 'line-through'
          )}
          numberOfLines={1}
        >
          {task.title}
        </Text>

        {/* Description/Instruction row (if present) */}
        {task.description ? (
          <Text
            className="text-sm text-neutral-500 dark:text-neutral-400"
            numberOfLines={1}
          >
            {task.description}
          </Text>
        ) : null}

        {/* Meta row: Plant badge, time, recurring indicator */}
        <View className="flex-row flex-wrap items-center gap-2">
          {plantName ? (
            <PlantBadge name={plantName} imageUrl={plantImage} />
          ) : null}
          <Text className="text-xs text-neutral-500 dark:text-neutral-400">
            {dueTime}
          </Text>
          {(task.seriesId || isEphemeral) && (
            <Text className="text-xs text-primary-600 dark:text-primary-400">
              🔄 {recurringLabel}
            </Text>
          )}
        </View>
      </View>

      {/* Checkbox */}
      <TaskCheckbox isCompleted={isCompleted} onPress={handleComplete} />
    </AnimatedPressable>
  );
}

// Memoize to prevent unnecessary re-renders - only re-render if critical props change
export const DayTaskRow = React.memo(
  DayTaskRowComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.task.id === nextProps.task.id &&
      prevProps.task.title === nextProps.task.title &&
      prevProps.task.dueAtLocal === nextProps.task.dueAtLocal &&
      prevProps.task.status === nextProps.task.status &&
      prevProps.plantName === nextProps.plantName &&
      prevProps.plantImage === nextProps.plantImage &&
      prevProps.isCompleted === nextProps.isCompleted &&
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
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
    // @ts-ignore - borderCurve is iOS-only
    borderCurve: 'continuous',
  },
});
