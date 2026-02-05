/**
 * Community Slide Component
 * Calm, serene onboarding slide with large Lottie animation and minimal feature pills
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from 'nativewind';
import React from 'react';
import type { ColorValue } from 'react-native';
import { StyleSheet } from 'react-native';
import Animated, {
  // @ts-ignore - Reanimated 4.x type exports issue
  cancelAnimation,
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
import { MessageCircle, Shield, Users } from '@/components/ui/icons';
import { translate } from '@/lib/i18n';

import { AnimatedLottieHero } from '../animated-lottie-hero';
import { FeaturePill, FeaturePillRow } from '../feature-pill';
import { FloatingParticles } from '../floating-particles';
import type { OnboardingSlideProps } from '../onboarding-pager';

export function CommunitySlide({
  index: _index,
}: OnboardingSlideProps): React.ReactElement {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const titleScale = useSharedValue(0.95);
  const titleOpacity = useSharedValue(0);

  React.useEffect(() => {
    titleOpacity.set(
      withDelay(
        200,
        withSpring(1, {
          damping: 25,
          stiffness: 80,
          reduceMotion: ReduceMotion.System,
        })
      )
    );
    titleScale.set(
      withDelay(
        200,
        withSpring(1, {
          damping: 20,
          stiffness: 80,
          reduceMotion: ReduceMotion.System,
        })
      )
    );

    return () => {
      cancelAnimation(titleOpacity);
      cancelAnimation(titleScale);
    };
  }, [titleOpacity, titleScale]);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.get(),
    transform: [{ scale: titleScale.get() }],
  }));

  const gradientColors: readonly [ColorValue, ColorValue, ColorValue] = isDark
    ? [colors.charcoal[950], colors.charcoal[900], colors.charcoal[950]]
    : [colors.primary[50], colors.primary[100], colors.primary[50]];

  return (
    <View testID="community-slide" className="flex-1">
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
            <AnimatedLottieHero
              animation="community"
              testID="community-header"
            />
          </View>

          {/* Title with gentle spring animation */}
          <Animated.View style={titleStyle} className="mb-4">
            <Text
              testID="community-title"
              className="text-center text-4xl font-bold text-charcoal-950 dark:text-white"
            >
              {translate('onboarding.community.title')}
            </Text>
          </Animated.View>

          {/* Body text - softer */}
          <Animated.View
            testID="community-content"
            entering={FadeIn.delay(350)
              .duration(500)
              .reduceMotion(ReduceMotion.System)}
            className="mb-12 px-4"
          >
            <Text
              testID="community-body"
              className="text-center text-lg leading-relaxed text-neutral-600 dark:text-neutral-400"
            >
              {translate('onboarding.community.body')}
            </Text>
          </Animated.View>

          {/* Minimal feature pills */}
          <FeaturePillRow>
            <FeaturePill
              icon={
                <MessageCircle
                  size={18}
                  color={isDark ? colors.primary[300] : colors.primary[700]}
                />
              }
              labelKey="onboarding.community.benefit_share_title"
              index={0}
              testID="pill-share"
            />
            <FeaturePill
              icon={
                <Users
                  size={18}
                  color={isDark ? colors.primary[300] : colors.primary[700]}
                />
              }
              labelKey="onboarding.community.benefit_learn_title"
              index={1}
              testID="pill-learn"
            />
            <FeaturePill
              icon={
                <Shield
                  size={18}
                  color={isDark ? colors.primary[300] : colors.primary[700]}
                />
              }
              labelKey="onboarding.community.benefit_privacy_title"
              index={2}
              testID="pill-privacy"
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
