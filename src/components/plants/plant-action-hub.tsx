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

export type ActionHubTask = {
  id: string;
  title: string;
  description?: string;
  type?: 'water' | 'feed' | 'other';
  completed?: boolean;
};

type ActionHubProps = {
  plantId: string;
  /** Plant stage for conditional harvest button */
  plantStage?: PlantStage;
  /** Tasks to display. If empty, shows success card. */
  tasks?: ActionHubTask[];
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
  type: 'water' | 'feed' | 'other' | undefined,
  completed?: boolean
): React.ReactElement {
  const iconSize = 20;
  const opacity = completed ? 0.5 : 1;

  if (type === 'water') {
    return (
      <Droplet
        color={completed ? colors.neutral[500] : colors.sky[500]}
        width={iconSize}
        height={iconSize}
        style={{ opacity }}
      />
    );
  }
  // feed or other => leaf icon
  return (
    <Leaf
      color={completed ? colors.neutral[500] : colors.success[500]}
      width={iconSize}
      height={iconSize}
      style={{ opacity }}
    />
  );
}

type ActionHubHeaderProps = {
  hasTasks: boolean;
  remainingCount: number;
  t: (key: string, options?: Record<string, unknown>) => string;
};

function ActionHubHeader({
  hasTasks,
  remainingCount,
  t,
}: ActionHubHeaderProps): React.ReactElement {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-lg font-bold text-white" testID="action-hub-header">
        {t('plants.detail.action_hub_title')}
      </Text>
      {hasTasks && remainingCount > 0 && (
        <View className="rounded-lg bg-primary-500/20 px-2.5 py-1">
          <Text className="text-xs font-semibold text-primary-400">
            {t('plants.detail.tasks_remaining', { count: remainingCount })}
          </Text>
        </View>
      )}
    </View>
  );
}

type ActionHubTaskItemProps = {
  task: ActionHubTask;
  onPress?: (taskId: string) => void;
  t: (key: string) => string;
};

function ActionHubTaskItem({
  task,
  onPress,
  t,
}: ActionHubTaskItemProps): React.ReactElement {
  return (
    <Pressable
      key={task.id}
      onPress={() => onPress?.(task.id)}
      className="flex-row items-center gap-4 rounded-xl border border-white/5 bg-white/5 p-4 active:bg-white/10"
      accessibilityRole="button"
      accessibilityLabel={task.title}
      accessibilityHint={t('calendar.task_row.task_hint')}
      testID={`action-task-${task.id}`}
    >
      <View className="relative items-center justify-center">
        {task.completed ? (
          <View className="size-6 items-center justify-center rounded-lg border-2 border-primary-500 bg-primary-500">
            <Check color={colors.black} size={16} />
          </View>
        ) : (
          <View className="size-6 rounded-lg border-2 border-neutral-500" />
        )}
      </View>

      <View className="flex-1">
        <Text
          className={`text-base font-semibold ${
            task.completed ? 'text-white/50 line-through' : 'text-white'
          }`}
          numberOfLines={2}
        >
          {task.title || t('card.untitled')}
        </Text>
        {task.description ? (
          <Text
            className={`text-sm ${
              task.completed
                ? 'text-neutral-500 line-through'
                : 'text-neutral-400'
            }`}
            numberOfLines={2}
          >
            {task.description}
          </Text>
        ) : null}
      </View>

      <View className="size-8 items-center justify-center rounded-full bg-white/5">
        {getTaskIcon(task.type, task.completed)}
      </View>
    </Pressable>
  );
}

type ActionHubTaskListProps = {
  tasks: ActionHubTask[];
  onTaskPress?: (taskId: string) => void;
  t: (key: string) => string;
};

function ActionHubTaskList({
  tasks,
  onTaskPress,
  t,
}: ActionHubTaskListProps): React.ReactElement {
  return (
    <View className="gap-3">
      {tasks.map((task) => (
        <ActionHubTaskItem
          key={task.id}
          task={task}
          onPress={onTaskPress}
          t={t}
        />
      ))}
    </View>
  );
}

function ActionHubSuccessCard({
  t,
}: {
  t: (key: string) => string;
}): React.ReactElement {
  return (
    <View className="overflow-hidden rounded-3xl border border-white/10 bg-neutral-900/40 backdrop-blur-md">
      <View className="flex-row items-center gap-3 p-5">
        <View className="size-10 items-center justify-center rounded-full bg-lime-400/20">
          <Check color={colors.lime[400]} size={20} />
        </View>
        <Text className="flex-1 text-base font-medium text-lime-100">
          {t('plants.detail.all_good_message')}
        </Text>
      </View>
    </View>
  );
}

function ActionHubHarvestButton({
  onHarvestPress,
  t,
}: {
  onHarvestPress: () => void;
  t: (key: string) => string;
}): React.ReactElement {
  return (
    <Button
      variant="default"
      className="h-auto w-full rounded-2xl bg-gradient-to-r from-lime-500 to-lime-600 py-4 shadow-lg shadow-lime-900/20 active:opacity-90"
      textClassName="text-white text-lg font-bold"
      onPress={onHarvestPress}
      testID="action-start-harvest"
    >
      <View className="flex-row items-center justify-center gap-2">
        <Leaf color={colors.white} width={20} height={20} />
        <Text className="text-lg font-bold text-white">
          {t('plants.detail.start_harvest')}
        </Text>
      </View>
    </Button>
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
  const remainingCount = tasks.filter((t) => !t.completed).length;
  const productStage = toProductStage(plantStage);
  const canHarvest = Boolean(
    productStage && HARVEST_ELIGIBLE_STAGES.includes(productStage)
  );

  return (
    <View className="gap-4 px-4">
      <ActionHubHeader
        hasTasks={hasTasks}
        remainingCount={remainingCount}
        t={t}
      />

      {hasTasks ? (
        <ActionHubTaskList tasks={tasks} onTaskPress={onTaskPress} t={t} />
      ) : (
        <ActionHubSuccessCard t={t} />
      )}

      {canHarvest && onHarvestPress ? (
        <ActionHubHarvestButton onHarvestPress={onHarvestPress} t={t} />
      ) : null}
    </View>
  );
}
