/**
 * Guidance Slide Component
 * Calm, serene onboarding slide with large Lottie animation and minimal feature pills
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from 'nativewind';
import React from 'react';
import type { ColorValue } from 'react-native';
import { StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  // @ts-ignore - Reanimated 4.x type exports issue
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Check, Lightbulb, Sprout } from '@/components/ui/icons';
import { translate } from '@/lib/i18n';

import { AnimatedLottieHero } from '../animated-lottie-hero';
import { FeaturePill, FeaturePillRow } from '../feature-pill';
import { FloatingParticles } from '../floating-particles';
import type { OnboardingSlideProps } from '../onboarding-pager';

export function GuidanceSlide({
  index: _index,
}: OnboardingSlideProps): React.ReactElement {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const titleScale = useSharedValue(0.95);
  const titleOpacity = useSharedValue(0);

  React.useEffect(() => {
    titleOpacity.value = withDelay(
      200,
      withSpring(1, {
        damping: 25,
        stiffness: 80,
        reduceMotion: ReduceMotion.System,
      })
    );
    titleScale.value = withDelay(
      200,
      withSpring(1, {
        damping: 20,
        stiffness: 80,
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [titleOpacity, titleScale]);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ scale: titleScale.value }],
  }));

  const gradientColors: readonly [ColorValue, ColorValue, ColorValue] = isDark
    ? [colors.charcoal[950], colors.charcoal[900], colors.charcoal[950]]
    : [colors.primary[50], colors.primary[100], colors.primary[50]];

  return (
    <View testID="guidance-slide" className="flex-1">
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
            <AnimatedLottieHero animation="guidance" testID="guidance-header" />
          </View>

          {/* Title with gentle spring animation */}
          <Animated.View style={titleStyle} className="mb-4">
            <Text
              testID="guidance-title"
              className="text-center text-4xl font-bold text-charcoal-950 dark:text-white"
            >
              {translate('onboarding.guidance.title')}
            </Text>
          </Animated.View>

          {/* Body text - softer */}
          <Animated.View
            testID="guidance-content"
            entering={FadeIn.delay(350)
              .duration(500)
              .reduceMotion(ReduceMotion.System)}
            className="mb-12 px-4"
          >
            <Text
              testID="guidance-body"
              className="text-center text-lg leading-relaxed text-neutral-600 dark:text-neutral-400"
            >
              {translate('onboarding.guidance.body')}
            </Text>
          </Animated.View>

          {/* Minimal feature pills */}
          <FeaturePillRow>
            <FeaturePill
              icon={<Sprout size={18} color={colors.primary[700]} />}
              labelKey="onboarding.guidance.feature_playbooks_title"
              index={0}
              testID="pill-playbooks"
            />
            <FeaturePill
              icon={<Check size={18} color={colors.primary[700]} />}
              labelKey="onboarding.guidance.feature_tasks_title"
              index={1}
              testID="pill-tasks"
            />
            <FeaturePill
              icon={<Lightbulb size={18} color={colors.primary[700]} />}
              labelKey="onboarding.guidance.feature_tips_title"
              index={2}
              testID="pill-tips"
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
