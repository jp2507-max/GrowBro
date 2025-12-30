import React from 'react';
import { useTranslation } from 'react-i18next';

import type { PlantStage } from '@/api/plants/types';
import { Button, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Check, Droplet, Leaf } from '@/components/ui/icons';

type ActionHubProps = {
  plantId: string;
  /** Plant stage for conditional harvest button */
  plantStage?: PlantStage;
  /** Optional pending tasks to display. If empty, shows success card. */
  tasks?: {
    id: string;
    title: string;
    type?: 'water' | 'feed' | 'other';
  }[];
  onTaskPress?: (taskId: string) => void;
  /** Called when harvest button is pressed */
  onHarvestPress?: () => void;
};

/**
 * Action Hub section showing today's tasks for the plant.
 * Displays a success card when no tasks, or prominent CTA buttons when tasks exist.
 */
/** Stages where harvest button should be shown */
const HARVEST_ELIGIBLE_STAGES: PlantStage[] = ['flowering'];

export function PlantActionHub({
  plantId: _plantId,
  plantStage,
  tasks = [],
  onTaskPress,
  onHarvestPress,
}: ActionHubProps): React.ReactElement {
  const { t } = useTranslation();

  const hasTasks = tasks.length > 0;
  const canHarvest = plantStage && HARVEST_ELIGIBLE_STAGES.includes(plantStage);

  return (
    <View className="gap-3 px-4">
      {/* Section Header */}
      <Text className="text-base font-semibold text-neutral-700 dark:text-neutral-300">
        {t('plants.detail.action_hub_title')}
      </Text>

      {/* Task List or Success State */}
      {hasTasks ? (
        <View className="gap-2">
          {tasks.map((task) => (
            <Button
              key={task.id}
              variant="default"
              className="h-auto w-full rounded-2xl py-4 shadow-lg shadow-terracotta-200 dark:shadow-none"
              textClassName="text-white text-base font-semibold"
              onPress={() => onTaskPress?.(task.id)}
              testID={`action-task-${task.id}`}
            >
              <View className="flex-row items-center justify-center gap-2">
                {task.type === 'water' ? (
                  <Droplet color={colors.white} width={18} height={18} />
                ) : null}
                <Text className="text-base font-semibold text-white">
                  {task.title}
                </Text>
              </View>
            </Button>
          ))}
        </View>
      ) : (
        /* Success Card - All Good State */
        <View className="flex-row items-center rounded-2xl border border-primary-100/50 bg-primary-50/50 p-4 dark:border-primary-800/30 dark:bg-primary-900/10">
          <View className="mr-3 size-10 items-center justify-center rounded-full bg-primary-100/70 dark:bg-primary-800/20">
            <Check color={colors.primary[600]} size={22} />
          </View>
          <Text className="flex-1 text-sm font-medium text-primary-700 dark:text-primary-300">
            {t('plants.detail.all_good_message')}
          </Text>
        </View>
      )}

      {/* Harvest Button - Shown when plant is in flowering stage */}
      {canHarvest && onHarvestPress ? (
        <Button
          variant="default"
          className="h-auto w-full rounded-2xl bg-success-600 py-4 shadow-lg shadow-success-200 active:bg-success-700 dark:shadow-none"
          textClassName="text-white text-base font-semibold"
          onPress={onHarvestPress}
          testID="action-start-harvest"
        >
          <View className="flex-row items-center justify-center gap-2">
            <Leaf color={colors.white} width={18} height={18} />
            <Text className="text-base font-semibold text-white">
              {t('plants.detail.start_harvest')}
            </Text>
          </View>
        </Button>
      ) : null}
    </View>
  );
}
