import * as React from 'react';

import { ActivityIndicator, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';
import type { Task } from '@/types/calendar';

import { DayTaskRow } from './day-task-row';

// -----------------------------------------------------------------------------
// Item types for sectioned list
// -----------------------------------------------------------------------------

export type SectionHeaderItem = {
  type: 'section-header';
  title: string;
  count: number;
  testID: string;
};

export type TaskItem = {
  type: 'task';
  task: Task;
  isCompleted: boolean;
  plantName?: string;
  plantImage?: string;
};

export type EmptyStateItem = {
  type: 'empty';
  message: string;
};

export type LoadingItem = {
  type: 'loading';
};

export type CalendarListItem =
  | SectionHeaderItem
  | TaskItem
  | EmptyStateItem
  | LoadingItem;

// -----------------------------------------------------------------------------
// Utility functions
// -----------------------------------------------------------------------------

export function getItemKey(item: CalendarListItem, index: number): string {
  switch (item.type) {
    case 'section-header':
      return `header-${item.testID}`;
    case 'task':
      return `task-${item.task.id}`;
    case 'empty':
      return `empty-${index}`;
    case 'loading':
      return `loading-${index}`;
    default: {
      return `unknown-${index}`;
    }
  }
}

export function getItemType(item: CalendarListItem): CalendarListItem['type'] {
  return item.type;
}

// -----------------------------------------------------------------------------
// List item components
// -----------------------------------------------------------------------------

function SectionHeader({
  title,
  count,
  testID,
}: {
  title: string;
  count: number;
  testID: string;
}): React.ReactElement {
  return (
    <View
      className="flex-row items-center justify-between bg-neutral-50 pb-2 pt-4 dark:bg-charcoal-950"
      testID={testID}
      accessible={true}
      accessibilityRole="header"
      accessibilityLabel={`${title}, ${count} items`}
      accessibilityHint="Section header"
    >
      <Text className="text-lg font-bold text-charcoal-900 dark:text-neutral-100">
        {title}
      </Text>
      <View className="min-w-[28px] items-center rounded-full bg-primary-100 px-2.5 py-1 dark:bg-primary-900/40">
        <Text className="text-sm font-bold text-primary-700 dark:text-primary-300">
          {count}
        </Text>
      </View>
    </View>
  );
}

function EmptyState({ message }: { message: string }): React.ReactElement {
  return (
    <View
      className="items-center justify-center py-8"
      testID="calendar-empty-state"
    >
      <Text className="text-base text-neutral-600 dark:text-neutral-400">
        {message}
      </Text>
    </View>
  );
}

function LoadingState(): React.ReactElement {
  return (
    <View className="items-center py-8" testID="calendar-loading-state">
      <ActivityIndicator />
    </View>
  );
}

// -----------------------------------------------------------------------------
// Plant info type for calendar list building
// -----------------------------------------------------------------------------

export type PlantInfo = {
  id: string;
  name: string;
  imageUrl?: string | null;
};

// -----------------------------------------------------------------------------
// List data builder
// -----------------------------------------------------------------------------

export type BuildCalendarListDataOptions = {
  pendingTasks: Task[];
  completedTasks: Task[];
  isLoading: boolean;
  plantMap?: Map<string, PlantInfo>;
};

export function buildCalendarListData(
  options: BuildCalendarListDataOptions
): CalendarListItem[] {
  const { pendingTasks, completedTasks, isLoading, plantMap } = options;
  const planTitle = translate('calendar.sections.plan');
  const historyTitle = translate('calendar.sections.history');
  const emptyPlanMessage = translate('calendar.sections.empty_plan');
  const emptyHistoryMessage = translate('calendar.sections.empty_history');

  const items: CalendarListItem[] = [];

  // Helper to get plant info for a task
  const getPlantInfoForTask = (
    task: Task
  ): { plantName?: string; plantImage?: string } => {
    if (!task.plantId || !plantMap) return {};
    const plant = plantMap.get(task.plantId);
    if (!plant) return {};
    return {
      plantName: plant.name,
      plantImage: plant.imageUrl ?? undefined,
    };
  };

  // Plan section
  items.push({
    type: 'section-header',
    title: planTitle,
    count: pendingTasks.length,
    testID: 'calendar-plan-section-header',
  });

  if (pendingTasks.length === 0 && !isLoading) {
    items.push({ type: 'empty', message: emptyPlanMessage });
  } else if (pendingTasks.length > 0) {
    for (const task of pendingTasks) {
      const { plantName, plantImage } = getPlantInfoForTask(task);
      items.push({
        type: 'task',
        task,
        isCompleted: false,
        plantName,
        plantImage,
      });
    }
  }

  // History section
  items.push({
    type: 'section-header',
    title: historyTitle,
    count: completedTasks.length,
    testID: 'calendar-history-section-header',
  });

  if (completedTasks.length === 0 && !isLoading) {
    items.push({ type: 'empty', message: emptyHistoryMessage });
  } else if (completedTasks.length > 0) {
    for (const task of completedTasks) {
      const { plantName, plantImage } = getPlantInfoForTask(task);
      items.push({
        type: 'task',
        task,
        isCompleted: true,
        plantName,
        plantImage,
      });
    }
  }

  // Add single loading state at the end if loading globally
  if (isLoading) {
    items.push({ type: 'loading' });
  }

  return items;
}

// -----------------------------------------------------------------------------
// Render item function factory
// -----------------------------------------------------------------------------

type RenderItemProps = {
  item: CalendarListItem;
};

export function createRenderItem(
  handleCompleteTask: (task: Task) => void
): (props: RenderItemProps) => React.ReactElement | null {
  return function renderItem({
    item,
  }: RenderItemProps): React.ReactElement | null {
    switch (item.type) {
      case 'section-header':
        return (
          <SectionHeader
            title={item.title}
            count={item.count}
            testID={item.testID}
          />
        );
      case 'task':
        return (
          <DayTaskRow
            task={item.task}
            plantName={item.plantName}
            plantImage={item.plantImage}
            onComplete={handleCompleteTask}
            isCompleted={item.isCompleted}
            testID={
              item.isCompleted
                ? `history-task-${item.task.id}`
                : `plan-task-${item.task.id}`
            }
          />
        );
      case 'empty':
        return <EmptyState message={item.message} />;
      case 'loading':
        return <LoadingState />;
      default:
        return null;
    }
  };
}
