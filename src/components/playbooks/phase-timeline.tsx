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
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Checkbox, Text, View } from '@/components/ui';
import type { TaskModel } from '@/lib/watermelon-models/task';
import type { GrowPhase } from '@/types/playbook';

const VALID_GROW_PHASES = new Set<GrowPhase>([
  'seedling',
  'veg',
  'flower',
  'harvest',
]);

function isValidGrowPhase(value: unknown): value is GrowPhase {
  return typeof value === 'string' && VALID_GROW_PHASES.has(value as GrowPhase);
}

function validateGrowPhase(
  value: unknown,
  fallback: GrowPhase = 'seedling'
): GrowPhase {
  if (isValidGrowPhase(value)) {
    return value;
  }

  console.warn(
    `Invalid GrowPhase encountered: ${String(value)}. Falling back to '${fallback}'.`
  );
  return fallback;
}

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

const PHASE_LABEL_KEYS: Record<GrowPhase, string> = {
  seedling: 'phases.seedling',
  veg: 'phases.veg',
  flower: 'phases.flower',
  harvest: 'phases.harvest',
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

function useTimelineItems(
  tasks: TaskModel[],
  timezone: string,
  t: (key: string, options?: any) => string
) {
  return useMemo(() => {
    const now = DateTime.now().setZone(timezone);
    const tasksByPhase = groupTasksByPhase(tasks);
    const items: TimelineItem[] = [];

    Object.entries(tasksByPhase)
      .sort(([a], [b]) => Number(a) - Number(b))
      .forEach(([phaseIndexStr, phaseTasks]) => {
        const phaseIndex = Number(phaseIndexStr);
        const sectionItem = createSectionItem(phaseTasks[0], phaseIndex, t);
        if (sectionItem) items.push(sectionItem);

        const taskItems = createTaskItems({
          phaseTasks,
          phaseIndex,
          timezone,
          now,
        });
        items.push(...taskItems);
      });

    return items;
  }, [tasks, timezone, t]);
}

function groupTasksByPhase(tasks: TaskModel[]): Record<number, TaskModel[]> {
  return tasks.reduce(
    (acc, task) => {
      const phaseIndex = task.phaseIndex ?? 0;
      if (!acc[phaseIndex]) acc[phaseIndex] = [];
      acc[phaseIndex].push(task);
      return acc;
    },
    {} as Record<number, TaskModel[]>
  );
}

function createSectionItem(
  firstTask: TaskModel | undefined,
  phaseIndex: number,
  t: (key: string, options?: any) => string
): TimelineSection | null {
  if (!firstTask) return null;

  const phase = validateGrowPhase(firstTask.metadata?.phase);
  if (!phase) return null;

  return {
    type: 'section',
    id: `section_${phaseIndex}`,
    title: t(PHASE_LABEL_KEYS[phase] ?? 'phases.unknown', {
      defaultValue: phase,
    }),
    phase,
    phaseIndex,
  };
}

function createTaskItems({
  phaseTasks,
  phaseIndex,
  timezone,
  now,
}: {
  phaseTasks: TaskModel[];
  phaseIndex: number;
  timezone: string;
  now: DateTime;
}): TimelineTask[] {
  const sortedTasks = [...phaseTasks].sort((a, b) => {
    const dateA = DateTime.fromISO(a.dueAtUtc, { zone: 'utc' });
    const dateB = DateTime.fromISO(b.dueAtUtc, { zone: 'utc' });
    return dateA.toMillis() - dateB.toMillis();
  });

  return sortedTasks.map((task) => {
    const dueDate = DateTime.fromISO(task.dueAtUtc, { zone: 'utc' }).setZone(
      timezone
    );
    const isOverdue = dueDate < now && task.status === 'pending';

    const validStatuses = ['completed', 'pending', 'skipped'] as const;
    const status = validStatuses.includes(task.status as any)
      ? (task.status as 'completed' | 'pending' | 'skipped')
      : 'pending';

    return {
      id: task.id,
      title: task.title,
      dueDate: dueDate.toISO()!,
      status,
      phase: validateGrowPhase(task.metadata?.phase),
      phaseIndex,
      taskType: (task.metadata?.taskType as string) || 'custom',
      isOverdue,
    };
  });
}

export function PhaseTimeline({
  tasks,
  currentPhaseIndex,
  timezone,
  onTaskPress,
  className,
}: PhaseTimelineProps) {
  const { t } = useTranslation();
  const timelineItems = useTimelineItems(tasks, timezone, t);

  const renderItem = useCallback(
    ({ item, index }: { item: TimelineItem; index: number }) => {
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
          index={index}
        />
      );
    },
    [currentPhaseIndex, onTaskPress]
  );

  const keyExtractor = useCallback((item: TimelineItem) => item.id, []);
  const getItemType = useCallback(
    (item: TimelineItem) => ('type' in item ? item.type : 'task'),
    []
  );

  if (timelineItems.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-center text-neutral-600 dark:text-neutral-400">
          {t('playbook.noTasks')}
        </Text>
      </View>
    );
  }

  return (
    <View className={`flex-1 ${className}`} testID="phase-timeline">
      <FlashList
        data={timelineItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
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
  const { t } = useTranslation();
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
            <Text className="text-xs font-medium text-white">
              {t('playbook.status.current')}
            </Text>
          </View>
        )}
        {isCompleted && (
          <Text className="text-sm text-success-600 dark:text-success-400">
            {t('playbook.status.completed')}
          </Text>
        )}
        {isUpcoming && (
          <Text className="text-sm text-neutral-500 dark:text-neutral-500">
            {t('playbook.status.upcoming')}
          </Text>
        )}
      </View>
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
  const { t } = useTranslation();

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
            {t('playbooks.overdue')}
          </Text>
        )}
      </View>
    </View>
  );
}

function TaskItem({
  task,
  onPress,
  index,
}: {
  task: TimelineTask;
  onPress?: (taskId: string) => void;
  currentPhaseIndex: number;
  index: number;
}) {
  const dueDate = DateTime.fromISO(task.dueDate);
  const isCompleted = task.status === 'completed';
  const isPending = task.status === 'pending';

  return (
    <View className="mx-4 mb-2 flex-row items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <Checkbox.Root
        checked={isCompleted}
        onChange={(checked) => {
          if (checked && !isCompleted) {
            onPress?.(task.id);
          }
        }}
        accessibilityLabel={`Complete task: ${task.title}`}
        accessibilityHint="Tap to mark this task as completed"
        testID={`task-checkbox-${index}`}
        className="shrink-0"
      >
        <Checkbox.Icon checked={isCompleted} />
      </Checkbox.Root>
      <TaskInfo
        title={task.title}
        dueDate={dueDate}
        isCompleted={isCompleted}
        isPending={isPending}
        isOverdue={task.isOverdue}
      />
      <Text className="text-neutral-400 dark:text-neutral-600">›</Text>
    </View>
  );
}
