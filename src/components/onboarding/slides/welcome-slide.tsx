/**
 * Welcome Slide Component
 * First onboarding slide introducing GrowBro
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

export function WelcomeSlide({
  index: _index,
}: OnboardingSlideProps): React.ReactElement {
  return (
    <View
      testID="welcome-slide"
      className="flex-1 items-center justify-center px-8"
    >
      {/* App icon or illustration */}
      <Animated.View
        testID="welcome-header"
        entering={createStaggeredFadeIn(0, onboardingMotion.stagger.header)}
        className="mb-8"
      >
        <View className="size-24 items-center justify-center rounded-3xl bg-primary-600">
          <Text className="text-5xl">🌱</Text>
        </View>
      </Animated.View>

      {/* Title */}
      <Animated.View
        entering={createStaggeredFadeIn(1, onboardingMotion.stagger.header)}
        className="mb-4"
      >
        <Text
          testID="welcome-title"
          className="text-center text-4xl font-bold text-charcoal-950 dark:text-white"
        >
          {translate('onboarding.welcome.title')}
        </Text>
      </Animated.View>

      {/* Body */}
      <Animated.View
        testID="welcome-content"
        entering={createStaggeredFadeIn(2, onboardingMotion.stagger.content)}
        className="mb-8"
      >
        <Text
          testID="welcome-body"
          className="text-center text-lg text-neutral-600 dark:text-neutral-400"
        >
          {translate('onboarding.welcome.body')}
        </Text>
      </Animated.View>

      {/* Feature list */}
      <View className="w-full max-w-md space-y-4">
        <Animated.View
          testID="welcome-list-0"
          entering={createStaggeredFadeIn(3, onboardingMotion.stagger.list)}
          className="flex-row items-center"
        >
          <View
            testID="feature-calendar"
            className="mr-4 size-12 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/30"
          >
            <Text testID="feature-calendar-icon" className="text-2xl">
              📅
            </Text>
          </View>
          <View className="flex-1">
            <Text
              testID="feature-calendar-title"
              className="font-semibold text-charcoal-950 dark:text-white"
            >
              {translate('onboarding.welcome.feature_calendar_title')}
            </Text>
            <Text
              testID="feature-calendar-body"
              className="text-sm text-neutral-600 dark:text-neutral-400"
            >
              {translate('onboarding.welcome.feature_calendar_body')}
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          testID="welcome-list-1"
          entering={createStaggeredFadeIn(4, onboardingMotion.stagger.list)}
          className="flex-row items-center"
        >
          <View
            testID="feature-tracking"
            className="mr-4 size-12 items-center justify-center rounded-xl bg-success-100 dark:bg-success-900/30"
          >
            <Text testID="feature-tracking-icon" className="text-2xl">
              🌿
            </Text>
          </View>
          <View className="flex-1">
            <Text
              testID="feature-tracking-title"
              className="font-semibold text-charcoal-950 dark:text-white"
            >
              {translate('onboarding.welcome.feature_tracking_title')}
            </Text>
            <Text
              testID="feature-tracking-body"
              className="text-sm text-neutral-600 dark:text-neutral-400"
            >
              {translate('onboarding.welcome.feature_tracking_body')}
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          testID="welcome-list-2"
          entering={createStaggeredFadeIn(5, onboardingMotion.stagger.list)}
          className="flex-row items-center"
        >
          <View
            testID="feature-ai"
            className="mr-4 size-12 items-center justify-center rounded-xl bg-warning-100 dark:bg-warning-900/30"
          >
            <Text testID="feature-ai-icon" className="text-2xl">
              🤖
            </Text>
          </View>
          <View className="flex-1">
            <Text
              testID="feature-ai-title"
              className="font-semibold text-charcoal-950 dark:text-white"
            >
              {translate('onboarding.welcome.feature_ai_title')}
            </Text>
            <Text
              testID="feature-ai-body"
              className="text-sm text-neutral-600 dark:text-neutral-400"
            >
              {translate('onboarding.welcome.feature_ai_body')}
            </Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
