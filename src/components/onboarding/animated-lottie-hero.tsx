/**
 * Animated Lottie Hero Component
 * Premium animated hero using Lottie animations with gentle floating motion
 * For onboarding slides - designed for calm, serene aesthetic
 */

import LottieView from 'lottie-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  // @ts-ignore - Reanimated 4.x type exports issue
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  // @ts-ignore - Reanimated 4.x type exports issue
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { View } from '@/components/ui';
import colors from '@/components/ui/colors';

// Lottie animation sources - plant-themed animations
const LOTTIE_SOURCES = {
  intro: require('../../../assets/lottie/welcome.json'),
  community: require('../../../assets/lottie/community.json'),
  guidance: require('../../../assets/lottie/guidance.json'),
} as const;

export type LottieAnimationKey = keyof typeof LOTTIE_SOURCES;

type AnimatedLottieHeroProps = {
  animation: LottieAnimationKey;
  testID?: string;
};

export function AnimatedLottieHero({
  animation,
  testID = 'animated-lottie-hero',
}: AnimatedLottieHeroProps): React.ReactElement {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const translateY = useSharedValue(0);
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0.2);

  React.useEffect(() => {
    // Gentle fade in
    opacity.value = withTiming(1, {
      duration: 600,
      easing: Easing.out(Easing.ease),
      reduceMotion: ReduceMotion.System,
    });

    // Soft entrance scale
    scale.value = withSpring(1, {
      damping: 20,
      stiffness: 80,
      mass: 1,
      reduceMotion: ReduceMotion.System,
    });

    // Gentle continuous float animation
    translateY.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(-6, {
            duration: 2500,
            easing: Easing.inOut(Easing.sin),
            reduceMotion: ReduceMotion.System,
          }),
          withTiming(0, {
            duration: 2500,
            easing: Easing.inOut(Easing.sin),
            reduceMotion: ReduceMotion.System,
          })
        ),
        -1,
        false
      )
    );

    // Pulsing glow
    glowOpacity.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(0.4, {
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            reduceMotion: ReduceMotion.System,
          }),
          withTiming(0.2, {
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            reduceMotion: ReduceMotion.System,
          })
        ),
        -1,
        false
      )
    );

    return () => {
      cancelAnimation(translateY);
      cancelAnimation(scale);
      cancelAnimation(opacity);
      cancelAnimation(glowOpacity);
    };
  }, [translateY, scale, opacity, glowOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // Theme-aware glow color
  const glowColor = isDark ? colors.primary[500] : colors.primary[200];

  return (
    <View testID={testID} className="items-center justify-center">
      {/* Glow layer behind Lottie */}
      <Animated.View
        style={[styles.glow, glowStyle, { backgroundColor: glowColor }]}
      />

      <Animated.View style={animatedStyle}>
        <LottieView
          source={LOTTIE_SOURCES[animation]}
          style={styles.lottie}
          autoPlay
          loop
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  lottie: {
    width: 180,
    height: 180,
  },
  glow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    // Simulated blur via size - actual blur would need expo-blur
  },
});
