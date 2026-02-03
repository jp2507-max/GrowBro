import { LinearGradient } from 'expo-linear-gradient';
import * as React from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassButton, View } from '@/components/ui';
import { ArrowLeft } from '@/components/ui/icons';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';

type Props = {
  onBack: () => void;
  hideHeader?: boolean;
};

const styles = StyleSheet.create({
  gradientFill: StyleSheet.absoluteFillObject,
});

function SkeletonChips() {
  return (
    <>
      <View className="h-8 w-20 rounded-lg bg-white/10" />
      <View className="h-8 w-24 rounded-lg bg-white/10" />
      <View className="h-8 w-16 rounded-lg bg-white/10" />
      <View className="h-8 w-20 rounded-lg bg-white/10" />
    </>
  );
}

function StatsCardSkeleton() {
  return (
    <View className="flex-1 items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/5 p-3">
      <View className="size-10 rounded-full bg-white/10" />
      <View className="items-center gap-1">
        <View className="h-3 w-12 rounded bg-white/10" />
        <View className="h-4 w-16 rounded bg-white/10" />
      </View>
    </View>
  );
}

function SectionHeaderSkeleton() {
  return (
    <View className="mb-3 flex-row items-center gap-2">
      <View className="h-5 w-1 rounded-full bg-white/20" />
      <View className="h-5 w-24 rounded bg-white/20" />
    </View>
  );
}

export function StrainDetailSkeleton({
  onBack,
  hideHeader = false,
}: Props): React.ReactElement {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-charcoal-950" testID="strain-detail-skeleton">
      {/* Hero Image Skeleton */}
      <View className="absolute inset-x-0 top-0 z-0 h-[450px] bg-neutral-800">
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.95)']}
          locations={[0, 0.5, 1]}
          style={styles.gradientFill}
        />
      </View>

      {!hideHeader && (
        <View
          className="absolute inset-x-0 top-0 z-20 flex-row items-center justify-between px-4"
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
            fallbackClassName="bg-black/30"
          >
            <ArrowLeft color="white" width={24} height={24} />
          </GlassButton>

          <View className="flex-row gap-3">
            <View className="size-10 rounded-full bg-white/15" />
            <View className="size-10 rounded-full bg-white/15" />
          </View>
        </View>
      )}

      {/* Content */}
      <View className="z-10 flex-1 pt-[320px]">
        {/* Badges and title */}
        <View className="px-6 pb-6">
          <View className="mb-3 flex-row gap-3">
            <View className="h-6 w-16 rounded-full bg-neon-lime/30" />
            <View className="h-6 w-20 rounded-full border border-white/20" />
          </View>
          <View className="h-10 w-3/4 rounded-lg bg-white/20" />
        </View>

        {/* Content Sheet with solid background */}
        <View className="rounded-t-3xl bg-charcoal-950 pb-8 pt-6">
          {/* Stats Grid Skeleton */}
          <View className="flex-row gap-3 px-6">
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </View>

          {/* About Section Skeleton */}
          <View className="mt-6 px-6">
            <SectionHeaderSkeleton />
            <View className="mb-3 h-4 w-full rounded bg-white/10" />
            <View className="mb-3 h-4 w-11/12 rounded bg-white/10" />
            <View className="mb-3 h-4 w-4/5 rounded bg-white/10" />
          </View>

          {/* Effects Section Skeleton */}
          <View className="mt-6 px-6">
            <SectionHeaderSkeleton />
            <View className="flex-row flex-wrap gap-2">
              <SkeletonChips />
            </View>
          </View>

          {/* Aromas Section Skeleton */}
          <View className="mt-6 px-6">
            <SectionHeaderSkeleton />
            <View className="flex-row flex-wrap gap-2">
              <View className="h-7 w-16 rounded-full bg-white/10" />
              <View className="h-7 w-20 rounded-full bg-white/10" />
              <View className="h-7 w-[4.5rem] rounded-full bg-white/10" />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
