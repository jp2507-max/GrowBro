/**
 * Playbook Selection Card
 *
 * Displays a playbook option with preview information including
 * total weeks, phase durations, and task counts
 *
 * Requirements: UI/UX implementation, 44pt/48dp touch targets
 */

import React from 'react';
import { Pressable } from 'react-native';

import { Text, View } from '@/components/ui';
import type { PlaybookPreview, PlaybookSetup } from '@/types/playbook';

type PlaybookSelectionCardProps = {
  preview: PlaybookPreview;
  onPress: (playbookId: string) => void;
  className?: string;
};

const SETUP_LABELS: Record<PlaybookSetup, string> = {
  auto_indoor: 'Auto Indoor',
  auto_outdoor: 'Auto Outdoor',
  photo_indoor: 'Photo Indoor',
  photo_outdoor: 'Photo Outdoor',
};

const SETUP_COLORS: Record<PlaybookSetup, string> = {
  auto_indoor: 'bg-primary-100 dark:bg-primary-900/20',
  auto_outdoor: 'bg-success-100 dark:bg-success-900/20',
  photo_indoor: 'bg-warning-100 dark:bg-warning-900/20',
  photo_outdoor: 'bg-danger-100 dark:bg-danger-900/20',
};

const SETUP_TEXT_COLORS: Record<PlaybookSetup, string> = {
  auto_indoor: 'text-primary-700 dark:text-primary-300',
  auto_outdoor: 'text-success-700 dark:text-success-300',
  photo_indoor: 'text-warning-700 dark:text-warning-300',
  photo_outdoor: 'text-danger-700 dark:text-danger-300',
};

function PhaseBreakdownItem({
  phase,
  durationDays,
  taskCount,
}: {
  phase: string;
  durationDays: number;
  taskCount: number;
}) {
  return (
    <View className="flex-row items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 dark:bg-charcoal-800">
      <Text className="text-sm capitalize text-neutral-700 dark:text-neutral-300">
        {phase}
      </Text>
      <View className="flex-row items-center gap-3">
        <Text className="text-xs text-neutral-600 dark:text-neutral-400">
          {durationDays} days
        </Text>
        <Text className="text-xs text-neutral-600 dark:text-neutral-400">
          {taskCount} tasks
        </Text>
      </View>
    </View>
  );
}

export function PlaybookSelectionCard({
  preview,
  onPress,
  className = '',
}: PlaybookSelectionCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Select ${preview.name} playbook, ${preview.totalWeeks} weeks, ${preview.totalTasks} tasks`}
      accessibilityHint="Double tap to select this playbook"
      onPress={() => onPress(preview.playbookId)}
      className={`mb-4 min-h-[48px] rounded-xl border border-neutral-200 bg-white p-4 active:bg-neutral-50 dark:border-charcoal-800 dark:bg-charcoal-900 dark:active:bg-charcoal-800 ${className}`}
      testID={`playbook-card-${preview.setup}`}
    >
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="flex-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {preview.name}
        </Text>
        <View
          className={`ml-2 rounded-full px-3 py-1 ${SETUP_COLORS[preview.setup]}`}
        >
          <Text
            className={`text-xs font-medium ${SETUP_TEXT_COLORS[preview.setup]}`}
          >
            {SETUP_LABELS[preview.setup]}
          </Text>
        </View>
      </View>

      <View className="mb-3 flex-row items-center gap-4">
        <View className="flex-row items-center">
          <Text className="text-2xl">📅</Text>
          <Text className="ml-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {preview.totalWeeks} weeks
          </Text>
        </View>
        <View className="flex-row items-center">
          <Text className="text-2xl">✓</Text>
          <Text className="ml-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {preview.totalTasks} tasks
          </Text>
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">
          Phase Breakdown
        </Text>
        {preview.phaseBreakdown.map((phase, index) => (
          <PhaseBreakdownItem key={`${phase.phase}-${index}`} {...phase} />
        ))}
      </View>

      {preview.estimatedStartDate && preview.estimatedEndDate && (
        <View className="mt-3 rounded-lg bg-primary-50 p-2 dark:bg-primary-900/10">
          <Text className="text-xs text-primary-700 dark:text-primary-300">
            Estimated:{' '}
            {new Date(preview.estimatedStartDate).toLocaleDateString()} →{' '}
            {new Date(preview.estimatedEndDate).toLocaleDateString()}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
