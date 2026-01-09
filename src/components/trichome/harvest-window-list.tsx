/**
 * Harvest Window List Component
 *
 * Displays educational harvest window recommendations
 */

import * as React from 'react';
import { ScrollView, View } from 'react-native';

import { Text } from '@/components/ui';
import type { HarvestWindow } from '@/lib/trichome';

type Props = {
  windows: HarvestWindow[];
  className?: string;
};

const effectStyles = {
  energetic: {
    border:
      'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-950',
    icon: '⚡',
  },
  balanced: {
    border:
      'border-success-300 bg-success-50 dark:border-success-700 dark:bg-success-950',
    icon: '⚖️',
  },
  sedating: {
    border:
      'border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-950',
    icon: '😌',
  },
};

function WindowCard({
  window,
  isLast,
}: {
  window: HarvestWindow;
  isLast: boolean;
}) {
  const styles = effectStyles[window.targetEffect];

  return (
    <View
      className={`mb-4 rounded-lg border-2 p-4 ${styles.border} ${isLast ? 'mb-0' : ''}`}
      testID={`harvest-window-${window.targetEffect}`}
    >
      <View className="mb-2 flex-row items-center">
        <Text className="mr-2 text-2xl">{styles.icon}</Text>
        <Text className="text-lg font-semibold capitalize text-charcoal-950 dark:text-neutral-100">
          {window.targetEffect}
        </Text>
      </View>

      <Text className="mb-3 text-sm text-neutral-700 dark:text-neutral-300">
        {window.description}
      </Text>

      <View className="mb-3 rounded-md bg-white p-3 dark:bg-charcoal-900">
        <Text
          className="mb-2 text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-400"
          tx="trichome.trichome_ratio"
        />
        <View className="flex-row justify-between">
          <View className="flex-1">
            <Text
              className="text-xs text-neutral-600 dark:text-neutral-400"
              tx="trichome.clear"
            />
            <Text className="text-sm font-semibold text-charcoal-950 dark:text-neutral-100">
              {window.trichomeRatio.clear}
            </Text>
          </View>
          <View className="flex-1">
            <Text
              className="text-xs text-neutral-600 dark:text-neutral-400"
              tx="trichome.milky"
            />
            <Text className="text-sm font-semibold text-charcoal-950 dark:text-neutral-100">
              {window.trichomeRatio.milky}
            </Text>
          </View>
          <View className="flex-1">
            <Text
              className="text-xs text-neutral-600 dark:text-neutral-400"
              tx="trichome.amber"
            />
            <Text className="text-sm font-semibold text-charcoal-950 dark:text-neutral-100">
              {window.trichomeRatio.amber}
            </Text>
          </View>
        </View>
      </View>

      <Text className="text-xs italic text-neutral-600 dark:text-neutral-400">
        {window.disclaimer}
      </Text>
    </View>
  );
}

export function HarvestWindowList({ windows, className = '' }: Props) {
  return (
    <ScrollView className={`${className}`} testID="harvest-window-list">
      <Text className="mb-4 text-xl font-semibold text-charcoal-950 dark:text-neutral-100">
        Harvest Windows by Effect
      </Text>

      {windows.map((window, index) => (
        <WindowCard
          key={window.targetEffect}
          window={window}
          isLast={index === windows.length - 1}
        />
      ))}

      <View className="mt-4 rounded-md bg-neutral-100 p-3 dark:bg-charcoal-800">
        <Text className="text-xs italic text-neutral-600 dark:text-neutral-400">
          ⓘ These are general guidelines for educational purposes. Individual
          experiences vary based on strain genetics, growing conditions, and
          personal preference. Always research your specific strain and consult
          local regulations.
        </Text>
      </View>
    </ScrollView>
  );
}
