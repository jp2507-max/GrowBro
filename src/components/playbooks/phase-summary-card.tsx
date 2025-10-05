/**
 * Phase Summary Card
 *
 * Displays summary of activities and outcomes for a completed phase
 *
 * Requirements: 8.6
 */

import { DateTime } from 'luxon';
import React from 'react';

import { Text, View } from '@/components/ui';
import type { PhaseSummary } from '@/lib/playbooks/phase-tracker';

type PhaseSummaryCardProps = {
  summary: PhaseSummary;
  className?: string;
};

const PHASE_LABELS: Record<string, string> = {
  seedling: 'Seedling Phase',
  veg: 'Vegetative Phase',
  flower: 'Flowering Phase',
  harvest: 'Harvest Phase',
};

const TASK_TYPE_LABELS: Record<string, string> = {
  water: 'Watering',
  feed: 'Feeding',
  prune: 'Pruning',
  train: 'Training',
  monitor: 'Monitoring',
  note: 'Notes',
  custom: 'Custom',
};

function ProgressBar({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  return (
    <View className="mb-3 flex-row items-center gap-2">
      <View className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <View
          className="h-full bg-success-500"
          style={{
            width: `${(completed / total) * 100}%`,
          }}
        />
      </View>
      <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {completed}/{total}
      </Text>
    </View>
  );
}

function ActivitiesSection({
  activities,
}: {
  activities: { taskType: string; count: number }[];
}) {
  if (activities.length === 0) return null;

  return (
    <View className="mb-3">
      <Text className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        Activities
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {activities.map((activity) => (
          <View
            key={activity.taskType}
            className="rounded-lg bg-neutral-100 px-3 py-1.5 dark:bg-neutral-800"
          >
            <Text className="text-xs text-neutral-700 dark:text-neutral-300">
              {TASK_TYPE_LABELS[activity.taskType] || activity.taskType}:{' '}
              {activity.count}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function OutcomesSection({ outcomes }: { outcomes: string[] }) {
  if (outcomes.length === 0) return null;

  return (
    <View>
      <Text className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        Outcomes
      </Text>
      {outcomes.map((outcome, index) => (
        <View key={index} className="mb-1 flex-row items-start gap-2">
          <Text className="text-success-600 dark:text-success-400">•</Text>
          <Text className="flex-1 text-sm text-neutral-600 dark:text-neutral-400">
            {outcome}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function PhaseSummaryCard({
  summary,
  className,
}: PhaseSummaryCardProps) {
  const startDate = DateTime.fromISO(summary.startDate);
  const endDate = DateTime.fromISO(summary.endDate);
  const duration = endDate.diff(startDate, 'days').days;

  return (
    <View
      className={`rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 ${className}`}
    >
      <View className="mb-3">
        <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {PHASE_LABELS[summary.phase] || summary.phase}
        </Text>
        <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          {startDate.toFormat('MMM d')} - {endDate.toFormat('MMM d, yyyy')} (
          {Math.round(duration)} days)
        </Text>
      </View>

      <ProgressBar
        completed={summary.completedTasks}
        total={summary.totalTasks}
      />
      <ActivitiesSection activities={summary.activities} />
      <OutcomesSection outcomes={summary.outcomes} />
    </View>
  );
}
