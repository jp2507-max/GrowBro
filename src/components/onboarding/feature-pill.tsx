/**
 * Feature Pill Component
 * Minimal icon + text pill for calm onboarding aesthetic
 * Supports SVG icons for a polished look
 */

import React from 'react';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { Text, View } from '@/components/ui';
import type { TxKeyPath } from '@/lib/i18n';
import { translate } from '@/lib/i18n';

type FeaturePillProps = {
  icon: React.ReactElement;
  labelKey: TxKeyPath;
  index?: number;
  testID?: string;
};

export function FeaturePill({
  icon,
  labelKey,
  index = 0,
  testID,
}: FeaturePillProps): React.ReactElement {
  return (
    <Animated.View
      testID={testID}
      entering={FadeIn.delay(300 + index * 80)
        .duration(400)
        .reduceMotion(ReduceMotion.System)}
      className="flex-row items-center rounded-full border border-primary-200/60 bg-primary-100/80 px-4 py-2 dark:border-white/10 dark:bg-white/10"
    >
      <View className="mr-2">{icon}</View>
      <Text className="text-sm font-medium text-primary-800 dark:text-neutral-200">
        {translate(labelKey)}
      </Text>
    </Animated.View>
  );
}

type FeaturePillRowProps = {
  children: React.ReactNode;
};

export function FeaturePillRow({
  children,
}: FeaturePillRowProps): React.ReactElement {
  return (
    <View className="flex-row flex-wrap justify-center gap-2">{children}</View>
  );
}
