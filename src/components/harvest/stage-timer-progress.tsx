/**
 * Stage Timer Progress Component
 * Renders the progress bar and timing information
 */

import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';

type ElapsedTime = {
  days: number;
  hours: number;
  minutes: number;
  totalDays: number;
};

type Props = {
  className?: string;
  timerLabel: string;
  elapsed: ElapsedTime;
  isOverdue: boolean;
  targetDays: number;
  maxDurationDays: number;
  t: (key: string, options?: Record<string, unknown>) => string;
};

export function StageTimerProgress({
  className,
  timerLabel,
  elapsed,
  isOverdue,
  targetDays,
  maxDurationDays,
  t,
}: Props) {
  return (
    <View
      className={className}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={timerLabel}
      accessibilityHint="Shows elapsed time and target duration for the current stage"
      accessibilityLiveRegion="polite"
    >
      {/* Elapsed time */}
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm text-neutral-600">
          {t('harvest.stage_tracker.elapsed', {
            days: elapsed.days,
            hours: elapsed.hours,
            minutes: elapsed.minutes,
          })}
        </Text>

        {isOverdue ? (
          <Text className="text-sm font-semibold text-danger-600">
            {t('harvest.stage_tracker.overdue', {
              days: Math.floor(elapsed.totalDays - maxDurationDays),
            })}
          </Text>
        ) : (
          <Text className="text-sm font-semibold text-primary-600">
            {t('harvest.stage_tracker.on_track')}
          </Text>
        )}
      </View>

      {/* Target duration */}
      <Text className="text-xs text-neutral-500">
        {t('harvest.stage_tracker.target', { days: targetDays })}
      </Text>

      {/* Progress bar */}
      <View className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-200">
        <View
          className={`h-full ${isOverdue ? 'bg-danger-600' : 'bg-primary-600'}`}
          style={{
            width: `${targetDays > 0 ? Math.min((elapsed.totalDays / targetDays) * 100, 100) : 0}%`,
          }}
        />
      </View>
    </View>
  );
}
