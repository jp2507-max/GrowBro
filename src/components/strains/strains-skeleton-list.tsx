import React from 'react';

import { View } from '@/components/ui';

const PLACEHOLDER_ITEMS = Array.from({ length: 6 });

export function StrainsSkeletonList(): React.ReactElement {
  return (
    <View className="gap-4 px-2" testID="strains-skeleton-list">
      {PLACEHOLDER_ITEMS.map((_, index) => (
        <View
          key={index}
          className="gap-3 rounded-2xl border border-neutral-200 bg-neutral-100/60 p-4 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <View className="h-4 w-1/2 rounded-full bg-neutral-200 dark:bg-neutral-700" />
          <View className="h-3 w-24 rounded-full bg-neutral-200 dark:bg-neutral-800" />
          <View className="h-16 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
        </View>
      ))}
    </View>
  );
}
