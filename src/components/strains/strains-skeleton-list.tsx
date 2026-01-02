import React from 'react';

import { View } from '@/components/ui';
import { translate } from '@/lib/i18n';

const SKELETON_ITEM_COUNT = 4;
const PLACEHOLDER_ITEMS = Array.from({ length: SKELETON_ITEM_COUNT });

// Skeleton dimensions match StrainCard: h-52 (208px) image + ~100px content area
export function StrainsSkeletonList(): React.ReactElement {
  return (
    <View
      className="gap-5 px-4"
      testID="strains-skeleton-list"
      accessibilityLabel={translate('accessibility.strains.loading_label')}
      accessibilityHint={translate('accessibility.common.loading_hint')}
      accessibilityRole="progressbar"
    >
      {PLACEHOLDER_ITEMS.map((_, index) => (
        <View
          key={index}
          className="overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-charcoal-900"
        >
          {/* Image placeholder - matches h-52 (208px) */}
          <View className="h-52 w-full bg-neutral-200 dark:bg-neutral-800">
            {/* Badge placeholder - matches overlay position */}
            <View className="absolute bottom-3 left-3 h-8 w-36 rounded-xl bg-neutral-300/50 dark:bg-neutral-700/50" />
            {/* Favorite button placeholder */}
            <View className="absolute right-3 top-3 size-10 rounded-full bg-neutral-300/50 dark:bg-neutral-700/50" />
          </View>
          {/* Content area - matches StrainCardContent padding */}
          <View className="gap-1.5 px-4 pb-4 pt-3">
            <View className="h-6 w-3/4 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
            <View className="h-4 w-full rounded-md bg-neutral-100 dark:bg-neutral-800" />
            <View className="h-4 w-2/3 rounded-md bg-neutral-100 dark:bg-neutral-800" />
          </View>
        </View>
      ))}
    </View>
  );
}
