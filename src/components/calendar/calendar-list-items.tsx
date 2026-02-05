import { DateTime } from 'luxon';
import * as React from 'react';

import { TimelineTaskCard } from '@/components/calendar/timeline-task-card';
import { ActivityIndicator, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';
import type { Task } from '@/types/calendar';

// Local type for task categorization
export type TaskType = 'watering' | 'feeding' | 'flush' | 'other';

/**
 * Formats a due time string for display (e.g., "08:00")
 */
function formatDueTime(dueAtLocal: string, timezone?: string): string {
  const zone = timezone ?? DateTime.local().zoneName ?? 'UTC';
  const dt = DateTime.fromISO(dueAtLocal, { zone });
  return dt.isValid ? dt.toFormat('HH:mm') : '';
}

// -----------------------------------------------------------------------------
// Item types for timeline list (Stitch design - no section headers)
// -----------------------------------------------------------------------------

export type TaskItem = {
  type: 'task';
  task: Task;
  taskType: TaskType;
  state: 'completed' | 'active' | 'pending' | 'future';
  isFirst: boolean;
  isLast: boolean;
  plantName?: string;
  plantImage?: string;
  dueTime?: string;
};

export type EmptyStateItem = {
  type: 'empty';
  message: string;
};

export type LoadingItem = {
  type: 'loading';
};

export type CalendarListItem = TaskItem | EmptyStateItem | LoadingItem;

// -----------------------------------------------------------------------------
// Utility functions
// -----------------------------------------------------------------------------

export function getItemKey(item: CalendarListItem, index: number): string {
  switch (item.type) {
    case 'task':
      return `task-${item.task.id}`;
    case 'empty':
      return `empty-${index}`;
    case 'loading':
      return `loading-${index}`;
    default:
      return `unknown-${index}`;
  }
}

export function getItemType(item: CalendarListItem): CalendarListItem['type'] {
  return item.type;
}

// -----------------------------------------------------------------------------
// List item components
// -----------------------------------------------------------------------------

function EmptyState({ message }: { message: string }): React.ReactElement {
  return (
    <View
      className="items-center justify-center py-12"
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
// Task type detection helper
// -----------------------------------------------------------------------------

function getTaskType(task: Task): TaskType {
  // Prefer engineKey for reliable type detection
  const engineKey = (
    task.metadata?.engineKey as string | undefined
  )?.toLowerCase();
  if (engineKey) {
    if (engineKey.includes('hydrology') || engineKey.includes('water'))
      return 'watering';
    if (engineKey.includes('nutrition') || engineKey.includes('feed'))
      return 'feeding';
    if (engineKey.includes('flush')) return 'flush';
  }
  // Fallback to title-based detection
  const title = task.title.toLowerCase();
  if (title.includes('water') || title.includes('wasser')) return 'watering';
  if (
    title.includes('feed') ||
    title.includes('nährstoff') ||
    title.includes('nutrient')
  )
    return 'feeding';
  if (title.includes('flush') || title.includes('spül')) return 'flush';
  return 'other';
}

// -----------------------------------------------------------------------------
// List data builder - Stitch unified timeline (no section headers)
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
  const emptyMessage = translate('calendar.no_tasks_for_day');

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

  // Combine all tasks into a unified timeline
  // Order: pending first (top), active highlighted, then completed at bottom
  const allTasks: {
    task: Task;
    isCompleted: boolean;
    isActive: boolean;
  }[] = [
    // Pending tasks - the first one is "active"
    ...pendingTasks.map((task, idx) => ({
      task,
      isCompleted: false,
      isActive: idx === 0, // First pending task is active
    })),
    // Completed tasks
    ...completedTasks.map((task) => ({
      task,
      isCompleted: true,
      isActive: false,
    })),
  ];

  if (allTasks.length === 0 && !isLoading) {
    items.push({ type: 'empty', message: emptyMessage });
    return items;
  }

  // Build timeline items with position metadata
  for (let i = 0; i < allTasks.length; i++) {
    const { task, isCompleted, isActive } = allTasks[i];
    const { plantName, plantImage } = getPlantInfoForTask(task);
    const taskType = getTaskType(task);
    const dueTime = formatDueTime(task.dueAtLocal, task.timezone);

    // Determine task state for timeline styling
    let state: 'completed' | 'active' | 'pending' | 'future';
    if (isCompleted) {
      state = 'completed';
    } else if (isActive) {
      state = 'active';
    } else {
      // Check if task is future-dated
      const due = new Date(task.dueAtLocal);
      const now = new Date();
      const isFuture = isFinite(due.getTime()) && due.getTime() > now.getTime();

      state = isFuture ? 'future' : 'pending';
    }

    items.push({
      type: 'task',
      task,
      taskType,
      state,
      isFirst: i === 0,
      isLast: i === allTasks.length - 1,
      plantName,
      plantImage,
      dueTime,
    });
  }

  // Add loading state at end if loading
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
  handleCompleteTask: (task: Task) => void,
  handleTaskPress?: (task: Task) => void
): (props: RenderItemProps) => React.ReactElement | null {
  return function renderItem({
    item,
  }: RenderItemProps): React.ReactElement | null {
    switch (item.type) {
      case 'task':
        return (
          <TimelineTaskCard
            task={item.task}
            taskType={item.taskType}
            state={item.state}
            plantName={item.plantName}
            dueTime={item.dueTime}
            isFirst={item.isFirst}
            isLast={item.isLast}
            onPress={() => handleTaskPress?.(item.task)}
            onComplete={() => handleCompleteTask(item.task)}
            testID={`timeline-task-${item.task.id}`}
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
