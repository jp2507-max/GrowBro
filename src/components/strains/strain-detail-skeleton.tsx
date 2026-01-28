import * as React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/shared/glass-surface';
import { GlassButton, View } from '@/components/ui';
import { ArrowLeft } from '@/components/ui/icons';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';

type Props = {
  onBack: () => void;
  hideHeader?: boolean;
};

function SkeletonChips() {
  return (
    <>
      <View className="h-7 w-20 rounded-full bg-neutral-200 dark:bg-neutral-800" />
      <View className="h-7 w-24 rounded-full bg-neutral-200 dark:bg-neutral-800" />
      <View className="h-7 w-16 rounded-full bg-neutral-200 dark:bg-neutral-800" />
      <View className="h-7 w-20 rounded-full bg-neutral-200 dark:bg-neutral-800" />
    </>
  );
}

export function StrainDetailSkeleton({
  onBack,
  hideHeader = false,
}: Props): React.ReactElement {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-white dark:bg-neutral-950"
      testID="strain-detail-skeleton"
    >
      {/* Hero Image Skeleton */}
      <View className="relative h-96 w-full bg-neutral-200 dark:bg-neutral-800">
        {!hideHeader && (
          /* Header Actions Overlay */
          <View
            className="absolute inset-x-0 top-0 z-10 flex-row items-center justify-between px-4"
            style={{ paddingTop: insets.top + 8 }}
          >
            <GlassButton
              onPress={() => {
                haptics.selection();
                onBack();
              }}
              accessibilityLabel={translate('accessibility.common.go_back')}
              accessibilityHint={translate('strains.detail.back_hint')}
              testID="back-button"
              fallbackClassName="bg-black/20"
            >
              <ArrowLeft color="white" width={24} height={24} />
            </GlassButton>

            {/* Placeholder for action buttons */}
            <View className="flex-row gap-2">
              <View className="size-10 rounded-full bg-black/20" />
              <View className="size-10 rounded-full bg-black/20" />
            </View>
          </View>
        )}

        {/* Title Overlay with GlassSurface */}
        <View className="absolute inset-x-0 bottom-0">
          <GlassSurface
            glassEffectStyle="regular"
            fallbackClassName="bg-black/60"
          >
            <View className="px-5 pb-9 pt-16">
              {/* Title skeleton */}
              <View className="mb-3 h-10 w-3/4 rounded-lg bg-white/20" />

              {/* Badge skeletons */}
              <View className="flex-row flex-wrap gap-2">
                <View className="h-6 w-20 rounded-full bg-white/20" />
                <View className="h-6 w-16 rounded-full bg-white/20" />
                <View className="h-6 w-24 rounded-full bg-white/20" />
              </View>
            </View>
          </GlassSurface>
        </View>
      </View>

      {/* Content Skeleton */}
      <View className="px-5 pt-6">
        {/* Description skeleton lines */}
        <View className="mb-4 h-5 w-full rounded bg-neutral-200 dark:bg-neutral-800" />
        <View className="mb-4 h-5 w-11/12 rounded bg-neutral-200 dark:bg-neutral-800" />
        <View className="mb-4 h-5 w-4/5 rounded bg-neutral-200 dark:bg-neutral-800" />

        {/* Grow Info Card Skeleton */}
        <View className="mt-6 rounded-2xl bg-neutral-50 p-5 dark:bg-neutral-900">
          {/* Section title skeleton */}
          <View className="mb-4 h-6 w-32 rounded bg-neutral-200 dark:bg-neutral-700" />

          {/* Stats rows */}
          <View className="flex-row flex-wrap gap-y-4">
            <View className="w-1/2 pr-2">
              <View className="mb-1 h-4 w-20 rounded bg-neutral-200 dark:bg-neutral-700" />
              <View className="h-5 w-24 rounded bg-neutral-200 dark:bg-neutral-700" />
            </View>

            <View className="w-1/2 pl-2">
              <View className="mb-1 h-4 w-16 rounded bg-neutral-200 dark:bg-neutral-700" />
              <View className="h-5 w-20 rounded bg-neutral-200 dark:bg-neutral-700" />
            </View>

            <View className="w-1/2 pr-2">
              <View className="mb-1 h-4 w-14 rounded bg-neutral-200 dark:bg-neutral-700" />
              <View className="h-5 w-16 rounded bg-neutral-200 dark:bg-neutral-700" />
            </View>
          </View>
        </View>

        {/* Effects/Flavors Chip Skeletons */}
        <View className="mt-8">
          {/* Effects section */}
          <View className="mb-6">
            <View className="mb-3 h-6 w-20 rounded bg-neutral-200 dark:bg-neutral-700" />
            <View className="flex-row flex-wrap gap-2">
              <SkeletonChips />
            </View>
          </View>

          {/* Flavors section */}
          <View>
            <View className="mb-3 h-6 w-20 rounded bg-neutral-200 dark:bg-neutral-700" />
            <View className="flex-row flex-wrap gap-2">
              <SkeletonChips />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
