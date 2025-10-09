/**
 * Stage Timer Display
 *
 * Shows elapsed time and target duration for current stage
 * Requirements: 2.3 (timing guidance with server timestamps)
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  calculateElapsedTime,
  exceedsMaxDuration,
  getStageConfig,
} from '@/lib/harvest/stage-config';
import { type HarvestStage } from '@/types/harvest';

import { StageTimerProgress } from './stage-timer-progress';

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

  const timerLabel = `${t('harvest.stage_tracker.elapsed', {
    days: elapsed.days,
    hours: elapsed.hours,
    minutes: elapsed.minutes,
  })}. ${isOverdue ? t('harvest.stage_tracker.overdue', { days: Math.floor(elapsed.totalDays - config.max_duration_days) }) : t('harvest.stage_tracker.on_track')}`;

  return (
    <StageTimerProgress
      className={className}
      timerLabel={timerLabel}
      elapsed={elapsed}
      isOverdue={isOverdue}
      targetDays={targetDays}
      maxDurationDays={config.max_duration_days}
      t={t}
    />
  );
}
