/**
 * Intro Slide Component
 * First impression "hero" slide for onboarding
 * Features gradient background and prominent branding
 */

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import type { ColorValue } from 'react-native';
import { useColorScheme } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import {
  createStaggeredFadeIn,
  onboardingMotion,
} from '@/lib/animations/stagger';
import { translate } from '@/lib/i18n';

import type { OnboardingSlideProps } from '../onboarding-pager';

export function IntroSlide({
  index: _index,
}: OnboardingSlideProps): React.ReactElement {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const gradientColors: readonly [ColorValue, ColorValue, ColorValue] = isDark
    ? [colors.charcoal[950], colors.primary[950], colors.charcoal[950]]
    : [colors.white, colors.primary[50], colors.white];

  return (
    <View testID="intro-slide" className="flex-1">
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ flex: 1 }}
      >
        <View className="flex-1 items-center justify-center px-8">
          {/* App Logo */}
          <Animated.View
            testID="intro-logo"
            entering={createStaggeredFadeIn(0, onboardingMotion.stagger.header)}
            className="mb-6"
          >
            <View className="size-32 items-center justify-center rounded-sheet bg-primary-500 shadow-lg">
              <Text className="text-7xl">🌱</Text>
            </View>
          </Animated.View>

          {/* App Name */}
          <Animated.View
            entering={createStaggeredFadeIn(1, onboardingMotion.stagger.header)}
            className="mb-3"
          >
            <Text
              testID="intro-app-name"
              className="text-center text-5xl font-bold text-charcoal-950 dark:text-white"
            >
              GrowBro
            </Text>
          </Animated.View>

          {/* Tagline */}
          <Animated.View
            entering={createStaggeredFadeIn(
              2,
              onboardingMotion.stagger.content
            )}
            className="mb-12"
          >
            <Text
              testID="intro-tagline"
              className="text-center text-xl text-neutral-600 dark:text-neutral-400"
            >
              {translate('onboarding.intro.tagline')}
            </Text>
          </Animated.View>

          {/* Key benefits */}
          <View className="w-full max-w-sm space-y-3">
            <Animated.View
              testID="intro-benefit-0"
              entering={createStaggeredFadeIn(3, onboardingMotion.stagger.list)}
              className="flex-row items-center rounded-2xl bg-white/80 p-4 dark:bg-charcoal-900/80"
            >
              <View className="mr-4 size-10 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40">
                <Text className="text-xl">📅</Text>
              </View>
              <Text className="flex-1 font-medium text-charcoal-950 dark:text-white">
                {translate('onboarding.intro.benefit_plan')}
              </Text>
            </Animated.View>

            <Animated.View
              testID="intro-benefit-1"
              entering={createStaggeredFadeIn(4, onboardingMotion.stagger.list)}
              className="flex-row items-center rounded-2xl bg-white/80 p-4 dark:bg-charcoal-900/80"
            >
              <View className="mr-4 size-10 items-center justify-center rounded-full bg-success-100 dark:bg-success-900/40">
                <Text className="text-xl">🌿</Text>
              </View>
              <Text className="flex-1 font-medium text-charcoal-950 dark:text-white">
                {translate('onboarding.intro.benefit_track')}
              </Text>
            </Animated.View>

            <Animated.View
              testID="intro-benefit-2"
              entering={createStaggeredFadeIn(5, onboardingMotion.stagger.list)}
              className="flex-row items-center rounded-2xl bg-white/80 p-4 dark:bg-charcoal-900/80"
            >
              <View className="mr-4 size-10 items-center justify-center rounded-full bg-warning-100 dark:bg-warning-900/40">
                <Text className="text-xl">🤖</Text>
              </View>
              <Text className="flex-1 font-medium text-charcoal-950 dark:text-white">
                {translate('onboarding.intro.benefit_ai')}
              </Text>
            </Animated.View>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}
