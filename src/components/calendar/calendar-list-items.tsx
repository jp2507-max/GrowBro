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
      className="flex-row items-center justify-between bg-neutral-50 py-2 dark:bg-charcoal-950"
      testID={testID}
    >
      <Text className="text-lg font-bold text-charcoal-900 dark:text-neutral-100">
        {title}
      </Text>
      <View className="rounded-full bg-neutral-200 px-2 py-0.5 dark:bg-neutral-700">
        <Text className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
          {count}
        </Text>
      </View>
    </View>
  );
}

function EmptyState({ message }: { message: string }): React.ReactElement {
  return (
    <View className="items-center justify-center py-8">
      <Text className="text-base text-neutral-600 dark:text-neutral-400">
        {message}
      </Text>
    </View>
  );
}

function LoadingState(): React.ReactElement {
  return (
    <View className="items-center py-8">
      <ActivityIndicator />
    </View>
  );
}

// -----------------------------------------------------------------------------
// List data builder
// -----------------------------------------------------------------------------

export function buildCalendarListData(
  pendingTasks: Task[],
  completedTasks: Task[],
  isLoading: boolean
): CalendarListItem[] {
  const planTitle = translate('calendar.sections.plan');
  const historyTitle = translate('calendar.sections.history');
  const emptyPlanMessage = translate('calendar.sections.empty_plan');
  const emptyHistoryMessage = translate('calendar.sections.empty_history');

  const items: CalendarListItem[] = [];

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
      items.push({ type: 'task', task, isCompleted: false });
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
      items.push({ type: 'task', task, isCompleted: true });
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
