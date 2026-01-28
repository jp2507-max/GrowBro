import React from 'react';
import Animated, {
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Text, View } from '@/components/ui';
import type { TxKeyPath } from '@/lib/i18n';
import { translate } from '@/lib/i18n';

const PROGRESS_BAR_WIDTH = 208; // 52 * 4 = w-52 in tailwind

type CompletionProgressProps = {
  progress: number; // 0-100
  label?: string;
  testID?: string;
};

export function CompletionProgress({
  progress,
  label,
  testID = 'completion-progress',
}: CompletionProgressProps): React.ReactElement {
  const progressValue = useSharedValue(0);

  React.useEffect(() => {
    progressValue.set(
      withTiming(Math.min(100, Math.max(0, progress)), {
        duration: 400,
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [progress, progressValue]);

  const progressStyle = useAnimatedStyle(() => {
    // Direct calculation: (progressValue / 100) * PROGRESS_BAR_WIDTH
    const widthValue = (progressValue.get() / 100) * PROGRESS_BAR_WIDTH;
    return {
      width: widthValue,
    };
  });

  const displayLabel =
    label ??
    translate('plants.completion_progress.percent_complete' as TxKeyPath, {
      percent: Math.round(progress),
    });

  return (
    <Animated.View
      entering={FadeIn.delay(150)
        .duration(300)
        .reduceMotion(ReduceMotion.System)}
      className="items-center gap-2 px-6 pb-4"
      testID={testID}
    >
      {/* Progress Bar */}
      <View className="h-4 w-52 overflow-hidden rounded-full bg-neutral-300/60 dark:bg-neutral-700">
        <Animated.View
          style={progressStyle}
          className="h-full rounded-full bg-primary-600 shadow-md dark:bg-primary-500"
        />
      </View>

      {/* Label */}
      <Text
        className="text-sm font-medium text-neutral-500 dark:text-neutral-400"
        testID={`${testID}-label`}
      >
        {displayLabel}
      </Text>
    </Animated.View>
  );
}

/**
 * Calculate form completion percentage based on filled fields
 */
export function calculateCompletion(values: Record<string, unknown>): number {
  const fields = [
    'name',
    'strain',
    'startType',
    'environment',
    'photoperiodType',
    'medium',
    'plantedAt',
    'potSize',
    'height',
    'lightSchedule',
    'lightHours',
    'notes',
    'imageUrl',
  ];

  const filledCount = fields.filter((field) => {
    const value = values[field];
    return value !== undefined && value !== null && value !== '';
  }).length;

  return Math.round((filledCount / fields.length) * 100);
}
