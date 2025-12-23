/**
 * Phase Progress Indicator
 *
 * Visual indicator showing progress through grow phases
 *
 * Requirements: 8.3, 8.4
 */

import React from 'react';

import { Text, View } from '@/components/ui';
import type { PhaseProgress } from '@/lib/playbooks/phase-tracker';
import type { GrowPhase } from '@/types/playbook';

type PhaseProgressIndicatorProps = {
  phaseProgress: PhaseProgress[];
  currentPhaseIndex: number;
  className?: string;
};

const PHASE_COLORS: Record<GrowPhase, string> = {
  seedling: 'bg-success-400',
  veg: 'bg-primary-500',
  flower: 'bg-warning-500',
  harvest: 'bg-danger-500',
};

const PHASE_LABELS: Record<GrowPhase, string> = {
  seedling: 'Seedling',
  veg: 'Vegetative',
  flower: 'Flowering',
  harvest: 'Harvest',
};

function TaskCounts({ phase }: { phase: PhaseProgress }) {
  return (
    <View className="mt-1 flex-row gap-1">
      {phase.completedTasks > 0 && (
        <Text className="text-xs text-success-600 dark:text-success-400">
          {phase.completedTasks}
        </Text>
      )}
      {phase.currentTasks > 0 && (
        <Text className="text-xs text-primary-600 dark:text-primary-400">
          {phase.currentTasks}
        </Text>
      )}
      {phase.upcomingTasks > 0 && (
        <Text className="text-xs text-neutral-600 dark:text-neutral-400">
          {phase.upcomingTasks}
        </Text>
      )}
    </View>
  );
}

function PhaseDot({
  phase,
  index,
  currentPhaseIndex,
}: {
  phase: PhaseProgress;
  index: number;
  currentPhaseIndex: number;
}) {
  const isCompleted = phase.progressPercent === 100;
  const isCurrent = index === currentPhaseIndex;

  return (
    <View key={phase.phase} className="flex-1 items-center">
      {index > 0 && (
        <View
          className={`absolute -left-1/2 top-4 h-0.5 w-full ${
            isCompleted || (isCurrent && phase.progressPercent > 0)
              ? PHASE_COLORS[phase.phase]
              : 'bg-border'
          }`}
        />
      )}

      <View
        className={`z-10 size-8 items-center justify-center rounded-full ${
          isCompleted || isCurrent ? PHASE_COLORS[phase.phase] : 'bg-border'
        }`}
      >
        {isCompleted && (
          <Text className="text-xs font-semibold text-white">✓</Text>
        )}
        {isCurrent && !isCompleted && (
          <View className="size-3 rounded-full bg-white" />
        )}
      </View>

      <Text
        className={`mt-2 text-xs ${
          isCurrent
            ? 'font-semibold text-charcoal-900 dark:text-neutral-100'
            : 'text-neutral-600 dark:text-neutral-400'
        }`}
      >
        {PHASE_LABELS[phase.phase]}
      </Text>

      {isCurrent && (
        <Text className="text-text-secondary mt-1 text-xs">
          {phase.progressPercent}%
        </Text>
      )}

      <TaskCounts phase={phase} />
    </View>
  );
}

function Legend() {
  return (
    <View className="mt-4 flex-row justify-center gap-4 px-4">
      <View className="flex-row items-center gap-1">
        <View className="size-2 rounded-full bg-success-600" />
        <Text className="text-text-secondary text-xs">Completed</Text>
      </View>
      <View className="flex-row items-center gap-1">
        <View className="size-2 rounded-full bg-primary-600" />
        <Text className="text-text-secondary text-xs">Current</Text>
      </View>
      <View className="flex-row items-center gap-1">
        <View className="bg-border size-2 rounded-full" />
        <Text className="text-text-secondary text-xs">Upcoming</Text>
      </View>
    </View>
  );
}

export function PhaseProgressIndicator({
  phaseProgress,
  currentPhaseIndex,
  className,
}: PhaseProgressIndicatorProps) {
  if (phaseProgress.length === 0) {
    return null;
  }

  return (
    <View className={className}>
      <View className="flex-row items-center justify-between px-4">
        {phaseProgress.map((phase, index) => (
          <PhaseDot
            key={phase.phase}
            phase={phase}
            index={index}
            currentPhaseIndex={currentPhaseIndex}
          />
        ))}
      </View>
      <Legend />
    </View>
  );
}
