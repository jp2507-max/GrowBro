/**
 * Community Slide Component
 * Introduces the community features
 */

import React from 'react';
import Animated from 'react-native-reanimated';

import { Text, View } from '@/components/ui';
import {
  createStaggeredFadeIn,
  onboardingMotion,
} from '@/lib/animations/stagger';
import { translate } from '@/lib/i18n';

import type { OnboardingSlideProps } from '../onboarding-pager';

export function CommunitySlide({
  index: _index,
}: OnboardingSlideProps): React.ReactElement {
  return (
    <View className="flex-1 items-center justify-center px-8">
      {/* Icon */}
      <Animated.View
        entering={createStaggeredFadeIn(0, onboardingMotion.stagger.header)}
        className="mb-8"
      >
        <View className="size-24 items-center justify-center rounded-3xl bg-success-600">
          <Text className="text-5xl">👥</Text>
        </View>
      </Animated.View>

      {/* Title */}
      <Animated.View
        entering={createStaggeredFadeIn(1, onboardingMotion.stagger.header)}
        className="mb-4"
      >
        <Text className="text-center text-4xl font-bold text-charcoal-950 dark:text-white">
          {translate('onboarding.community.title')}
        </Text>
      </Animated.View>

      {/* Body */}
      <Animated.View
        entering={createStaggeredFadeIn(2, onboardingMotion.stagger.content)}
        className="mb-8"
      >
        <Text className="text-center text-lg text-neutral-600 dark:text-neutral-400">
          {translate('onboarding.community.body')}
        </Text>
      </Animated.View>

      {/* Benefits */}
      <View className="w-full max-w-md space-y-3">
        <Animated.View
          entering={createStaggeredFadeIn(3, onboardingMotion.stagger.list)}
          className="rounded-xl bg-neutral-100 p-4 dark:bg-neutral-900"
        >
          <Text className="font-semibold text-charcoal-950 dark:text-white">
            {translate('onboarding.community.benefit_share_title')}
          </Text>
          <Text className="text-sm text-neutral-600 dark:text-neutral-400">
            {translate('onboarding.community.benefit_share_body')}
          </Text>
        </Animated.View>

        <Animated.View
          entering={createStaggeredFadeIn(4, onboardingMotion.stagger.list)}
          className="rounded-xl bg-neutral-100 p-4 dark:bg-neutral-900"
        >
          <Text className="font-semibold text-charcoal-950 dark:text-white">
            {translate('onboarding.community.benefit_learn_title')}
          </Text>
          <Text className="text-sm text-neutral-600 dark:text-neutral-400">
            {translate('onboarding.community.benefit_learn_body')}
          </Text>
        </Animated.View>

        <Animated.View
          entering={createStaggeredFadeIn(5, onboardingMotion.stagger.list)}
          className="rounded-xl bg-neutral-100 p-4 dark:bg-neutral-900"
        >
          <Text className="font-semibold text-charcoal-950 dark:text-white">
            {translate('onboarding.community.benefit_privacy_title')}
          </Text>
          <Text className="text-sm text-neutral-600 dark:text-neutral-400">
            {translate('onboarding.community.benefit_privacy_body')}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}
