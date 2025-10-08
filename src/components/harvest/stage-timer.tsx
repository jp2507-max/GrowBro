/**
 * Stage Timer Display
 *
 * Shows elapsed time and target duration for current stage
 * Requirements: 2.3 (timing guidance with server timestamps)
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import {
  calculateElapsedTime,
  exceedsMaxDuration,
  getStageConfig,
} from '@/lib/harvest/stage-config';
import { type HarvestStage } from '@/types/harvest';

type Props = {
  stage: HarvestStage;
  stageStartedAt: Date;
  className?: string;
};

export function StageTimer({ stage, stageStartedAt, className }: Props) {
  const { t } = useTranslation();
  const config = getStageConfig(stage);

  // Update elapsed time every minute
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const elapsed = calculateElapsedTime(stageStartedAt, currentTime);
  const isOverdue = exceedsMaxDuration(stage, elapsed.totalDays);
  const targetDays = config.target_duration_days;

  // Don't show timer for instant stages (harvest, inventory)
  if (targetDays === 0) {
    return null;
  }

  return (
    <View className={className}>
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
              days: Math.floor(elapsed.totalDays - config.max_duration_days),
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
            width: `${Math.min((elapsed.totalDays / targetDays) * 100, 100)}%`,
          }}
        />
      </View>
    </View>
  );
}
