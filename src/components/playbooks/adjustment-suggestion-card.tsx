import * as React from 'react';
import { Pressable } from 'react-native';

import type { AdjustmentSuggestion } from '@/types/ai-adjustments';

import { Text, View } from '../ui';

type Props = {
  suggestion: AdjustmentSuggestion;
  onView: (suggestion: AdjustmentSuggestion) => void;
  onDismiss: (suggestionId: string) => void;
};

function CardHeader({
  onDismiss,
  suggestionId,
}: {
  onDismiss: (id: string) => void;
  suggestionId: string;
}) {
  return (
    <View className="mb-2 flex-row items-center justify-between">
      <View className="flex-row items-center">
        <Text
          tx="playbooks.adjustments.scheduleAdjustment"
          className="text-lg font-semibold text-warning-900 dark:text-warning-100"
        />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => onDismiss(suggestionId)}
        className="rounded-full p-1"
        testID="dismiss-button"
      >
        <Text className="text-neutral-500 dark:text-neutral-400">✕</Text>
      </Pressable>
    </View>
  );
}

function StatsRow({
  taskCount,
  confidence,
}: {
  taskCount: number;
  confidence: number;
}) {
  const confidencePercent = Math.round(confidence * 100);
  return (
    <View className="mb-3 flex-row items-center gap-4">
      <View className="flex-row items-center gap-1">
        <Text className="text-xs text-neutral-600 dark:text-neutral-400">
          Tasks affected: {taskCount}
        </Text>
      </View>
      <View className="flex-row items-center gap-1">
        <Text className="text-xs text-neutral-600 dark:text-neutral-400">
          Confidence: {confidencePercent}%
        </Text>
      </View>
    </View>
  );
}

export function AdjustmentSuggestionCard({
  suggestion,
  onView,
  onDismiss,
}: Props) {
  const taskCount = suggestion.affectedTasks.length;

  return (
    <View
      className="dark:bg-warning-950 mb-3 rounded-xl border border-warning-200 bg-warning-50 p-4 dark:border-warning-800"
      testID="adjustment-suggestion-card"
    >
      <CardHeader onDismiss={onDismiss} suggestionId={suggestion.id} />

      <Text className="mb-3 text-sm text-neutral-700 dark:text-neutral-300">
        {suggestion.reasoning}
      </Text>

      <StatsRow taskCount={taskCount} confidence={suggestion.confidence} />

      <Pressable
        accessibilityRole="button"
        onPress={() => onView(suggestion)}
        className="rounded-lg bg-warning-600 px-4 py-2 active:bg-warning-700"
        testID="view-details-button"
      >
        <Text
          tx="playbooks.adjustments.viewDetails"
          className="text-center font-medium text-white"
        />
      </Pressable>

      <Text
        tx="playbooks.adjustments.disclaimer"
        className="mt-2 text-xs text-neutral-500 dark:text-neutral-400"
      />
    </View>
  );
}
