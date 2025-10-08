/**
 * Stage Progress Visualization
 *
 * Visual indicator showing harvest stage progression
 * Requirements: 2.1 (visual stage progression), 16.1 (accessibility)
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import {
  createHarvestStageA11yLabel,
  createStageProgressA11yLabel,
} from '@/lib/accessibility/labels';
import { getAllStages, getStageIndex } from '@/lib/harvest/stage-config';
import { type HarvestStage } from '@/types/harvest';

type Props = {
  currentStage: HarvestStage;
  className?: string;
};

/* eslint-disable max-lines-per-function */
export function StageProgress({ currentStage, className }: Props) {
  const { t } = useTranslation();
  const stages = getAllStages();
  const currentIndex = getStageIndex(currentStage);

  const progressLabel = createStageProgressA11yLabel({
    currentStage: t(`harvest.stages.${currentStage}`),
    totalStages: stages.length,
    completedStages: currentIndex,
  });

  return (
    <View
      className={className}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={progressLabel}
      accessibilityHint={t('harvest.stageProgress.hint.overview')}
      accessibilityValue={{
        min: 0,
        max: stages.length,
        now: currentIndex + 1,
      }}
    >
      {/* Stage dots and connectors */}
      <View className="flex-row items-center justify-between px-4">
        {stages.map((stage, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const connectorCompleted = index <= currentIndex;
          const stageName = t(`harvest.stages.${stage}`);

          return (
            <React.Fragment key={stage}>
              {/* Connector line (not before first stage) */}
              {index > 0 && (
                <View
                  className={`h-0.5 flex-1 ${
                    connectorCompleted ? 'bg-primary-600' : 'bg-neutral-300'
                  }`}
                  accessible={false}
                />
              )}

              {/* Stage dot */}
              <View className="items-center">
                <View
                  className={`size-10 items-center justify-center rounded-full ${
                    isCurrent
                      ? 'bg-primary-600'
                      : isCompleted
                        ? 'bg-primary-600'
                        : 'bg-neutral-300'
                  }`}
                  accessible
                  accessibilityLabel={createHarvestStageA11yLabel({
                    stage: stageName,
                    isCompleted,
                    isCurrent,
                  })}
                  accessibilityHint={
                    isCurrent
                      ? t('harvest.stageProgress.hint.current', {
                          stage: stageName,
                        })
                      : isCompleted
                        ? t('harvest.stageProgress.hint.completed', {
                            stage: stageName,
                          })
                        : t('harvest.stageProgress.hint.notStarted', {
                            stage: stageName,
                          })
                  }
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: true,
                    selected: isCurrent,
                  }}
                >
                  {isCompleted && !isCurrent && (
                    <Text className="text-base text-white">✓</Text>
                  )}
                  {isCurrent && (
                    <View className="size-4 rounded-full bg-white" />
                  )}
                </View>

                {/* Stage label */}
                <Text
                  className={`mt-2 text-xs ${
                    isCurrent
                      ? 'font-semibold text-primary-700'
                      : 'text-neutral-600'
                  }`}
                >
                  {stageName}
                </Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}
