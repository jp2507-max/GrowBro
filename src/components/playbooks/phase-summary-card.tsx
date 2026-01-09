/**
 * Phase Summary Card
 *
 * Displays summary of activities and outcomes for a completed phase
 *
 * Requirements: 8.6
 */

import { DateTime } from 'luxon';
import React, { type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/ui';
import type { PhaseSummary } from '@/lib/playbooks/phase-tracker';

type PhaseSummaryCardProps = {
  summary: PhaseSummary;
  className?: string;
};

function getPhaseLabel(t: (key: string) => string, phase: string): string {
  return t(`playbooks.phases.${phase}`) || phase;
}

function getTaskTypeLabel(
  t: (key: string) => string,
  taskType: string
): string {
  return t(`playbooks.task_types.${taskType}`) || taskType;
}

function ProgressBar({
  completed,
  total,
}: {
  completed: number;
  total: number;
}): JSX.Element {
  return (
    <View className="mb-3 flex-row items-center gap-2">
      <View className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
        <View
          className="h-full bg-success-500"
          style={{
            width: `${(completed / total) * 100}%`,
          }}
        />
      </View>
      <Text className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
        {completed}/{total}
      </Text>
    </View>
  );
}

function ActivitiesSection({
  activities,
  t,
}: {
  activities: { taskType: string; count: number }[];
  t: (key: string) => string;
}): JSX.Element | null {
  if (activities.length === 0) return null;

  return (
    <View className="mb-3">
      <Text className="mb-2 text-sm font-medium text-neutral-600 dark:text-neutral-400">
        {t('playbooks.activities')}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {activities.map((activity) => (
          <View
            key={activity.taskType}
            className="rounded-lg bg-white px-3 py-1.5 dark:bg-charcoal-900"
          >
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              {getTaskTypeLabel(t, activity.taskType)}: {activity.count}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function OutcomesSection({
  outcomes,
  t,
}: {
  outcomes: string[];
  t: (key: string) => string;
}): JSX.Element | null {
  if (outcomes.length === 0) return null;

  return (
    <View>
      <Text className="mb-2 text-sm font-medium text-neutral-500 dark:text-neutral-400">
        {t('playbooks.outcomes')}
      </Text>
      {outcomes.map((outcome, index) => (
        <View key={index} className="mb-1 flex-row items-start gap-2">
          <Text className="text-success-600 dark:text-success-400">•</Text>
          <Text className="flex-1 text-sm text-neutral-500 dark:text-neutral-400">
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
}: PhaseSummaryCardProps): JSX.Element {
  const { t } = useTranslation();
  const startDate = DateTime.fromISO(summary.startDate);
  const endDate = DateTime.fromISO(summary.endDate);
  const duration = endDate.diff(startDate, 'days').days;

  return (
    <View
      className={`rounded-xl border border-neutral-200 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-900 ${className}`}
      testID="phase-summary-card"
    >
      <View className="mb-3">
        <Text
          className="text-lg font-semibold text-charcoal-900 dark:text-neutral-100"
          testID="phase-summary-title"
        >
          {getPhaseLabel(t, summary.phase)}
        </Text>
        <Text className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {startDate.toFormat('MMM d')} - {endDate.toFormat('MMM d, yyyy')} (
          {Math.round(duration)} days)
        </Text>
      </View>

      <ProgressBar
        completed={summary.completedTasks}
        total={summary.totalTasks}
      />
      <ActivitiesSection activities={summary.activities} t={t} />
      <OutcomesSection outcomes={summary.outcomes} t={t} />
    </View>
  );
}
