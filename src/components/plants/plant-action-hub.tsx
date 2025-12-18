import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Check, Droplet } from '@/components/ui/icons';

type ActionHubProps = {
  plantId: string;
  /** Optional pending tasks to display. If empty, shows success card. */
  tasks?: {
    id: string;
    title: string;
    type?: 'water' | 'feed' | 'other';
  }[];
  onTaskPress?: (taskId: string) => void;
};

/**
 * Action Hub section showing today's tasks for the plant.
 * Displays a success card when no tasks, or prominent CTA buttons when tasks exist.
 */
export function PlantActionHub({
  plantId: _plantId,
  tasks = [],
  onTaskPress,
}: ActionHubProps): React.ReactElement {
  const { t } = useTranslation();

  const hasTasks = tasks.length > 0;

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
              className="w-full rounded-2xl bg-terracotta-500 py-4 shadow-lg shadow-terracotta-200 active:bg-terracotta-600"
              textClassName="text-white text-base font-semibold"
              onPress={() => onTaskPress?.(task.id)}
              label={task.title}
              testID={`action-task-${task.id}`}
            >
              {task.type === 'water' ? (
                <Droplet color="#fff" width={18} height={18} />
              ) : null}
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
    </View>
  );
}
