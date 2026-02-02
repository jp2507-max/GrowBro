import * as React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { TimelineNode } from '@/components/calendar/timeline-node';
import { Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/calendar';

import type { TaskType } from './calendar-list-items';

type TimelineTaskCardState = 'completed' | 'active' | 'pending' | 'future';

type TimelineTaskCardProps = {
  task: Task;
  taskType: TaskType;
  state: TimelineTaskCardState;
  plantName?: string;
  dueTime?: string;
  isFirst?: boolean;
  isLast?: boolean;
  onPress: () => void;
  onComplete?: () => void;
  testID?: string;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function getCardShadow(state: TimelineTaskCardState): object {
  if (state === 'active') {
    return {
      shadowColor: colors.neon.lime,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 6,
    };
  }
  return {};
}

/**
 * Derive display title from task, using metadata.engineKey as fallback
 * Converts engine keys like 'hydrology.check_water_need' to 'Check Water Need'
 */
function getDisplayTitle(task: Task): string {
  if (task.title?.trim()) return task.title;

  const engineKey = task.metadata?.engineKey as string | undefined;
  if (engineKey) {
    // Extract last part: 'hydrology.check_water_need' -> 'check_water_need'
    const lastPart = engineKey.split('.').pop() ?? engineKey;
    // Convert to title case: 'check_water_need' -> 'Check Water Need'
    return lastPart.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return translate('calendar.timeline.task_fallback');
}

// -----------------------------------------------------------------------------
// Extracted sub-components for line count reduction
// -----------------------------------------------------------------------------

function TaskCardTitle({
  title,
  dueTime,
  isCompleted,
  isActive,
}: {
  title: string;
  dueTime?: string;
  isCompleted: boolean;
  isActive: boolean;
}): React.ReactElement {
  return (
    <View className="flex-row items-center justify-between">
      <Text
        className={cn(
          'flex-1 text-lg font-bold',
          isCompleted
            ? 'text-neutral-600 dark:text-white/60 line-through'
            : isActive
              ? 'text-primary-800 dark:text-primary-300'
              : 'text-charcoal-900 dark:text-neutral-100'
        )}
        numberOfLines={2}
      >
        {title}
      </Text>
      {dueTime && (
        <Text className="ml-2 text-sm text-neutral-500 dark:text-white/50">
          {dueTime}
        </Text>
      )}
    </View>
  );
}

function PlantBadge({ plantName }: { plantName: string }): React.ReactElement {
  return (
    <View className="mt-2 self-start rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-0.5 dark:border-white/10 dark:bg-white/5">
      <Text className="text-xs text-neutral-700 dark:text-white/70">
        {plantName}
      </Text>
    </View>
  );
}

function ActiveTaskActions({
  onComplete,
}: {
  onComplete: () => void;
}): React.ReactElement {
  return (
    <View className="mt-3">
      <Pressable
        onPress={onComplete}
        className="items-center rounded-xl bg-lime-400 py-3"
        accessibilityRole="button"
        accessibilityLabel={translate('calendar.task_detail.complete')}
        accessibilityHint={translate('calendar.task_detail.complete_hint')}
      >
        <Text className="text-sm font-bold text-charcoal-950">
          {translate('calendar.task_detail.complete')}
        </Text>
      </Pressable>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Main component
// -----------------------------------------------------------------------------

/**
 * Timeline task card with node, connecting line, and glass-morphism styling
 */
export function TimelineTaskCard({
  task,
  taskType,
  state,
  plantName,
  dueTime,
  isFirst = false,
  isLast = false,
  onPress,
  onComplete,
  testID = 'timeline-task-card',
}: TimelineTaskCardProps): React.ReactElement {
  const scale = useSharedValue(1);
  const isCompleted = state === 'completed';
  const isActive = state === 'active';
  const isFuture = state === 'future';

  const handlePressIn = React.useCallback(() => {
    haptics.selection();
    scale.set(
      withSpring(0.98, {
        damping: 15,
        stiffness: 300,
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [scale]);

  const handlePressOut = React.useCallback(() => {
    scale.set(
      withSpring(1, {
        damping: 15,
        stiffness: 300,
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleCompletePress = React.useCallback(() => {
    haptics.success();
    onComplete?.();
  }, [onComplete]);

  return (
    <View className="flex-row" testID={testID}>
      <View className="w-14 items-center">
        <TimelineNode
          state={state}
          taskType={taskType}
          isFirst={isFirst}
          isLast={isLast}
        />
      </View>

      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.card, getCardShadow(state), animatedStyle]}
        className={cn(
          'flex-1 ml-2 mb-4 rounded-2xl p-5',
          isCompleted && 'opacity-50',
          isFuture && 'border-dashed',
          isActive
            ? 'border border-primary-200 bg-primary-50 dark:border-primary-300/50 dark:bg-white/10'
            : 'border border-neutral-200 bg-white dark:border-white/10 dark:bg-white/5'
        )}
        accessibilityRole="button"
        accessibilityLabel={getDisplayTitle(task)}
        accessibilityHint={translate('calendar.task_detail.view_hint')}
        accessibilityState={{ selected: isActive }}
      >
        <TaskCardTitle
          title={getDisplayTitle(task)}
          dueTime={dueTime}
          isCompleted={isCompleted}
          isActive={isActive}
        />
        {task.description && !isCompleted && (
          <Text
            className="mt-1 text-sm text-neutral-600 dark:text-white/60"
            numberOfLines={2}
          >
            {task.description}
          </Text>
        )}
        {plantName && !isCompleted && <PlantBadge plantName={plantName} />}
        {isActive && <ActiveTaskActions onComplete={handleCompletePress} />}
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {},
});
