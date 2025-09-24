import React from 'react';

import { View } from '@/components/ui';

const PLACEHOLDER_ITEMS = Array.from({ length: 4 });

export function CommunitySkeletonList(): React.ReactElement {
  return (
    <View className="gap-4 px-4" testID="community-skeleton-list">
      {PLACEHOLDER_ITEMS.map((_, index) => (
        <View
          key={index}
          className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100/60 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <View className="h-44 w-full bg-neutral-200 dark:bg-neutral-800" />
          <View className="gap-3 px-4 py-5">
            <View className="h-3 w-24 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            <View className="h-6 w-3/4 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            <View className="h-6 w-2/3 rounded-full bg-neutral-200 dark:bg-neutral-800" />
          </View>
        </View>
      ))}
    </View>
  );
}
