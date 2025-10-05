/**
 * Playbook Selection Card
 *
 * Displays a playbook option with preview information including
 * total weeks, phase durations, and task counts
 *
 * Requirements: UI/UX implementation, 44pt/48dp touch targets
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { Text, View } from '@/components/ui';
import type { PlaybookPreview, PlaybookSetup } from '@/types/playbook';

type PlaybookSelectionCardProps = {
  preview: PlaybookPreview;
  onPress: (playbookId: string) => void;
  className?: string;
};

const SETUP_LABEL_KEYS: Record<PlaybookSetup, string> = {
  auto_indoor: 'playbooks.selection.autoIndoor',
  auto_outdoor: 'playbooks.selection.autoOutdoor',
  photo_indoor: 'playbooks.selection.photoIndoor',
  photo_outdoor: 'playbooks.selection.photoOutdoor',
};

export function getSetupDisplayLabel(
  setup: PlaybookSetup
): (t: (key: string) => string) => string {
  return (t: (key: string) => string) => {
    try {
      return t(SETUP_LABEL_KEYS[setup]);
    } catch {
      return setup; // Fallback to the raw slug if translation fails
    }
  };
}

const SETUP_COLORS: Record<PlaybookSetup, string> = {
  auto_indoor: 'bg-primary-100 dark:bg-primary-900/20',
  auto_outdoor: 'bg-success-100 dark:bg-success-900/20',
  photo_indoor: 'bg-warning-100 dark:bg-warning-900/20',
  photo_outdoor: 'bg-danger-100 dark:bg-danger-900/20',
};

function PhaseBreakdownItem({
  phase,
  durationDays,
  taskCount,
  getPhaseLabel,
}: {
  phase: string;
  durationDays: number;
  taskCount: number;
  getPhaseLabel: (phase: string) => string;
}) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 dark:bg-charcoal-800">
      <Text className="text-sm text-neutral-700 dark:text-neutral-300">
        {getPhaseLabel(phase)}
      </Text>
      <View className="flex-row items-center gap-3">
        <Text className="text-xs text-neutral-600 dark:text-neutral-400">
          {t('playbooks.durationDays', { count: durationDays })}
        </Text>
        <Text className="text-xs text-neutral-600 dark:text-neutral-400">
          {t('playbooks.taskCount', { count: taskCount })}
        </Text>
      </View>
    </View>
  );
}

const SETUP_TEXT_COLORS: Record<PlaybookSetup, string> = {
  auto_indoor: 'text-primary-700 dark:text-primary-300',
  auto_outdoor: 'text-success-700 dark:text-success-300',
  photo_indoor: 'text-warning-700 dark:text-warning-300',
  photo_outdoor: 'text-danger-700 dark:text-danger-300',
};

function PlaybookCardHeader({
  name,
  setup,
  setupLabels,
}: {
  name: string;
  setup: PlaybookSetup;
  setupLabels: Record<PlaybookSetup, string>;
}) {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <Text className="flex-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        {name}
      </Text>
      <View className={`ml-2 rounded-full px-3 py-1 ${SETUP_COLORS[setup]}`}>
        <Text className={`text-xs font-medium ${SETUP_TEXT_COLORS[setup]}`}>
          {setupLabels[setup]}
        </Text>
      </View>
    </View>
  );
}

function PlaybookCardStats({
  totalWeeks,
  totalTasks,
  t,
}: {
  totalWeeks: number;
  totalTasks: number;
  t: (key: string, options?: any) => string;
}) {
  return (
    <View className="mb-3 flex-row items-center gap-4">
      <View className="flex-row items-center">
        <Text className="text-2xl">📅</Text>
        <Text className="ml-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t('playbooks.selection.totalWeeks', { count: totalWeeks })}
        </Text>
      </View>
      <View className="flex-row items-center">
        <Text className="text-2xl">✓</Text>
        <Text className="ml-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t('playbooks.selection.taskCount', { count: totalTasks })}
        </Text>
      </View>
    </View>
  );
}

function PlaybookCardBreakdown({
  phaseBreakdown,
  getPhaseLabel,
  t,
}: {
  phaseBreakdown: any[];
  getPhaseLabel: (phase: string) => string;
  t: (key: string) => string;
}) {
  return (
    <View className="gap-2">
      <Text className="text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">
        {t('playbooks.selection.phaseBreakdownTitle')}
      </Text>
      {phaseBreakdown.map((phase, index) => (
        <PhaseBreakdownItem
          key={`${phase.phase}-${index}`}
          {...phase}
          getPhaseLabel={getPhaseLabel}
        />
      ))}
    </View>
  );
}

function PlaybookCardEstimated({
  estimatedStartDate,
  estimatedEndDate,
  t,
}: {
  estimatedStartDate?: string;
  estimatedEndDate?: string;
  t: (key: string, options?: any) => string;
}) {
  if (!estimatedStartDate || !estimatedEndDate) return null;
  return (
    <View className="mt-3 rounded-lg bg-primary-50 p-2 dark:bg-primary-900/10">
      <Text className="text-xs text-primary-700 dark:text-primary-300">
        {t('playbooks.selection.estimatedRange', {
          start: new Date(estimatedStartDate).toLocaleDateString(),
          end: new Date(estimatedEndDate).toLocaleDateString(),
        })}
      </Text>
    </View>
  );
}

export function PlaybookSelectionCard({
  preview,
  onPress,
  className = '',
}: PlaybookSelectionCardProps) {
  const { t } = useTranslation();
  const setupLabels = React.useMemo(
    () => ({
      auto_indoor: t(SETUP_LABEL_KEYS.auto_indoor),
      auto_outdoor: t(SETUP_LABEL_KEYS.auto_outdoor),
      photo_indoor: t(SETUP_LABEL_KEYS.photo_indoor),
      photo_outdoor: t(SETUP_LABEL_KEYS.photo_outdoor),
    }),
    [t]
  );
  const getPhaseLabel = React.useCallback(
    (phase: string) =>
      t(`phases.${phase as PlaybookSetup}`, {
        defaultValue: phase,
      }),
    [t]
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Select ${preview.name} playbook, ${preview.totalWeeks} weeks, ${preview.totalTasks} tasks`}
      accessibilityHint="Double tap to select this playbook"
      onPress={() => onPress(preview.playbookId)}
      className={`mb-4 min-h-[48px] rounded-xl border border-neutral-200 bg-white p-4 active:bg-neutral-50 dark:border-charcoal-800 dark:bg-charcoal-900 dark:active:bg-charcoal-800 ${className}`}
      testID={`playbook-card-${preview.setup}`}
    >
      <PlaybookCardHeader
        name={preview.name}
        setup={preview.setup}
        setupLabels={setupLabels}
      />
      <PlaybookCardStats
        totalWeeks={preview.totalWeeks}
        totalTasks={preview.totalTasks}
        t={t}
      />
      <PlaybookCardBreakdown
        phaseBreakdown={preview.phaseBreakdown}
        getPhaseLabel={getPhaseLabel}
        t={t}
      />
      <PlaybookCardEstimated
        estimatedStartDate={preview.estimatedStartDate}
        estimatedEndDate={preview.estimatedEndDate}
        t={t}
      />
    </Pressable>
  );
}
