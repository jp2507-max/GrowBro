/**
 * Guidance Slide Component
 * Introduces playbooks and educational guidance features
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

export function GuidanceSlide({
  index: _index,
}: OnboardingSlideProps): React.ReactElement {
  return (
    <View
      testID="guidance-slide"
      className="flex-1 items-center justify-center px-8"
    >
      {/* Icon */}
      <Animated.View
        testID="guidance-header"
        entering={createStaggeredFadeIn(0, onboardingMotion.stagger.header)}
        className="mb-8"
      >
        <View className="size-24 items-center justify-center rounded-3xl bg-warning-600">
          <Text className="text-5xl">📚</Text>
        </View>
      </Animated.View>

      {/* Title */}
      <Animated.View
        entering={createStaggeredFadeIn(1, onboardingMotion.stagger.header)}
        className="mb-4"
      >
        <Text
          testID="guidance-title"
          className="text-center text-4xl font-bold text-charcoal-950 dark:text-white"
        >
          {translate('onboarding.guidance.title')}
        </Text>
      </Animated.View>

      {/* Body */}
      <Animated.View
        testID="guidance-content"
        entering={createStaggeredFadeIn(2, onboardingMotion.stagger.content)}
        className="mb-8"
      >
        <Text
          testID="guidance-body"
          className="text-center text-lg text-neutral-600 dark:text-neutral-400"
        >
          {translate('onboarding.guidance.body')}
        </Text>
      </Animated.View>

      {/* Features */}
      <View className="w-full max-w-md space-y-4">
        <Animated.View
          testID="guidance-list-0"
          entering={createStaggeredFadeIn(3, onboardingMotion.stagger.list)}
          className="flex-row items-start"
        >
          <Text testID="feature-playbooks-icon" className="mr-3 text-2xl">
            📖
          </Text>
          <View testID="feature-playbooks" className="flex-1">
            <Text
              testID="feature-playbooks-title"
              className="font-semibold text-charcoal-950 dark:text-white"
            >
              {translate('onboarding.guidance.feature_playbooks_title')}
            </Text>
            <Text
              testID="feature-playbooks-body"
              className="text-sm text-neutral-600 dark:text-neutral-400"
            >
              {translate('onboarding.guidance.feature_playbooks_body')}
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          testID="guidance-list-1"
          entering={createStaggeredFadeIn(4, onboardingMotion.stagger.list)}
          className="flex-row items-start"
        >
          <Text testID="feature-tasks-icon" className="mr-3 text-2xl">
            🎯
          </Text>
          <View testID="feature-tasks" className="flex-1">
            <Text
              testID="feature-tasks-title"
              className="font-semibold text-charcoal-950 dark:text-white"
            >
              {translate('onboarding.guidance.feature_tasks_title')}
            </Text>
            <Text
              testID="feature-tasks-body"
              className="text-sm text-neutral-600 dark:text-neutral-400"
            >
              {translate('onboarding.guidance.feature_tasks_body')}
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          testID="guidance-list-2"
          entering={createStaggeredFadeIn(5, onboardingMotion.stagger.list)}
          className="flex-row items-start"
        >
          <Text testID="feature-tips-icon" className="mr-3 text-2xl">
            💡
          </Text>
          <View testID="feature-tips" className="flex-1">
            <Text
              testID="feature-tips-title"
              className="font-semibold text-charcoal-950 dark:text-white"
            >
              {translate('onboarding.guidance.feature_tips_title')}
            </Text>
            <Text
              testID="feature-tips-body"
              className="text-sm text-neutral-600 dark:text-neutral-400"
            >
              {translate('onboarding.guidance.feature_tips_body')}
            </Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
