/**
 * Phase Timeline
 *
 * FlashList v2-backed timeline showing completed, current, and upcoming tasks
 * Targets 60 FPS performance with 1k+ items
 *
 * Requirements: 8.4, 8.5
 */

import { FlashList } from '@shopify/flash-list';
import { DateTime } from 'luxon';
import React, { useMemo } from 'react';

import { Pressable, Text, View } from '@/components/ui';
import type { TaskModel } from '@/lib/watermelon-models/task';
import type { GrowPhase } from '@/types/playbook';

type TimelineTask = {
  id: string;
  title: string;
  dueDate: string;
  status: 'completed' | 'pending' | 'skipped';
  phase: GrowPhase;
  phaseIndex: number;
  taskType: string;
  isOverdue: boolean;
};

type TimelineSection = {
  type: 'section';
  id: string;
  title: string;
  phase: GrowPhase;
  phaseIndex: number;
};

type TimelineItem = TimelineTask | TimelineSection;

type PhaseTimelineProps = {
  tasks: TaskModel[];
  currentPhaseIndex: number;
  timezone: string;
  onTaskPress?: (taskId: string) => void;
  className?: string;
};

const PHASE_LABELS: Record<GrowPhase, string> = {
  seedling: 'Seedling',
  veg: 'Vegetative',
  flower: 'Flowering',
  harvest: 'Harvest',
};

const PHASE_COLORS: Record<GrowPhase, string> = {
  seedling: 'bg-success-100 dark:bg-success-900/20',
  veg: 'bg-primary-100 dark:bg-primary-900/20',
  flower: 'bg-warning-100 dark:bg-warning-900/20',
  harvest: 'bg-danger-100 dark:bg-danger-900/20',
};

const PHASE_TEXT_COLORS: Record<GrowPhase, string> = {
  seedling: 'text-success-700 dark:text-success-300',
  veg: 'text-primary-700 dark:text-primary-300',
  flower: 'text-warning-700 dark:text-warning-300',
  harvest: 'text-danger-700 dark:text-danger-300',
};

function useTimelineItems(tasks: TaskModel[], timezone: string) {
  return useMemo(() => {
    const now = DateTime.now().setZone(timezone);
    const tasksByPhase = tasks.reduce(
      (acc, task) => {
        const phaseIndex = task.phaseIndex ?? 0;
        if (!acc[phaseIndex]) {
          acc[phaseIndex] = [];
        }
        acc[phaseIndex].push(task);
        return acc;
      },
      {} as Record<number, TaskModel[]>
    );

    const items: TimelineItem[] = [];

    Object.entries(tasksByPhase)
      .sort(([a], [b]) => Number(a) - Number(b))
      .forEach(([phaseIndexStr, phaseTasks]) => {
        const phaseIndex = Number(phaseIndexStr);
        const firstTask = phaseTasks[0];
        if (!firstTask) return;

        const phase = (firstTask.metadata?.phase as GrowPhase) || 'seedling';
        if (!phase) return;

        items.push({
          type: 'section',
          id: `section_${phaseIndex}`,
          title: PHASE_LABELS[phase] || phase,
          phase,
          phaseIndex,
        });

        const sortedTasks = [...phaseTasks].sort((a, b) => {
          const dateA = DateTime.fromISO(a.dueAtUtc, { zone: 'utc' });
          const dateB = DateTime.fromISO(b.dueAtUtc, { zone: 'utc' });
          return dateA.toMillis() - dateB.toMillis();
        });

        sortedTasks.forEach((task) => {
          const dueDate = DateTime.fromISO(task.dueAtUtc, {
            zone: 'utc',
          }).setZone(timezone);
          const isOverdue = dueDate < now && task.status === 'pending';

          items.push({
            id: task.id,
            title: task.title,
            dueDate: dueDate.toISO()!,
            status: task.status as any,
            phase,
            phaseIndex,
            taskType: (task.metadata?.taskType as string) || 'custom',
            isOverdue,
          });
        });
      });

    return items;
  }, [tasks, timezone]);
}

export function PhaseTimeline({
  tasks,
  currentPhaseIndex,
  timezone,
  onTaskPress,
  className,
}: PhaseTimelineProps) {
  const timelineItems = useTimelineItems(tasks, timezone);

  const renderItem = ({ item }: { item: TimelineItem }) => {
    if ('type' in item && item.type === 'section') {
      return (
        <SectionHeader section={item} currentPhaseIndex={currentPhaseIndex} />
      );
    }

    return (
      <TaskItem
        task={item as TimelineTask}
        onPress={onTaskPress}
        currentPhaseIndex={currentPhaseIndex}
      />
    );
  };

  if (timelineItems.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-center text-neutral-600 dark:text-neutral-400">
          No tasks found
        </Text>
      </View>
    );
  }

  return (
    <View className={`flex-1 ${className}`}>
      <FlashList
        data={timelineItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerClassName="pb-4"
      />
    </View>
  );
}

function SectionHeader({
  section,
  currentPhaseIndex,
}: {
  section: TimelineSection;
  currentPhaseIndex: number;
}) {
  const isCurrent = section.phaseIndex === currentPhaseIndex;
  const isCompleted = section.phaseIndex < currentPhaseIndex;
  const isUpcoming = section.phaseIndex > currentPhaseIndex;

  return (
    <View
      className={`mx-4 mb-2 mt-4 rounded-lg p-3 ${PHASE_COLORS[section.phase]}`}
    >
      <View className="flex-row items-center justify-between">
        <Text
          className={`text-base font-semibold ${PHASE_TEXT_COLORS[section.phase]}`}
        >
          {section.title}
        </Text>
        {isCurrent && (
          <View className="rounded-full bg-primary-500 px-2 py-0.5">
            <Text className="text-xs font-medium text-white">Current</Text>
          </View>
        )}
        {isCompleted && (
          <Text className="text-sm text-success-600 dark:text-success-400">
            ✓ Completed
          </Text>
        )}
        {isUpcoming && (
          <Text className="text-sm text-neutral-500 dark:text-neutral-500">
            Upcoming
          </Text>
        )}
      </View>
    </View>
  );
}

function StatusIndicator({
  isCompleted,
  isPending,
  isSkipped,
  isOverdue,
}: {
  isCompleted: boolean;
  isPending: boolean;
  isSkipped: boolean;
  isOverdue: boolean;
}) {
  return (
    <View
      className={`size-10 items-center justify-center rounded-full ${
        isCompleted
          ? 'bg-success-100 dark:bg-success-900/20'
          : isPending && isOverdue
            ? 'bg-danger-100 dark:bg-danger-900/20'
            : isPending
              ? 'bg-primary-100 dark:bg-primary-900/20'
              : 'bg-neutral-100 dark:bg-neutral-800'
      }`}
    >
      {isCompleted && (
        <Text className="text-lg text-success-600 dark:text-success-400">
          ✓
        </Text>
      )}
      {isPending && !isOverdue && (
        <View className="size-3 rounded-full border-2 border-primary-500" />
      )}
      {isPending && isOverdue && (
        <Text className="text-lg text-danger-600 dark:text-danger-400">!</Text>
      )}
      {isSkipped && (
        <Text className="text-lg text-neutral-500 dark:text-neutral-500">
          −
        </Text>
      )}
    </View>
  );
}

function TaskInfo({
  title,
  dueDate,
  isCompleted,
  isPending,
  isOverdue,
}: {
  title: string;
  dueDate: DateTime;
  isCompleted: boolean;
  isPending: boolean;
  isOverdue: boolean;
}) {
  return (
    <View className="flex-1">
      <Text
        className={`text-base ${
          isCompleted
            ? 'text-neutral-500 line-through dark:text-neutral-500'
            : 'text-neutral-900 dark:text-neutral-100'
        }`}
      >
        {title}
      </Text>
      <View className="mt-1 flex-row items-center gap-2">
        <Text
          className={`text-sm ${
            isOverdue && isPending
              ? 'text-danger-600 dark:text-danger-400'
              : 'text-neutral-600 dark:text-neutral-400'
          }`}
        >
          {dueDate.toFormat('MMM d, h:mm a')}
        </Text>
        {isOverdue && isPending && (
          <Text className="text-xs text-danger-600 dark:text-danger-400">
            Overdue
          </Text>
        )}
      </View>
    </View>
  );
}

function TaskItem({
  task,
  onPress,
}: {
  task: TimelineTask;
  onPress?: (taskId: string) => void;
  currentPhaseIndex: number;
}) {
  const dueDate = DateTime.fromISO(task.dueDate);
  const isCompleted = task.status === 'completed';
  const isPending = task.status === 'pending';
  const isSkipped = task.status === 'skipped';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress?.(task.id)}
      className="mx-4 mb-2 flex-row items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <StatusIndicator
        isCompleted={isCompleted}
        isPending={isPending}
        isSkipped={isSkipped}
        isOverdue={task.isOverdue}
      />
      <TaskInfo
        title={task.title}
        dueDate={dueDate}
        isCompleted={isCompleted}
        isPending={isPending}
        isOverdue={task.isOverdue}
      />
      <Text className="text-neutral-400 dark:text-neutral-600">›</Text>
    </Pressable>
  );
}
