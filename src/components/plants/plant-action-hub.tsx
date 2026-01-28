import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import type { PlantStage } from '@/api/plants/types';
import { Button, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Check, Droplet, Leaf } from '@/components/ui/icons';
import {
  type ProductPlantStage,
  toProductStage,
} from '@/lib/plants/product-stage';

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
 * Displays a success card when no tasks, or a sleek checklist widget when tasks exist.
 */
/** Stages where harvest button should be shown */
const HARVEST_ELIGIBLE_STAGES: ProductPlantStage[] = ['flowering'];

function getTaskIcon(
  type: 'water' | 'feed' | 'other' | undefined
): React.ReactElement {
  const iconSize = 18;
  if (type === 'water') {
    return (
      <Droplet color={colors.sky[500]} width={iconSize} height={iconSize} />
    );
  }
  // feed or other => leaf icon
  return (
    <Leaf color={colors.success[500]} width={iconSize} height={iconSize} />
  );
}

export function PlantActionHub({
  plantId: _plantId,
  plantStage,
  tasks = [],
  onTaskPress,
  onHarvestPress,
}: ActionHubProps): React.ReactElement {
  const { t } = useTranslation();

  const hasTasks = tasks.length > 0;
  const productStage = toProductStage(plantStage);
  const canHarvest =
    productStage && HARVEST_ELIGIBLE_STAGES.includes(productStage);

  return (
    <View className="gap-3 px-4">
      {/* Section Header */}
      <Text
        className="text-base font-semibold text-neutral-700 dark:text-neutral-300"
        testID="action-hub-header"
      >
        {t('plants.detail.action_hub_title')}
      </Text>

      {/* Task Checklist or Success State */}
      {hasTasks ? (
        <View className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-white/10 dark:bg-white/5">
          {tasks.map((task, index) => (
            <Pressable
              key={task.id}
              onPress={() => onTaskPress?.(task.id)}
              className={`flex-row items-center gap-3 px-4 py-3.5 active:bg-neutral-100 dark:active:bg-white/10 ${
                index < tasks.length - 1
                  ? 'border-b border-neutral-200 dark:border-white/10'
                  : ''
              }`}
              accessibilityRole="button"
              accessibilityLabel={task.title}
              accessibilityHint={t('calendar.task_row.task_hint')}
              testID={`action-task-${task.id}`}
            >
              {/* Task Icon */}
              <View className="size-8 items-center justify-center rounded-full bg-white dark:bg-white/10">
                {getTaskIcon(task.type)}
              </View>

              {/* Task Title */}
              <Text className="flex-1 text-base font-medium text-neutral-900 dark:text-neutral-200">
                {task.title}
              </Text>

              {/* Checkbox Circle */}
              <View className="size-6 items-center justify-center rounded-full border-2 border-neutral-300 dark:border-neutral-600" />
            </Pressable>
          ))}
        </View>
      ) : (
        /* Success Card - All Good State */
        <View className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-white/10 dark:bg-white/5">
          <View className="flex-row items-center gap-3 px-4 py-3.5">
            <View className="size-8 items-center justify-center rounded-full bg-primary-100/70 dark:bg-primary-800/20">
              <Check color={colors.primary[600]} size={18} />
            </View>
            <Text className="flex-1 text-sm font-medium text-primary-700 dark:text-primary-300">
              {t('plants.detail.all_good_message')}
            </Text>
          </View>
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
