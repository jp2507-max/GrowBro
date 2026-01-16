/**
 * Welcome Slide Component
 * Calm, serene onboarding slide with large Lottie animation and minimal feature pills
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from 'nativewind';
import React from 'react';
import type { ColorValue } from 'react-native';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Calendar, Camera, Leaf } from '@/components/ui/icons';
import { withRM } from '@/lib/animations/motion';
import { translate } from '@/lib/i18n';

import { AnimatedLottieHero } from '../animated-lottie-hero';
import { FeaturePill, FeaturePillRow } from '../feature-pill';
import { FloatingParticles } from '../floating-particles';
import type { OnboardingSlideProps } from '../onboarding-pager';

export function WelcomeSlide({
  index: _index,
}: OnboardingSlideProps): React.ReactElement {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const gradientColors: readonly [ColorValue, ColorValue, ColorValue] = isDark
    ? [colors.charcoal[950], colors.charcoal[900], colors.charcoal[950]]
    : [colors.primary[50], colors.primary[100], colors.primary[50]];
  const iconColor = isDark ? colors.primary[300] : colors.primary[700];

  return (
    <View testID="welcome-slide" className="flex-1">
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.flex}
      >
        {/* Subtle floating particles */}
        <FloatingParticles />

        <View className="flex-1 items-center justify-center px-6">
          {/* Large Lottie hero animation */}
          <View className="mb-8">
            <AnimatedLottieHero animation="welcome" testID="welcome-header" />
          </View>
          {/* Title with gentle spring animation */}
          <Animated.View
            className="mb-4"
            entering={withRM(
              FadeIn.delay(200).springify().damping(25).stiffness(80)
            )}
          >
            <Text
              testID="welcome-title"
              className="text-center text-4xl font-bold text-charcoal-950 dark:text-white"
            >
              {translate('onboarding.welcome.title')}
            </Text>
          </Animated.View>
          {/* Body text - softer */}
          <Animated.View
            testID="welcome-content"
            entering={withRM(FadeIn.delay(350).duration(500))}
            className="mb-12 px-4"
          >
            <Text
              testID="welcome-body"
              className="text-center text-lg leading-relaxed text-neutral-600 dark:text-neutral-400"
            >
              {translate('onboarding.welcome.body')}
            </Text>
          </Animated.View>
          {/* Minimal feature pills */}
          <FeaturePillRow>
            <FeaturePill
              icon={<Calendar size={18} color={iconColor} />}
              labelKey="onboarding.welcome.feature_calendar_title"
              index={0}
              testID="pill-calendar"
            />
            <FeaturePill
              icon={<Leaf size={18} color={iconColor} />}
              labelKey="onboarding.welcome.feature_tracking_title"
              index={1}
              testID="pill-tracking"
            />
            <FeaturePill
              icon={<Camera size={18} color={iconColor} />}
              labelKey="onboarding.welcome.feature_ai_title"
              index={2}
              testID="pill-ai"
            />
          </FeaturePillRow>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
