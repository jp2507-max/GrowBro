/**
 * Loading States for Playbook Components
 *
 * Reusable loading skeletons with smooth transitions
 */

import React from 'react';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { View } from '@/components/ui';

export function PlaybookCardSkeleton() {
  return (
    <Animated.View
      entering={FadeIn.duration(300).reduceMotion(ReduceMotion.System)}
      className="mb-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-charcoal-800 dark:bg-charcoal-900"
    >
      {/* Header skeleton */}
      <View className="mb-3 flex-row items-center justify-between">
        <View className="h-6 w-32 rounded-full bg-neutral-200 dark:bg-charcoal-700" />
        <View className="h-6 w-24 rounded-full bg-neutral-200 dark:bg-charcoal-700" />
      </View>

      {/* Stats skeleton */}
      <View className="mb-3 flex-row gap-4">
        <View className="h-5 w-20 rounded-full bg-neutral-200 dark:bg-charcoal-700" />
        <View className="h-5 w-20 rounded-full bg-neutral-200 dark:bg-charcoal-700" />
      </View>

      {/* Phase breakdown skeleton */}
      <View className="gap-2">
        <View className="h-4 w-24 rounded-full bg-neutral-200 dark:bg-charcoal-700" />
        <View className="h-10 w-full rounded-lg bg-neutral-200 dark:bg-charcoal-700" />
        <View className="h-10 w-full rounded-lg bg-neutral-200 dark:bg-charcoal-700" />
        <View className="h-10 w-full rounded-lg bg-neutral-200 dark:bg-charcoal-700" />
      </View>
    </Animated.View>
  );
}

export function TaskTimelineSkeleton() {
  return (
    <Animated.View
      entering={FadeIn.duration(300).reduceMotion(ReduceMotion.System)}
      className="mx-4 mb-2 flex-row items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
    >
      {/* Status indicator skeleton */}
      <View className="size-10 rounded-full bg-neutral-200 dark:bg-charcoal-700" />

      {/* Task info skeleton */}
      <View className="flex-1 gap-2">
        <View className="h-4 w-3/4 rounded-full bg-neutral-200 dark:bg-charcoal-700" />
        <View className="h-3 w-1/2 rounded-full bg-neutral-200 dark:bg-charcoal-700" />
      </View>

      {/* Arrow skeleton */}
      <View className="size-4 rounded-full bg-neutral-200 dark:bg-charcoal-700" />
    </Animated.View>
  );
}

export function ShiftPreviewSkeleton() {
  return (
    <Animated.View
      entering={FadeIn.duration(300).reduceMotion(ReduceMotion.System)}
      className="p-4"
    >
      {/* Summary skeleton */}
      <View className="mb-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-charcoal-800 dark:bg-charcoal-900">
        <View className="mb-3 h-5 w-32 rounded-full bg-neutral-200 dark:bg-charcoal-700" />
        <View className="h-6 w-16 rounded-full bg-neutral-200 dark:bg-charcoal-700" />
      </View>

      {/* Phase breakdown skeleton */}
      <View className="gap-2">
        <View className="h-4 w-24 rounded-full bg-neutral-200 dark:bg-charcoal-700" />
        <View className="h-12 w-full rounded-lg bg-neutral-200 dark:bg-charcoal-700" />
        <View className="h-12 w-full rounded-lg bg-neutral-200 dark:bg-charcoal-700" />
        <View className="h-12 w-full rounded-lg bg-neutral-200 dark:bg-charcoal-700" />
      </View>
    </Animated.View>
  );
}

export function TrichomeGuideSkeleton() {
  return (
    <Animated.View
      entering={FadeIn.duration(300).reduceMotion(ReduceMotion.System)}
      className="p-4"
    >
      {/* Title skeleton */}
      <View className="mb-4 h-6 w-48 rounded-full bg-neutral-200 dark:bg-charcoal-700" />

      {/* Stages skeleton */}
      <View className="mb-6 gap-4">
        <View className="h-24 w-full rounded-lg bg-neutral-200 dark:bg-charcoal-700" />
        <View className="h-24 w-full rounded-lg bg-neutral-200 dark:bg-charcoal-700" />
        <View className="h-24 w-full rounded-lg bg-neutral-200 dark:bg-charcoal-700" />
      </View>

      {/* Tips skeleton */}
      <View className="gap-2">
        <View className="h-4 w-32 rounded-full bg-neutral-200 dark:bg-charcoal-700" />
        <View className="h-3 w-full rounded-full bg-neutral-200 dark:bg-charcoal-700" />
        <View className="h-3 w-5/6 rounded-full bg-neutral-200 dark:bg-charcoal-700" />
        <View className="h-3 w-4/5 rounded-full bg-neutral-200 dark:bg-charcoal-700" />
      </View>
    </Animated.View>
  );
}
