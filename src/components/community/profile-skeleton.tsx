/**
 * ProfileSkeleton component
 *
 * Loading skeleton for user profile screen
 */

import React from 'react';

import { View } from '@/components/ui';

interface ProfileSkeletonProps {
  testID?: string;
}

export function ProfileSkeleton({
  testID = 'profile-skeleton',
}: ProfileSkeletonProps): React.ReactElement {
  return (
    <View className="flex-1" testID={testID}>
      {/* Header skeleton */}
      <View className="p-4">
        <View className="flex-row items-center gap-4">
          {/* Avatar skeleton */}
          <View className="size-20 rounded-full bg-neutral-200 dark:bg-neutral-800" />

          {/* Username and bio skeleton */}
          <View className="flex-1 gap-2">
            <View className="h-6 w-32 rounded bg-neutral-200 dark:bg-neutral-800" />
            <View className="h-4 w-48 rounded bg-neutral-200 dark:bg-neutral-800" />
          </View>
        </View>
      </View>

      {/* Posts skeleton */}
      <View className="flex-1 gap-4 p-4">
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            className="overflow-hidden rounded-xl border border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900"
          >
            <View className="gap-3 p-4">
              <View className="h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-800" />
              <View className="h-4 w-full rounded bg-neutral-200 dark:bg-neutral-800" />
              <View className="h-4 w-3/4 rounded bg-neutral-200 dark:bg-neutral-800" />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
