/**
 * Assumptions Chip Component
 *
 * Displays when playbook timing uses conservative defaults instead of
 * breeder-specific data. Helps users understand when strain-specific
 * information would improve accuracy.
 */

import React from 'react';

import { Pressable, Text, View } from '@/components/ui';
import type { StrainAssumptions } from '@/lib/playbooks/strain-guidance';

interface AssumptionsChipProps {
  assumptions: StrainAssumptions;
  onPress?: () => void;
  testID?: string;
}

export function AssumptionsChip({
  assumptions,
  onPress,
  testID = 'assumptions-chip',
}: AssumptionsChipProps) {
  if (!assumptions.usedDefaults) {
    return null;
  }

  const ChipContainer = onPress ? Pressable : View;

  return (
    <ChipContainer
      onPress={onPress}
      className="flex-row items-center gap-2 rounded-full bg-warning-100 px-3 py-1.5 dark:bg-warning-900/30"
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel="Using default timing assumptions"
      accessibilityHint={
        onPress
          ? 'Tap to learn more about timing assumptions'
          : 'Playbook uses default timing'
      }
      testID={testID}
    >
      <Text className="text-lg">⚠️</Text>
      <View className="flex-1">
        <Text className="text-sm font-medium text-warning-800 dark:text-warning-200">
          Using Defaults
        </Text>
        <Text className="text-xs text-warning-700 dark:text-warning-300">
          {assumptions.message}
        </Text>
      </View>
      {onPress && (
        <Text className="text-sm text-warning-700 dark:text-warning-300">
          ℹ️
        </Text>
      )}
    </ChipContainer>
  );
}
